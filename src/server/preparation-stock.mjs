import {randomUUID} from 'node:crypto';
import {availableRecipeStock} from './recipe-ingredients.mjs';
import {lockHouseholdInventory} from './ingredient-stock.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const clean=value=>Math.round(value*1000)/1000;
export function validatePreparationCount(input){
  if(!input||!uuid(input.householdId)||!uuid(input.recipeId)||!Number.isFinite(input.quantity)||input.quantity<0||input.quantity>100000000
    ||!Number.isFinite(input.expectedQuantity)||Math.abs(input.expectedQuantity)>100000000)return {error:'invalid-preparation-count'};
  return {data:{householdId:input.householdId,recipeId:input.recipeId,quantity:clean(input.quantity),expectedQuantity:clean(input.expectedQuantity)}};
}
// A physical inventory correction, never a production or raw-ingredient return.
export async function countPreparationStock(pool,input){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');await lockHouseholdInventory(client,input.householdId);
    const found=await client.query(`SELECT r.id FROM recipes r WHERE r.id=$1 AND r.household_id=$2 AND r.production_type<>'none'
      AND EXISTS(SELECT 1 FROM stock_lots s WHERE s.recipe_id=r.id AND s.household_id=r.household_id AND NOT s.is_serving_bundle)`,[input.recipeId,input.householdId]);
    if(!found.rowCount){await client.query('ROLLBACK');return {error:'preparation-stock-not-found'};}
    const current=clean((await availableRecipeStock(client,input.householdId)).get(input.recipeId)??0);
    if(current===input.quantity){await client.query('ROLLBACK');return {saved:true,physicalQuantity:current,unchanged:true};}
    if(current!==input.expectedQuantity){await client.query('ROLLBACK');return {error:'preparation-stock-changed'};}
    await client.query(`INSERT INTO preparation_stock_counts(id,household_id,recipe_id,previous_quantity,counted_quantity,delta)
      VALUES($1,$2,$3,$4,$5,$6)`,[randomUUID(),input.householdId,input.recipeId,current,input.quantity,clean(input.quantity-current)]);
    await client.query('COMMIT');return {saved:true,physicalQuantity:input.quantity};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
