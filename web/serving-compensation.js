// Post-processing only: the original gram planner remains unchanged.
// All quantities and energy densities below are canonical grams and kcal/g.
export function compensateServingCalories(rows, before, after) {
  if (rows.some((row,i)=>before[i]==null || after[i]==null || !Number.isFinite(Number(before[i])) || !Number.isFinite(Number(after[i])) || Number(before[i])<=0 || Number(after[i])<=0 || !(row.recipeKcal>0) || !Number.isFinite(Number(row.recipeKcal))))
    return {ok:false,reason:'Calories ou quantités manquantes : compensation impossible.'};
  const free=rows.map((row,i)=>({row,i})).filter(({row})=>!row.countStep && row.recipeUnit==='g');
  const soup=free.find(({row})=>row.servingPart==='vegetables') ?? (free.length===1?free[0]:null);
  if(!soup)return {ok:false,reason:'Aucune partie en grammes disponible pour compenser les calories.'};
  const target=rows.reduce((sum,row,i)=>sum+Number(before[i])*row.recipeKcal,0);
  const other=rows.reduce((sum,row,i)=>sum+(i===soup.i?0:Number(after[i])*row.recipeKcal),0);
  const grams=(target-other)/soup.row.recipeKcal;
  if(!(grams>0))return {ok:false,reason:'Ces unités ne laissent plus de calories pour une portion en grammes positive. Réduis les unités ou ajuste le repas.'};
  const quantities=after.map(Number);
  quantities[soup.i]=Math.round(Math.max(0,grams)*1e5)/1e5;
  return {ok:true,quantities,adjustedIndex:soup.i,targetKcal:target};
}

function complete(rows) {
  const expected=rows[0]?.plateParts;
  return expected?.length===rows.length && expected.every(part=>rows.filter(row=>row.servingPart===part).length===1);
}

export function roundServingCalories(proposals) {
  const output=proposals.map(row=>({...row})),groups=new Map(),warnings=[];
  for(const row of output)if(row.parentRecipeId && ['main','accompaniment'].includes(row.role)){
    if(!groups.has(row.parentRecipeId))groups.set(row.parentRecipeId,[]);
    groups.get(row.parentRecipeId).push(row);
  }
  for(const rows of groups.values()){
    if(!rows.some(row=>row.countStep>0))continue;
    if(!complete(rows)){warnings.push('Parties manquantes ou répétées : quantités initiales conservées, sans arrondi automatique.');continue;}
    const before=rows.map(row=>row.quantity);
    const rounded=rows.map(row=>row.countStep>0 && row.quantity!=null?Math.max(1,Math.round(row.quantity/row.countStep))*row.countStep:row.quantity);
    const result=compensateServingCalories(rows,before,rounded);
    if(!result.ok){warnings.push(result.reason+' Quantités initiales conservées.');continue;}
    rows.forEach((row,i)=>{row.quantity=result.quantities[i];});
  }
  return {proposals:output,warnings};
}

// A manual edit compensates against the immediately preceding canonical values;
// it never runs the planner or changes another person's meal.
export function compensateManualServing(items, recipes, recipeId, personId, previousQuantity) {
  const recipe=recipes.find(entry=>entry.id===recipeId);
  if(!recipe?.parentRecipeId || !recipe.servingDisplay)return {ok:false,reason:''};
  const parent=recipes.find(entry=>entry.id===recipe.parentRecipeId);
  if(!parent)return {ok:false,reason:'Recette parente absente : compensation impossible.'};
  const entries=Object.entries(items).flatMap(([key,item])=>{
    const part=recipes.find(entry=>entry.id===item.recipeId);
    return part?.parentRecipeId===parent?.id && ['main','accompaniment'].includes(item.role??'main')
      ?[{key,item,part,servingPart:part.servingPart,recipeUnit:part.yield.unitId,countStep:part.servingDisplay?.gramsPerUnit,
        recipeKcal:part.nutrition?.perYieldUnit?.energyKcal,plateParts:parent.servingParts?.map(p=>p.servingPart)}]:[];
  });
  if(!complete(entries))return {ok:false,reason:'Parties manquantes ou répétées : compensation impossible.'};
  const after=entries.map(({item})=>item.amounts?.[personId] === ''?null:item.amounts?.[personId]);
  const before=after.map((q,i)=>entries[i].part.id===recipeId?previousQuantity:q);
  const result=compensateServingCalories(entries,before,after);
  return result.ok?{...result,itemKey:entries[result.adjustedIndex].key,quantity:result.quantities[result.adjustedIndex]}:result;
}
