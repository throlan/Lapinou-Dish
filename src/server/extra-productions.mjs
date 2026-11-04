import {randomUUID} from 'node:crypto';
import {recipeMinimumInYield} from './recipe-ingredients.mjs';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const date=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(value+'T00:00:00Z');
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
};
const storages=new Set(['pantry','fridge','freezer']);

export function validateExtraProduction(input){
  if(!input||!uuid(input.householdId)||!uuid(input.recipeId)||!date(input.plannedOn)
    ||!Number.isFinite(input.quantity)||input.quantity<=0||input.quantity>100000
    ||Math.abs(input.quantity*1000-Math.round(input.quantity*1000))>0.000001
    ||!storages.has(input.storage)||(input.note!=null&&(typeof input.note!=='string'||input.note.length>500)))
    return {error:'invalid-extra-production'};
  return {data:{id:randomUUID(),householdId:input.householdId,recipeId:input.recipeId,
    plannedOn:input.plannedOn,quantity:input.quantity,storage:input.storage,note:input.note?.trim()??''}};
}

export async function listExtraProductions(pool,householdId,startDate,endDate){
  const result=await pool.query(`SELECT p.id,p.recipe_id AS "recipeId",r.name,p.planned_on::text AS "plannedOn",
    p.quantity::float8 AS quantity,r.yield_unit_id AS "unitId",p.storage,p.note,
    p.stock_lot_id AS "stockLotId",(p.stock_lot_id IS NOT NULL AND l.cancelled_at IS NULL) AS completed
    FROM planned_extra_productions p JOIN recipes r ON r.id=p.recipe_id
    LEFT JOIN stock_lots l ON l.id=p.stock_lot_id
    WHERE p.household_id=$1 AND p.planned_on BETWEEN $2::date AND $3::date
    ORDER BY p.planned_on,p.created_at,p.id`,[householdId,startDate,endDate]);
  return result.rows;
}

export async function saveExtraProduction(pool,input){
  const recipe=await pool.query(`SELECT yield_amount,yield_unit_id,output_units,minimum_production_amount,minimum_production_unit_id
    FROM recipes WHERE id=$1 AND household_id=$2 AND production_type<>'none' AND parent_recipe_id IS NULL`,[input.recipeId,input.householdId]);
  if(!recipe.rowCount)return null;
  const row=recipe.rows[0];
  const minimum=recipeMinimumInYield({yield:{amount:Number(row.yield_amount),unitId:row.yield_unit_id},
    outputUnits:row.output_units??{},minimumProductionAmount:Number(row.minimum_production_amount??0),minimumProductionUnitId:row.minimum_production_unit_id});
  const quantity=Math.max(input.quantity,minimum);
  const result=await pool.query(`INSERT INTO planned_extra_productions
    (id,household_id,recipe_id,planned_on,quantity,storage,note)
    SELECT $1,$2,r.id,$4,$5,$6,$7 FROM recipes r
    WHERE r.id=$3 AND r.household_id=$2 AND r.production_type<>'none' AND r.parent_recipe_id IS NULL
    RETURNING id`,[input.id,input.householdId,input.recipeId,input.plannedOn,quantity,input.storage,input.note]);
  return result.rowCount?{id:input.id,quantity}:null;
}

export async function deleteExtraProduction(pool,householdId,id){
  const result=await pool.query('DELETE FROM planned_extra_productions WHERE household_id=$1 AND id=$2 AND stock_lot_id IS NULL',[householdId,id]);
  return result.rowCount>0;
}
