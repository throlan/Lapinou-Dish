import { toGrams } from '../domain/foods.ts';

const uuid=value=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const units=new Set(['g','kg','ml','l','piece','tsp','tbsp','cup','pinch','scoop']);

export function validatePurchaseUnit(input) {
  if(!input || !uuid(input.householdId) || !uuid(input.foodId))return {error:'invalid-purchase-unit'};
  for(const key of ['singularLabel','pluralLabel']) {
    if(typeof input[key]!=='string' || !input[key].trim() || input[key].trim().length>60)return {error:'invalid-purchase-unit'};
  }
  if(!Number.isFinite(input.coveredQuantity) || input.coveredQuantity<=0 || input.coveredQuantity>100000000
    || !units.has(input.coveredUnitId))return {error:'invalid-purchase-unit'};
  if(input.estimateNote!=null && (typeof input.estimateNote!=='string' || input.estimateNote.length>160))return {error:'invalid-purchase-unit'};
  return {data:{householdId:input.householdId,foodId:input.foodId,
    singularLabel:input.singularLabel.trim(),pluralLabel:input.pluralLabel.trim(),
    coveredQuantity:input.coveredQuantity,coveredUnitId:input.coveredUnitId,estimateNote:input.estimateNote?.trim()??''}};
}

export async function listPurchaseUnits(pool,householdId) {
  const result=await pool.query(`SELECT food_id AS "foodId",singular_label AS "singularLabel",plural_label AS "pluralLabel",
    covered_quantity AS "coveredQuantity",covered_unit_id AS "coveredUnitId",estimate_note AS "estimateNote"
    FROM household_food_purchase_units WHERE household_id=$1`,[householdId]);
  return result.rows.map(row=>({...row,coveredQuantity:Number(row.coveredQuantity)}));
}

export async function savePurchaseUnit(pool,input) {
  const result=await pool.query(`INSERT INTO household_food_purchase_units
    (household_id,food_id,singular_label,plural_label,covered_quantity,covered_unit_id,estimate_note)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(household_id,food_id) DO UPDATE SET singular_label=EXCLUDED.singular_label,
      plural_label=EXCLUDED.plural_label,covered_quantity=EXCLUDED.covered_quantity,
      covered_unit_id=EXCLUDED.covered_unit_id,estimate_note=EXCLUDED.estimate_note,updated_at=now()
    RETURNING food_id AS "foodId"`,[input.householdId,input.foodId,input.singularLabel,input.pluralLabel,
    input.coveredQuantity,input.coveredUnitId,input.estimateNote]);
  return result.rows[0]??null;
}

export async function deletePurchaseUnit(pool,householdId,foodId) {
  const result=await pool.query('DELETE FROM household_food_purchase_units WHERE household_id=$1 AND food_id=$2',[householdId,foodId]);
  return result.rowCount>0;
}

function inTargetUnit(row,unitId) {
  if(row.unitId===unitId)return Number(row.quantity);
  const grams=toGrams(Number(row.quantity),row.unitId,row);
  const gramsPerTarget=toGrams(1,unitId,row);
  return grams!=null && gramsPerTarget!=null && gramsPerTarget>0?grams/gramsPerTarget:null;
}

// Combine only lines whose unit relation is documented for this food.
export function applyPurchaseUnits(rows,rules) {
  const byFood=new Map();for(const row of rows){if(!byFood.has(row.foodId))byFood.set(row.foodId,[]);byFood.get(row.foodId).push(row);}
  const ruleByFood=new Map(rules.map(rule=>[rule.foodId,rule]));
  const result=[];
  for(const group of byFood.values()) {
    const rule=ruleByFood.get(group[0].foodId);
    if(!rule){result.push(...group);continue;}
    const converted=[],unconverted=[];
    for(const row of group){const quantity=inTargetUnit(row,rule.coveredUnitId);
      if(quantity===null)unconverted.push({...row,purchaseRule:rule,purchaseRuleApplied:false,
        warning:[row.warning,`Unité d’achat non appliquée : conversion ${row.unitId} → ${rule.coveredUnitId} inconnue`].filter(Boolean).join(' · ')});
      else converted.push({...row,convertedQuantity:quantity});
    }
    if(converted.length){const first=converted[0];result.push({...first,unitId:rule.coveredUnitId,
      quantity:converted.reduce((sum,row)=>sum+row.convertedQuantity,0),
      recipes:converted.flatMap(row=>row.recipes??[]),
      sourceNeeds:converted.map(row=>({quantity:Number(row.quantity),unitId:row.unitId})),
      purchaseRule:rule,purchaseRuleApplied:true,
      warning:[...new Set(converted.map(row=>row.warning).filter(Boolean))].join(' · ')||undefined});}
    result.push(...unconverted);
  }
  return result;
}
