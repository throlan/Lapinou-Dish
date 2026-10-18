import {DEFAULT_PLATE_RATIOS,validPlateRatios} from './meal-config.js';

// Compare nearby whole-unit combinations jointly. Free gram services follow
// the combined counted weight, instead of retaining their pre-rounding weight.
export function coordinateCountedPlate(members,shares,idealWeight,budgetKcal) {
  if(!(idealWeight>0) || !(budgetKcal>0))return null;
  const counted=members.map((row,index)=>({...row,index})).filter(row=>row.countStep>0);
  const countedShare=counted.reduce((sum,row)=>sum+shares[row.servingPart],0);
  if(!counted.length || !(countedShare>0))return null;
  const choices=counted.map(row=>{
    const ideal=idealWeight*shares[row.servingPart]/row.countStep;
    return [...new Set([Math.floor(ideal)-1,Math.floor(ideal),Math.ceil(ideal),Math.ceil(ideal)+1])]
      .filter(n=>n>=1 && n*row.countStep<=(row.maxQuantity??Infinity)+1e-8);
  });
  let best=null;
  function consider(counts){
    const quantities=members.map(()=>0);
    counted.forEach((row,i)=>{quantities[row.index]=counts[i]*row.countStep;});
    const referenceWeight=quantities.reduce((sum,q)=>sum+q,0)/countedShare;
    members.forEach((row,i)=>{if(!(row.countStep>0))quantities[i]=Math.round(referenceWeight*shares[row.servingPart]*100)/100;});
    if(members.some((row,i)=>!(quantities[i]>0) || quantities[i]>(row.maxQuantity??Infinity)+1e-8))return;
    const kcal=members.reduce((sum,row,i)=>sum+quantities[i]*row.recipeKcal,0);
    if(kcal>budgetKcal+1e-8)return;
    const total=quantities.reduce((sum,q)=>sum+q,0);
    const deviation=members.reduce((sum,row,i)=>sum+Math.abs(quantities[i]/total-shares[row.servingPart]),0);
    const distance=Math.abs(total-idealWeight);
    if(!best || deviation<best.deviation-1e-8 || (Math.abs(deviation-best.deviation)<=1e-8 && distance<best.distance-1e-8))best={quantities,deviation,distance,kcal};
  }
  function combinations(index,counts=[]){
    if(index===choices.length){consider(counts);return;}
    for(const count of choices[index])combinations(index+1,[...counts,count]);
  }
  combinations(0);
  return best;
}

// Percentages always use canonical estimated grams, never a mix of grams,
// egg counts and slice counts. Missing/repeated services remain explicit.
export function plateComposition(items,personId,recipes,plateRatios=DEFAULT_PLATE_RATIOS) {
  const ratios=validPlateRatios(plateRatios)?plateRatios:DEFAULT_PLATE_RATIOS;
  const groups=new Map();
  for(const item of items??[]){
    const recipe=item.recipe,parent=recipes.find(r=>r.id===recipe?.parentRecipeId);
    if(!parent || !(parent.servingParts?.length>1))continue;
    if(!groups.has(parent.id))groups.set(parent.id,{parent,rows:[]});
    const amount=item.amounts?.find(a=>a.personId===personId);
    groups.get(parent.id).rows.push({part:recipe.servingPart,unit:recipe.yield?.unitId,quantity:amount?.quantity});
  }
  return [...groups.values()].map(({parent,rows})=>{
    const keys=parent.servingParts.map(part=>part.servingPart);
    const complete=rows.length===keys.length && keys.every(key=>rows.filter(row=>row.part===key).length===1)
      && rows.every(row=>row.unit==='g' && row.quantity!=null && Number.isFinite(Number(row.quantity)) && Number(row.quantity)>0);
    if(!complete)return {name:parent.name,complete:false,parts:[]};
    const total=rows.reduce((sum,row)=>sum+Number(row.quantity),0);
    const shares=ratios[keys.includes('vegetables')?'three':'separate'];
    const parts=keys.map(key=>{const grams=Number(rows.find(row=>row.part===key).quantity),percent=grams/total*100,targetPercent=shares[key]*100;
      return {key,grams,percent,targetPercent,deltaPoints:percent-targetPercent};});
    return {name:parent.name,complete:true,total,parts,exact:parts.every(part=>Math.abs(part.deltaPoints)<0.01)};
  });
}
