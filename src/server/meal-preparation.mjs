import {preparationInputs,recordRecipeUses,availableRecipeStock} from './recipe-ingredients.mjs';
import {productionDeductions} from './ingredient-stock.mjs';
import { randomUUID } from 'node:crypto';
import { lockHouseholdInventory } from './ingredient-stock.mjs';

export async function setMealPrepared(pool,householdId,mealId,prepared) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client,householdId);
    const meal=await client.query('SELECT id,prepared_at FROM planned_meals WHERE id=$1 AND household_id=$2 FOR UPDATE',[mealId,householdId]);
    if(!meal.rowCount){await client.query('ROLLBACK');return {error:'planned-meal-not-found'};}
    if(Boolean(meal.rows[0].prepared_at)===prepared){await client.query('ROLLBACK');return {prepared,replayed:true};}
    if(!prepared){
      const movements=await client.query(`SELECT food_id AS "foodId",-sum(delta_g) AS "quantityG"
        FROM ingredient_stock_movements WHERE household_id=$1 AND meal_id=$2
          AND reason IN ('meal-preparation','meal-preparation-cancelled')
        GROUP BY food_id HAVING sum(delta_g)<0`,[householdId,mealId]);
      for(const item of movements.rows){
        await client.query('UPDATE household_ingredient_stock SET quantity_g=quantity_g+$3,version=version+1,updated_at=now() WHERE household_id=$1 AND food_id=$2',[householdId,item.foodId,item.quantityG]);
        await client.query(`INSERT INTO ingredient_stock_movements(id,household_id,food_id,delta_g,reason,meal_id)
          VALUES($1,$2,$3,$4,'meal-preparation-cancelled',$5)`,[randomUUID(),householdId,item.foodId,item.quantityG,mealId]);
      }
      await client.query('UPDATE recipe_stock_uses SET cancelled_at=now() WHERE meal_id=$1 AND cancelled_at IS NULL',[mealId]);
      await client.query('UPDATE planned_meals SET prepared_at=NULL,updated_at=now() WHERE id=$1',[mealId]);
      await client.query('COMMIT');return {prepared:false,restored:movements.rows.map(item=>({foodId:item.foodId,quantityG:Number(item.quantityG)}))};
    }
    const items=await client.query(`SELECT i.recipe_id AS "recipeId",r.production_type AS "productionType",
      r.yield_amount AS "yieldAmount",sum(a.quantity) AS quantity
      FROM planned_meal_items i JOIN planned_amounts a ON a.planned_item_id=i.id
      JOIN recipes r ON r.id=i.recipe_id WHERE i.meal_id=$1
      GROUP BY i.recipe_id,r.production_type,r.yield_amount`,[mealId]);
    const inputs=await preparationInputs(client,householdId,items.rows.filter(item=>item.productionType==='none').map(item=>({id:item.recipeId,factor:Number(item.quantity)/Number(item.yieldAmount)})));
    if(inputs.error){await client.query('ROLLBACK');return inputs;}
    const stock=await availableRecipeStock(client,householdId);
    for(const item of items.rows.filter(item=>item.productionType!=='none')){
      if((stock.get(item.recipeId)??0)-(inputs.uses.get(item.recipeId)??0)+0.00000001<Number(item.quantity)){
        await client.query('ROLLBACK');return {error:'prepared-batch-insufficient',recipeId:item.recipeId};
      }
    }
    const deductions=productionDeductions(inputs.lines,1,1);
    if(deductions.error){await client.query('ROLLBACK');return deductions;}
    const used=deductions.items;
    await recordRecipeUses(client,householdId,inputs.uses,{mealId});
    for(const item of used){
      await client.query('UPDATE household_ingredient_stock SET quantity_g=quantity_g-$3,version=version+1,updated_at=now() WHERE household_id=$1 AND food_id=$2',[householdId,item.foodId,item.usedG]);
      await client.query(`INSERT INTO ingredient_stock_movements(id,household_id,food_id,delta_g,reason,meal_id)
        VALUES($1,$2,$3,$4,'meal-preparation',$5)`,[randomUUID(),householdId,item.foodId,-item.usedG,mealId]);
    }
    await client.query('UPDATE planned_meals SET prepared_at=now(),updated_at=now() WHERE id=$1',[mealId]);
    await client.query('COMMIT');return {prepared:true,deductions:used};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
