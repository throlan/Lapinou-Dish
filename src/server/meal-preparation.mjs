import { randomUUID } from 'node:crypto';
import { toGrams } from '../domain/foods.ts';
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
      await client.query('UPDATE planned_meals SET prepared_at=NULL,updated_at=now() WHERE id=$1',[mealId]);
      await client.query('COMMIT');return {prepared:false,restored:movements.rows.map(item=>({foodId:item.foodId,quantityG:Number(item.quantityG)}))};
    }
    const items=await client.query(`SELECT i.recipe_id AS "recipeId",r.production_type AS "productionType",
      r.yield_amount AS "yieldAmount",sum(a.quantity) AS quantity
      FROM planned_meal_items i JOIN planned_amounts a ON a.planned_item_id=i.id
      JOIN recipes r ON r.id=i.recipe_id WHERE i.meal_id=$1
      GROUP BY i.recipe_id,r.production_type,r.yield_amount`,[mealId]);
    const deductions=new Map();
    for(const item of items.rows){
      const quantity=Number(item.quantity);
      if(item.productionType!=='none'){
        const stock=await client.query(`SELECT COALESCE((SELECT sum(quantity) FROM stock_lots WHERE household_id=$1 AND recipe_id=$2
          AND cancelled_at IS NULL AND NOT is_serving_bundle),0)
          - COALESCE((SELECT sum(a.quantity) FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id
            JOIN planned_amounts a ON a.planned_item_id=i.id WHERE m.household_id=$1 AND m.prepared_at IS NOT NULL
            AND i.recipe_id=$2),0) AS available`,[householdId,item.recipeId]);
        if(Number(stock.rows[0].available)+0.00001<quantity){await client.query('ROLLBACK');return {error:'prepared-batch-insufficient',recipeId:item.recipeId};}
        continue;
      }
      const lines=await client.query(`SELECT rl.food_id AS "foodId",f.canonical_name AS name,rl.quantity,rl.unit_id AS "unitId",
        s.quantity_g AS "quantityG",f.grams_per_millilitre AS "gramsPerMillilitre",
        COALESCE((SELECT jsonb_object_agg(u.unit_id,u.grams_per_unit) FROM food_unit_conversions u WHERE u.food_id=f.id),'{}'::jsonb) AS "gramsPerUnit"
        FROM recipe_lines rl JOIN foods f ON f.id=rl.food_id
        JOIN household_ingredient_stock s ON s.household_id=$2 AND s.food_id=f.id
        WHERE rl.recipe_id=$1 ORDER BY rl.food_id FOR UPDATE OF s`,[item.recipeId,householdId]);
      for(const line of lines.rows){
        const grams=toGrams(Number(line.quantity)*quantity/Number(item.yieldAmount),line.unitId,{
          gramsPerMillilitre:line.gramsPerMillilitre==null?null:Number(line.gramsPerMillilitre),
          gramsPerUnit:Object.fromEntries(Object.entries(line.gramsPerUnit).map(([unit,value])=>[unit,Number(value)]))});
        if(grams==null){await client.query('ROLLBACK');return {error:'ingredient-conversion-missing',name:line.name};}
        const old=deductions.get(line.foodId);
        deductions.set(line.foodId,{foodId:line.foodId,name:line.name,quantityG:Number(line.quantityG),usedG:(old?.usedG??0)+grams});
      }
    }
    const used=[...deductions.values()].map(item=>({...item,usedG:Math.round(item.usedG*100000)/100000}));
    const insufficient=used.find(item=>item.usedG>item.quantityG+0.00001);
    if(insufficient){await client.query('ROLLBACK');return {error:'ingredient-stock-insufficient',name:insufficient.name,
      requiredG:insufficient.usedG,availableG:insufficient.quantityG};}
    for(const item of used){
      await client.query('UPDATE household_ingredient_stock SET quantity_g=quantity_g-$3,version=version+1,updated_at=now() WHERE household_id=$1 AND food_id=$2',[householdId,item.foodId,item.usedG]);
      await client.query(`INSERT INTO ingredient_stock_movements(id,household_id,food_id,delta_g,reason,meal_id)
        VALUES($1,$2,$3,$4,'meal-preparation',$5)`,[randomUUID(),householdId,item.foodId,-item.usedG,mealId]);
    }
    await client.query('UPDATE planned_meals SET prepared_at=now(),updated_at=now() WHERE id=$1',[mealId]);
    await client.query('COMMIT');return {prepared:true,deductions:used};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
