import { createHash } from 'node:crypto';
import { readRecipe } from './recipes.mjs';
import { lockHouseholdInventory } from './ingredient-stock.mjs';
import { breakfastServingLimit } from '../../web/portion-planner.js';

const steps={g:10,ml:10,piece:1,portion:0.5};
export function isAdultOn(birthDate,date) {
  if(!birthDate)return false;
  const adultFrom=(Number(birthDate.slice(0,4))+18)+birthDate.slice(4);
  return adultFrom<=date;
}
export function rebalanceDailyEnergy(input,people) {
  const rows=input.map(row=>({...row})),changes=[],results=[];
  for(const person of people) {
    const own=rows.filter(row=>row.personId===person.id && row.quantity>0);
    const before=own.reduce((sum,row)=>sum+row.quantity*(row.energyKcal ?? 0),0);
    const result={personId:person.id,name:person.name,targetKcal:person.targetKcal,beforeKcal:before,afterKcal:before,reason:null};results.push(result);
    if(person.reason){result.reason=person.reason;continue;}
    if(own.some(row=>row.energyKcal==null || !Number.isFinite(row.energyKcal) || row.complete===false)){result.reason='incomplete-nutrition';continue;}
    for(const row of own.filter(row=>row.slot==='breakfast' && row.role==='main')) {
      if(Number.isFinite(row.breakfastLimit) && row.quantity>row.breakfastLimit)row.quantity=row.breakfastLimit;
    }
    const afterBreakfast=own.reduce((sum,row)=>sum+row.quantity*row.energyKcal,0);result.afterKcal=afterBreakfast;
    if(afterBreakfast<=person.targetKcal+1e-6)continue;
    const meals=new Map();
    for(const row of own.filter(row=>['lunch','dinner'].includes(row.slot))) {
      if(!meals.has(row.mealId))meals.set(row.mealId,{rows:[],removed:0,energy:0});
      const group=meals.get(row.mealId);group.rows.push(row);group.energy+=row.quantity*row.energyKcal;
    }
    let current=afterBreakfast;
    for(const group of meals.values()) {
      group.proteinKnown=group.rows.every(row=>row.proteinG!=null && Number.isFinite(row.proteinG));
      group.protein=group.rows.reduce((sum,row)=>sum+row.quantity*(row.proteinG ?? 0),0);
      group.minimumProtein=Math.min(40,group.protein);
    }
    let iterations=0;
    while(current>person.targetKcal+1e-6 && iterations++<10000) {
      const candidates=[];
      for(const group of meals.values()) {
        if(!group.proteinKnown)continue;
        const linked=new Map(),handled=new Set();
        for(const row of group.rows) {
          if(!row.parentRecipeId || row.unitId!=='g' || !['main','accompaniment'].includes(row.role))continue;
          if(!linked.has(row.parentRecipeId))linked.set(row.parentRecipeId,[]);
          linked.get(row.parentRecipeId).push(row);
        }
        for(const members of linked.values()) {
          const parts=members[0].plateParts;
          if(!parts?.length || parts.length!==members.length || parts.some(part=>members.filter(row=>row.servingPart===part).length!==1))continue;
          members.forEach(row=>handled.add(row));
          const weight=members.reduce((sum,row)=>sum+row.quantity,0);
          const reductions=members.map(row=>({row,step:10*row.quantity/weight}));
          if(reductions.some(({row,step})=>row.quantity-step<1 || !(row.energyKcal>0)))continue;
          const protein=reductions.reduce((sum,{row,step})=>sum+step*row.proteinG,0);
          if(group.protein-protein<group.minimumProtein-1e-6)continue;
          candidates.push({row:members[0],group,reductions,protein,kcal:reductions.reduce((sum,{row,step})=>sum+step*row.energyKcal,0)});
        }
        for(const row of group.rows) {
          if(handled.has(row))continue;
          const step=steps[row.unitId];
          if(!['main','accompaniment'].includes(row.role) || !step || row.quantity-step<step-1e-9 || !(row.energyKcal>0))continue;
          if(group.protein-step*row.proteinG<group.minimumProtein-1e-6)continue;
          candidates.push({row,group,step,kcal:step*row.energyKcal});
        }
      }
      const excess=current-person.targetKcal;
      candidates.sort((a,b)=>
        Math.max(0,a.kcal-excess)-Math.max(0,b.kcal-excess)
        || a.group.removed/Math.max(a.group.energy,1)-b.group.removed/Math.max(b.group.energy,1)
        || a.row.proteinG/a.row.energyKcal-b.row.proteinG/b.row.energyKcal
        || a.row.itemId.localeCompare(b.row.itemId));
      const next=candidates[0];if(!next)break;
      for(const {row,step} of next.reductions??[{row:next.row,step:next.step}])row.quantity=Number((row.quantity-step).toFixed(6));
      next.group.removed+=next.kcal;next.group.protein-=next.protein??next.step*next.row.proteinG;current-=next.kcal;
    }
    result.afterKcal=Number(current.toFixed(6));
    if(current>person.targetKcal+1e-6)result.reason='cannot-fully-rebalance';
  }
  for(let i=0;i<rows.length;i++)if(rows[i].quantity!==input[i].quantity) {
    const {itemId,mealId,personId,recipeName,slot,unitId}=rows[i];
    changes.push({itemId,mealId,personId,recipeName,slot,unitId,before:input[i].quantity,after:rows[i].quantity});
  }
  return {results,changes};
}

export async function previewDailyRebalance(pool,householdId,date) {
  const amounts=await pool.query(`SELECT i.id AS item_id,i.recipe_id,i.meal_id,i.role,m.slot,a.person_id,a.quantity
    FROM planned_amounts a JOIN planned_meal_items i ON i.id=a.planned_item_id JOIN planned_meals m ON m.id=i.meal_id
    WHERE m.household_id=$1 AND m.meal_date=$2 ORDER BY m.id,i.id,a.person_id`,[householdId,date]);
  const peopleResult=await pool.query(`SELECT p.id,p.display_name,p.birth_date::text AS birth_date,p.active,
    (SELECT daily_energy_kcal FROM person_profile_history ph WHERE ph.person_id=p.id AND ph.effective_from<=$2 ORDER BY effective_from DESC LIMIT 1) AS target
    FROM people p WHERE p.household_id=$1 ORDER BY p.id`,[householdId,date]);
  const savingResult=await pool.query('SELECT person_id,daily_kcal FROM energy_saving_plans WHERE household_id=$1 AND starts_on<=$2 AND ends_on>=$2',[householdId,date]);
  const extraSavings=new Map(savingResult.rows.map(row=>[row.person_id,Number(row.daily_kcal)]));
  const recipes=new Map(),rows=[];
  for(const item of amounts.rows) {
    if(!recipes.has(item.recipe_id))recipes.set(item.recipe_id,await readRecipe(pool,item.recipe_id));
    const recipe=recipes.get(item.recipe_id),nutrition=recipe?.nutrition;
    let parent;
    if(recipe?.parentRecipeId) {
      if(!recipes.has(recipe.parentRecipeId))recipes.set(recipe.parentRecipeId,await readRecipe(pool,recipe.parentRecipeId));
      parent=recipes.get(recipe.parentRecipeId);
    }
    rows.push({itemId:item.item_id,mealId:item.meal_id,personId:item.person_id,slot:item.slot,role:item.role ?? 'main',quantity:Number(item.quantity),recipeName:recipe?.name ?? 'Recette supprimée',unitId:recipe?.yield.unitId,energyKcal:nutrition?.perYieldUnit.energyKcal ?? null,proteinG:nutrition?.perYieldUnit.proteinG ?? null,complete:nutrition?.complete ?? false,breakfastLimit:breakfastServingLimit(recipe,parent),parentRecipeId:recipe?.parentRecipeId,servingPart:recipe?.servingPart,plateParts:parent?.servingParts?.map(part=>part.servingPart)});
  }
  const people=peopleResult.rows.filter(person=>amounts.rows.some(row=>row.person_id===person.id)).map(person=>({id:person.id,name:person.display_name,targetKcal:person.target==null?null:Number(person.target)-Number(extraSavings.get(person.id)??0),reason:!person.active?'inactive-profile':!person.birth_date?'age-missing':!isAdultOn(person.birth_date,date)?'minor-profile':!(Number(person.target)>Number(extraSavings.get(person.id)??0))?'target-missing':null}));
  const preview=rebalanceDailyEnergy(rows,people);
  const token=createHash('sha256').update(JSON.stringify({householdId,date,rows,people,preview})).digest('hex');
  return {date,...preview,token};
}
export async function applyDailyRebalance(pool,householdId,date,token) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await lockHouseholdInventory(client,householdId);
    await client.query('SELECT id FROM recipes WHERE household_id=$1 ORDER BY id FOR SHARE',[householdId]);
    await client.query(`SELECT a.planned_item_id FROM planned_amounts a JOIN planned_meal_items i ON i.id=a.planned_item_id JOIN planned_meals m ON m.id=i.meal_id WHERE m.household_id=$1 AND m.meal_date=$2 FOR UPDATE OF a`,[householdId,date]);
    const preview=await previewDailyRebalance(client,householdId,date);
    if(preview.token!==token){await client.query('ROLLBACK');return {error:'rebalance-preview-stale'};}
    for(const change of preview.changes)await client.query('UPDATE planned_amounts SET quantity=$3 WHERE planned_item_id=$1 AND person_id=$2',[change.itemId,change.personId,change.after]);
    for(const mealId of new Set(preview.changes.map(change=>change.mealId)))await client.query('UPDATE planned_meals SET updated_at=now() WHERE id=$1',[mealId]);
    await client.query('COMMIT');return {applied:preview.changes.length,results:preview.results};
  }catch(error){await client.query('ROLLBACK');if(error.code==='40001')return {error:'rebalance-preview-stale'};throw error;}finally{client.release();}
}
