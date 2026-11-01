import {toGrams} from '../domain/foods.ts';

const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const units=new Set(['g','kg','ml','l','piece','tsp','tbsp','cup','pinch','scoop']);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function validateShoppingPreference(input) {
  if(!input||!uuid(input.householdId)||!uuid(input.foodId))return {error:'invalid-shopping-preference'};
  if(input.kind==='product'){
    if(input.purchaseFoodId===null)return {data:input};
    if(!uuid(input.purchaseFoodId)||input.purchaseFoodId===input.foodId||!units.has(input.sourceUnitId)||!units.has(input.targetUnitId)
      ||!Number.isFinite(input.factor)||input.factor<=0||input.factor>1000000)return {error:'invalid-purchase-product'};
  }else if(input.kind==='exclusion'){
    if(typeof input.excluded!=='boolean'||!(input.scope==='always'||input.scope==='period'&&date(input.startDate)&&date(input.endDate)&&input.startDate<=input.endDate
      &&(Date.parse(input.endDate)-Date.parse(input.startDate))/86400000<=62))return {error:'invalid-shopping-exclusion'};
  }else return {error:'invalid-shopping-preference'};
  return {data:input};
}
export async function listShoppingPreferences(pool,householdId) {
  const mappings=await pool.query(`SELECT p.food_id AS "foodId",f.canonical_name AS name,p.purchase_food_id AS "purchaseFoodId",t.canonical_name AS "purchaseName",
    p.source_unit_id AS "sourceUnitId",p.target_unit_id AS "targetUnitId",p.factor
    FROM household_purchase_products p JOIN foods f ON f.id=p.food_id JOIN foods t ON t.id=p.purchase_food_id WHERE p.household_id=$1 ORDER BY f.canonical_name`,[householdId]);
  const exclusions=await pool.query(`SELECT e.food_id AS "foodId",f.canonical_name AS name,e.scope FROM household_shopping_exclusions e JOIN foods f ON f.id=e.food_id
    WHERE e.household_id=$1 ORDER BY f.canonical_name,e.scope`,[householdId]);
  return {mappings:mappings.rows.map(row=>({...row,factor:Number(row.factor)})),exclusions:exclusions.rows};
}
export async function foodPurchaseMass(pool,ids) {
  if(!ids.length)return new Map();
  const result=await pool.query(`SELECT f.id AS "foodId",f.canonical_name AS name,f.grams_per_millilitre AS "gramsPerMillilitre",
    COALESCE((SELECT jsonb_object_agg(unit_id,grams_per_unit) FROM food_unit_conversions WHERE food_id=f.id),'{}'::jsonb) AS "gramsPerUnit"
    FROM foods f WHERE f.id=ANY($1::uuid[])`,[ids]);
  return new Map(result.rows.map(row=>[row.foodId,{...row,gramsPerMillilitre:row.gramsPerMillilitre==null?null:Number(row.gramsPerMillilitre),
    gramsPerUnit:Object.fromEntries(Object.entries(row.gramsPerUnit).map(([k,v])=>[k,Number(v)]))}]));
}
export async function saveShoppingPreference(pool,input) {
  const client=await pool.connect();
  try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['ingredient-stock:'+input.householdId]);
    const bad=async error=>{await client.query('ROLLBACK');return {error};};
    if(!(await client.query('SELECT id FROM households WHERE id=$1',[input.householdId])).rowCount)return await bad('household-not-found');
    const foods=await foodPurchaseMass(client,[input.foodId,...(input.purchaseFoodId?[input.purchaseFoodId]:[])]);
    if(!foods.has(input.foodId)||input.purchaseFoodId&&!foods.has(input.purchaseFoodId))return await bad('food-not-found');
    if(input.kind==='exclusion'){
      const scope=input.scope==='always'?'always':input.startDate+'/'+input.endDate;
      if(input.excluded)await client.query('INSERT INTO household_shopping_exclusions(household_id,food_id,scope) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[input.householdId,input.foodId,scope]);
      else await client.query('DELETE FROM household_shopping_exclusions WHERE household_id=$1 AND food_id=$2 AND scope=$3',[input.householdId,input.foodId,scope]);
    }else if(input.purchaseFoodId===null){
      await client.query('DELETE FROM household_purchase_products WHERE household_id=$1 AND food_id=$2',[input.householdId,input.foodId]);
    }else{
      const {mappings}=await listShoppingPreferences(client,input.householdId);
      if(mappings.some(row=>row.foodId===input.purchaseFoodId||row.purchaseFoodId===input.foodId))return await bad('purchase-product-chain');
      if(mappings.some(row=>row.foodId!==input.foodId&&row.purchaseFoodId===input.purchaseFoodId&&row.targetUnitId!==input.targetUnitId))return await bad('purchase-product-unit-conflict');
      const stock=await client.query('SELECT quantity_g,minimum_g,target_g FROM household_ingredient_stock WHERE household_id=$1 AND food_id=$2',[input.householdId,input.foodId]);
      if(stock.rows.some(row=>Number(row.quantity_g)!==0||Number(row.minimum_g)>0||Number(row.target_g)>0))return await bad('purchase-source-stock-present');
      const restorable=await client.query(`SELECT 1 FROM ingredient_stock_movements WHERE household_id=$1 AND food_id=$2
        AND reason IN ('production','production-cancelled','meal-preparation','meal-preparation-cancelled')
        GROUP BY stock_lot_id,meal_id HAVING sum(delta_g)<0 LIMIT 1`,[input.householdId,input.foodId]);
      if(restorable.rowCount)return await bad('purchase-source-history-present');
      if(!(toGrams(1,input.sourceUnitId,foods.get(input.foodId))>0)||!(toGrams(1,input.targetUnitId,foods.get(input.purchaseFoodId))>0))return await bad('ingredient-conversion-missing');
      await client.query(`INSERT INTO household_purchase_products(household_id,food_id,purchase_food_id,source_unit_id,target_unit_id,factor) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(household_id,food_id) DO UPDATE SET purchase_food_id=$3,source_unit_id=$4,target_unit_id=$5,factor=$6`,
        [input.householdId,input.foodId,input.purchaseFoodId,input.sourceUnitId,input.targetUnitId,input.factor]);
    }
    await client.query('COMMIT');return {saved:true};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

export function excludedShoppingFood(preferences,foodId,start,end) {
  return preferences.exclusions.some(row=>row.foodId===foodId&&(row.scope==='always'||row.scope===start+'/'+end));
}
function convert(quantity,from,to,food) {
  if(from===to)return Number(quantity);
  const g=toGrams(Number(quantity),from,food),unit=toGrams(1,to,food);
  return g!=null&&unit>0?g/unit:null;
}
export async function purchaseProductRequirements(pool,householdId,rows,preferences=null) {
  const {mappings}=preferences??await listShoppingPreferences(pool,householdId);
  const conversionResult=await pool.query(`SELECT source_food_id AS "sourceFoodId",target_food_id AS "targetFoodId",factor
    FROM household_food_yield_conversions WHERE household_id=$1`,[householdId]);
  const yieldConversions=conversionResult.rows.map(row=>({...row,factor:Number(row.factor)}));
  if(!mappings.length&&!yieldConversions.length)return rows;
  const foodIds=[...new Set([...mappings.flatMap(row=>[row.foodId,row.purchaseFoodId]),...yieldConversions.flatMap(row=>[row.sourceFoodId,row.targetFoodId]),...rows.map(row=>row.foodId)])];
  const foods=await foodPurchaseMass(pool,foodIds);
  const targetUnits=new Map(mappings.map(row=>[row.purchaseFoodId,row.targetUnitId])),result=new Map();
  for(const row of rows){
    const mapping=mappings.find(m=>m.foodId===row.foodId),yieldConversion=mapping?null:yieldConversions.find(item=>item.targetFoodId===row.foodId),targetId=mapping?.purchaseFoodId??yieldConversion?.sourceFoodId??row.foodId;
    const unit=mapping?.targetUnitId??(yieldConversion?null:targetUnits.get(row.foodId)),target=foods.get(targetId);
    let quantity=Number(row.quantity);
    if(mapping)quantity=convert(quantity,row.unitId,mapping.sourceUnitId,foods.get(row.foodId));
    if(quantity!=null&&mapping)quantity*=mapping.factor;
    if(!mapping&&unit)quantity=convert(quantity,row.unitId,unit,foods.get(row.foodId));
    let outputUnit=unit;
    if(yieldConversion){const grams=quantity==null?null:toGrams(quantity,row.unitId,foods.get(row.foodId));quantity=grams==null?null:grams/yieldConversion.factor;outputUnit='g';}
    const converted=(unit||yieldConversion)&&target&&quantity!=null&&Number.isFinite(quantity)&&quantity<=100000000&&(yieldConversion||toGrams(1,unit,target)>0);
    const next=converted?{...row,...target,foodId:targetId,name:target.name,unitId:outputUnit,quantity}:({...row,...(unit||yieldConversion?{mappingError:true,warning:'Regroupement non appliqué : conversion manquante'}:{})});
    const key=next.foodId+':'+next.unitId+(next.mappingError?':unresolved':'');
    if(!result.has(key))result.set(key,{...next,quantity:0,recipes:[],purchaseSources:[]});
    const item=result.get(key);item.quantity+=Number(next.quantity);
    item.recipes.push(...(row.recipes??[]));
    item.purchaseSources.push({foodId:row.foodId,name:row.name,quantity:Number(row.quantity),unitId:row.unitId});
  }
  return [...result.values()].map(row=>({...row,recipes:[...new Map(row.recipes.map(r=>[r.id,r])).values()]}));
}
