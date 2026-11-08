import { DEFAULT_MEAL_RATIOS, DEFAULT_PLATE_RATIOS, validPlateRatios, effectiveServingCaps } from './meal-config.js';
export const SLOT_RATIOS = DEFAULT_MEAL_RATIOS;

export function breakfastServingLimit(recipe,parent) {
  if(recipe?.yield?.unitId==='piece')return 2;
  if(recipe?.yield?.unitId==='portion')return 1;
  if(recipe?.yield?.unitId==='g' && parent?.yield?.unitId==='piece' && Number(parent.yield.amount)>0) {
    const weight=2*Number(recipe.yield.amount)/Number(parent.yield.amount);
    return Math.floor(weight/10)*10 || weight;
  }
  return Infinity;
}

const NATURAL_STEPS = Object.freeze({ piece: 1, portion: 0.5, g: 10 });

// A calorie envelope is a ceiling, not a reason to enlarge a batch serving.
export function mainServingLimit(recipe, parent) {
  if (!['main','vegetables'].includes(recipe?.servingPart) || recipe?.yield?.unitId !== 'g' ||
      parent?.yield?.unitId !== 'portion' || !(Number(parent.yield.amount) > 0)) return Infinity;
  const average = Number(recipe.yield.amount) / Number(parent.yield.amount);
  if (!Number.isFinite(average) || average <= 0) return Infinity;
  return Math.floor(average / NATURAL_STEPS.g) * NATURAL_STEPS.g || average;
}

export function saladServingLimit(recipe) {
  return !recipe?.parentRecipeId && recipe?.recipeType === 'salad' && ['portion','piece'].includes(recipe?.yield?.unitId) ? 1 : Infinity;
}

export function calculateWeeklyEnergyTarget(person, weekStart, latestProfile, addDays) {
  let kcal = 0;
  let daysWithTarget = 0;
  for (let day = 0; day < 7; day++) {
    const target = Number(latestProfile(person, addDays(weekStart, day))?.dailyEnergyKcal);
    if (!Number.isFinite(target) || target <= 0) continue;
    kcal += target;
    daysWithTarget++;
  }
  return { kcal: daysWithTarget === 7 ? kcal : null, partialKcal: kcal, daysWithTarget };
}

export function suggestQuantity({ dailyTargetKcal, slot, plannedOtherKcal = 0, recipeKcal, recipeUnit = 'portion', recipeCount = 1, budgetShare = 1, slotRatios = SLOT_RATIOS, preserveWholePiece=false, preserveMealTarget=false }) {
  const target = Number(dailyTargetKcal);
  const recipeEnergy = Number(recipeKcal);
  if (!Number.isFinite(target) || target <= 0) return { quantity: null, reason: 'daily-target-missing' };
  if (!Number.isFinite(recipeEnergy) || recipeEnergy <= 0) return { quantity: null, reason: 'recipe-energy-missing' };
  if (!Object.hasOwn(slotRatios, slot)) return { quantity: null, reason: 'invalid-slot' };
  if (!(slotRatios[slot]>0)) return {quantity:null,reason:'no-slot-budget',slotBudgetKcal:0};
  const remaining = Math.max(0, target - Math.max(0, Number(plannedOtherKcal) || 0));
  const mealTarget = target * slotRatios[slot];
  const available = preserveMealTarget ? Math.max(remaining, mealTarget) : remaining;
  if (!available && preserveWholePiece && recipeUnit==='piece')return {quantity:1,reason:'whole-piece-exceeds-budget',slotBudgetKcal:0,estimatedKcal:recipeEnergy};
  if (!available) return { quantity: null, reason: 'daily-budget-used' };
  const slotBudget = Math.min(mealTarget + 100, available);
  const count = Math.max(1, Math.floor(Number(recipeCount) || 1));
  const share = Math.max(0, Math.min(1, Number(budgetShare) || 0));
  const energyPerRecipe = slotBudget * share / count;
  const step = NATURAL_STEPS[recipeUnit] ?? 0.5;
  const raw = energyPerRecipe / recipeEnergy;
  const quantity = Math.floor((raw + 1e-9) / step) * step;
  if (quantity < step && preserveWholePiece && recipeUnit==='piece')return {quantity:1,reason:'whole-piece-exceeds-budget',slotBudgetKcal:slotBudget,estimatedKcal:recipeEnergy};
  if (quantity < step) return { quantity: null, reason: 'no-natural-portion-fits', slotBudgetKcal: slotBudget };
  return { quantity: Number(quantity.toFixed(4)), slotBudgetKcal: slotBudget, estimatedKcal: quantity * recipeEnergy };
}


export const MIN_PROTEIN_G_PER_MEAL = 40;

export function calculateDailyEnergy(meals, personId, date) {
  let kcal=0, knownAmounts=0, incomplete=false, hasPlan=false;
  for(const meal of meals.filter(meal=>meal.mealDate===date)) {
    if(meal.isOccasion) {
      const entry=meal.occasionEnergy?.find(value=>value.personId===personId);
      if(!entry || !Number.isFinite(Number(entry.kcal))){incomplete=true;hasPlan=true;continue;}
      kcal+=Number(entry.kcal);knownAmounts++;hasPlan=true;continue;
    }
    for(const item of meal.items ?? []) {
      const amount=item.amounts?.find(amount=>amount.personId===personId);
      if(!amount)continue;
      hasPlan=true;
      const quantity=Number(amount.quantity),energy=item.recipe?.nutrition?.perYieldUnit?.energyKcal;
      if(!Number.isFinite(quantity) || quantity<0){incomplete=true;continue;}
      if(!quantity)continue;
      if(energy==null || !Number.isFinite(Number(energy))){incomplete=true;continue;}
      kcal+=quantity*Number(energy);knownAmounts++;
      if(item.recipe?.nutrition?.complete===false)incomplete=true;
    }
  }
  return {kcal:incomplete && !knownAmounts ? null : kcal,incomplete,hasPlan};
}

const DEFAULT_DAILY_PROTEIN_TARGETS = Object.freeze({ bibinette: 90, lapinou: 125, bibou: 85, titus: 50 });

export function dailyProteinTarget(person, savedTargets = {}) {
  if (person?.id && Object.hasOwn(savedTargets, person.id)) {
    const saved = savedTargets[person.id];
    return saved == null ? null : Number(saved);
  }
  const name = String(person?.displayName ?? '').trim().toLocaleLowerCase('fr');
  return DEFAULT_DAILY_PROTEIN_TARGETS[name] ?? null;
}

export function calculateDailyProtein(meals, personId, date) {
  let grams = 0, incomplete = false, hasPlan = false;
  for (const meal of meals.filter((entry) => entry.mealDate === date)) {
    if (meal.isOccasion && meal.attendees?.some((person) => person.id === personId)) {
      hasPlan = true;
      incomplete = true;
      continue;
    }
    for (const item of meal.items ?? []) {
      const amount = item.amounts?.find((entry) => entry.personId === personId);
      if (!amount || !(Number(amount.quantity) > 0)) continue;
      hasPlan = true;
      const protein = item.recipe?.nutrition?.perYieldUnit?.proteinG;
      if (protein == null || !Number.isFinite(Number(protein))) incomplete = true;
      else grams += Number(amount.quantity) * Number(protein);
    }
  }
  return { grams: Number(grams.toFixed(2)), incomplete, hasPlan };
}

export function calculatePersonEnergy(meal, personId) {
  let kcal = 0, hasPortions = false;
  for (const item of meal?.items ?? []) {
    const amount = item.amounts?.find(entry => entry.personId === personId);
    if (!amount) continue;
    const quantity = Number(amount.quantity), energy = item.recipe?.nutrition?.perYieldUnit?.energyKcal;
    if (!Number.isFinite(quantity) || quantity < 0) return { kcal:null, known:false };
    if (!quantity) continue;
    hasPortions = true;
    if (energy == null || !Number.isFinite(Number(energy))) return { kcal:null, known:false };
    kcal += quantity * Number(energy);
  }
  return { kcal:hasPortions ? kcal : null, known:hasPortions };
}

export function calculatePersonProtein(meal, personId) {
  let grams = 0;
  let hasPortions = false;
  for (const item of meal?.items ?? []) {
    const amount = item.amounts?.find((entry) => entry.personId === personId);
    if (!amount || !(Number(amount.quantity) > 0)) continue;
    hasPortions = true;
    const protein = item.recipe?.nutrition?.perYieldUnit?.proteinG;
    if (protein == null || !Number.isFinite(Number(protein))) return { grams: null, known: false, hasPortions };
    grams += Number(amount.quantity) * Number(protein);
  }
  return { grams: hasPortions ? Number(grams.toFixed(2)) : null, known: hasPortions, hasPortions };
}

export function capAccompanimentQuantity(quantity, { recipeUnit, recipeYieldAmount }) {
  if (recipeUnit !== 'g' || !Number.isFinite(Number(quantity)) || !Number.isFinite(Number(recipeYieldAmount)) || Number(recipeYieldAmount) <= 0) return quantity;
  const maxGrams = Math.min(200, Number(recipeYieldAmount) * 1.5);
  return Math.min(Number(quantity), maxGrams);
}

export function rebalanceNaturalPortions(proposals, slotBudgetKcal, { minProteinG = MIN_PROTEIN_G_PER_MEAL } = {}) {
  const rows = proposals.map((item) => ({ ...item }));
  const budget = Number(slotBudgetKcal);
  if (!Number.isFinite(budget) || budget < 0) return { proposals: rows, withinBudget: false, proteinKnown: false, proteinTargetMet: false };
  const total = () => rows.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * item.recipeKcal, 0);
  while (total() > budget + 1e-9) {
    const candidate = ['main', 'accompaniment']
      .flatMap((role) => rows.filter((item) => item.role === role && item.quantity != null && item.quantity - item.step >= item.step))
      .sort((a, b) => b.recipeKcal / b.step - a.recipeKcal / a.step)[0];
    if (!candidate) break;
    candidate.quantity = Number((candidate.quantity - candidate.step).toFixed(4));
  }

  const proteinKnown = rows.every((item) => (Number(item.quantity) || 0) <= 0 || (item.proteinG != null && Number.isFinite(Number(item.proteinG))));
  const totalProtein = () => rows.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * (Number(item.proteinG) || 0), 0);
  if (proteinKnown) {
    while (totalProtein() < minProteinG - 1e-9) {
      const candidate = rows
        .filter((item) => ['main', 'accompaniment'].includes(item.role)
          && Number(item.proteinG) > 0
          && Number.isFinite(Number(item.recipeKcal))
          && Number(item.step) > 0
          && (Number(item.quantity) || 0) + item.step <= (item.maxQuantity==null?Infinity:Number(item.maxQuantity)) + 1e-9)
        .filter((item) => total() + item.recipeKcal * item.step <= budget + 1e-9)
        .sort((a, b) => (b.proteinG / b.recipeKcal) - (a.proteinG / a.recipeKcal))[0];
      if (!candidate) break;
      candidate.quantity = Number(((Number(candidate.quantity) || 0) + candidate.step).toFixed(4));
    }
  }
  return {
    proposals: rows,
    withinBudget: total() <= budget + 1e-9,
    estimatedKcal: total(),
    estimatedProteinG: proteinKnown ? totalProtein() : null,
    proteinKnown,
    proteinTargetMet: proteinKnown && totalProtein() >= minProteinG - 1e-9,
  };
}

// Linked parts form one adjustable plate: protein adjustments change its total
// weight, never the relative weights of meat, starch and vegetables.
export function suggestPlatePortions(proposals, budget, plateRatios=DEFAULT_PLATE_RATIOS, options={}) {
  const ratios=validPlateRatios(plateRatios)?plateRatios:DEFAULT_PLATE_RATIOS;
  const groups=new Map(), grouped=new Set(), plates=[], warnings=[];
  for(const row of proposals) {
    if(!row.parentRecipeId || !['main','accompaniment'].includes(row.role))continue;
    if(!groups.has(row.parentRecipeId))groups.set(row.parentRecipeId,[]);
    groups.get(row.parentRecipeId).push(row);
  }
  for(const members of groups.values()) {
    const expected=members[0].plateParts;
    if(!expected?.length || expected.length!==members.length
      || expected.some(part=>members.filter(row=>row.servingPart===part).length!==1)) {
      warnings.push('Parties manquantes ou répétées : proportions non appliquées à cette préparation.');continue;
    }
    if(members.some(row=>row.recipeUnit!=='g' || !(row.recipeKcal>0) || !Number.isFinite(row.recipeKcal))) {
      warnings.push('Calories inconnues : impossible de proposer une assiette selon les proportions.');continue;
    }
    const mode=expected.includes('vegetables')?'three':expected.includes('starch')?'separate':'whole';
    const shares=ratios[mode];
    const energy=members.reduce((sum,row)=>sum+shares[row.servingPart]*row.recipeKcal,0);
    const proteinKnown=members.every(row=>row.proteinG!=null && Number.isFinite(row.proteinG));
    const protein=proteinKnown?members.reduce((sum,row)=>sum+shares[row.servingPart]*row.proteinG,0):null;
    const limit=Math.min(...members.map(row=>(row.maxQuantity??Infinity)/shares[row.servingPart]));
    const maxQuantity=Number.isFinite(limit)?Math.floor((limit+1e-9)/10)*10:Infinity;
    const allocation=members.reduce((sum,row)=>sum+(row.budgetFraction??0),0);
    const quantity=Math.max(0,Math.min(maxQuantity,Math.floor((budget*allocation/energy+1e-9)/10)*10));
    plates.push({members,shares,role:'main',step:10,quantity,maxQuantity,recipeKcal:energy,proteinG:protein});
    members.forEach(row=>grouped.add(row));
  }
  if(options.proteinInformational){
    const expanded=new Map();
    for(const plate of plates){
      if(!plate.quantity)warnings.push('Aucune assiette complète ne tient dans le budget : quantités à ajuster manuellement.');
      for(const member of plate.members)expanded.set(member,{...member,quantity:plate.quantity?Number((plate.quantity*plate.shares[member.servingPart]).toFixed(4)):null});
    }
    const output=proposals.map(row=>expanded.get(row)??{...row});
    const total=()=>output.reduce((sum,row)=>sum+Math.max(0,Number(row.quantity)||0)*(Number(row.recipeKcal)||0),0);
    const desserts=output.filter(row=>row.role==='dessert' && !row.parentRecipeId && row.quantity>0 && row.recipeKcal>0);
    while(total()>budget+1e-6 && desserts.length){
      desserts.sort((a,b)=>Math.abs(a.quantity*a.recipeKcal-(total()-budget))-Math.abs(b.quantity*b.recipeKcal-(total()-budget)));
      desserts.shift().quantity=0;
    }
    let iterations=0;
    while(total()>budget+1e-6 && iterations++<10000){
      const starch=output.filter(row=>row.parentRecipeId && row.servingPart==='starch' && row.recipeUnit==='g' && row.quantity>=20 && row.recipeKcal>0)
        .sort((a,b)=>Math.abs(10*a.recipeKcal-(total()-budget))-Math.abs(10*b.recipeKcal-(total()-budget)))[0];
      if(!starch)break;
      starch.quantity=Number((starch.quantity-10).toFixed(4));
    }
    const proteinKnown=output.every(row=>!row.quantity || Number.isFinite(Number(row.proteinG)) && row.proteinG!=null);
    if(total()>budget+1e-6)warnings.push('Dépassement conservé : le plat principal et les portions indivisibles ne sont pas réduits.');
    return {proposals:output,warnings,proportionsApplied:plates.length>0,withinBudget:total()<=budget+1e-6,estimatedKcal:total(),proteinKnown,estimatedProteinG:proteinKnown?output.reduce((sum,row)=>sum+(Number(row.quantity)||0)*Number(row.proteinG),0):null,proteinTargetMet:null};
  }
  const result=rebalanceNaturalPortions([...proposals.filter(row=>!grouped.has(row)).map(row=>({...row,sourceRow:row})),...plates],budget);
  const expanded=new Map();
  for(const plate of result.proposals.filter(row=>row.members)) {
    if(!plate.quantity)warnings.push('Aucune assiette ne tient dans le budget et les plafonds : renseigne les quantités manuellement.');
    for(const member of plate.members)expanded.set(member,{...member,quantity:plate.quantity?Number((plate.quantity*plate.shares[member.servingPart]).toFixed(4)):null});
  }
  const ungrouped=new Map(result.proposals.filter(row=>!row.members).map(({sourceRow,...row})=>[sourceRow,row]));
  return {...result,warnings,proportionsApplied:plates.length>0,proposals:proposals.map(row=>expanded.get(row)??ungrouped.get(row)??row)};
}

// These caps are per person and per meal. The load is expressed per unit of
// the recipe's yield: raw grams for meat/fish, egg count, served grams for starch.

export function cappedMealPortions(proposals,budget,plateRatios=DEFAULT_PLATE_RATIOS,overrides){
  const ratios=validPlateRatios(plateRatios)?plateRatios:DEFAULT_PLATE_RATIOS;
  const rows=proposals.map(row=>({...row}));
  const remaining=effectiveServingCaps(overrides),groups=new Map(),warnings=new Set();
  const validBudget=Number.isFinite(budget)&&budget>=0&&rows.every(row=>Number.isFinite(row.recipeKcal)&&row.recipeKcal>0);
  const loads=row=>row.servingLoad??(row.servingPart==='starch'?{starch:1}:{});
  const limit=row=>{
    let max=row.maxQuantity??Infinity;
    for(const [key,value] of Object.entries(loads(row))){
      if(!Number.isFinite(remaining[key]))continue;
      if(value==null){warnings.add('Un poids cru ou une équivalence d’ingrédient manque : vérifie la portion signalée.');return 0;}
      if(value>0&&key in remaining)max=Math.min(max,remaining[key]/value);
    }
    return Math.max(0,max);
  };
  const hasFixedProtein=row=>row.role==='main'&&row.fixedProteinEligible!==false&&row.reason!=='no-slot-budget'&&['meat','fish','eggs'].some(key=>loads(row)[key]>0);
  const consume=(row,quantity)=>{
    for(const [key,value] of Object.entries(loads(row)))if(value>0&&key in remaining)remaining[key]=Math.max(0,remaining[key]-quantity*value);
  };
  const floor=(value,step=0.00001)=>Number((Math.floor((value+1e-9)/step)*step).toFixed(5));
  const fit=(row,desired,maximum=Infinity,roundNearest=false)=>{
    const cap=Math.min(limit(row),maximum);
    const countStep=row.countStep>0?row.countStep:row.recipeUnit==='piece'?1:0;
    if(countStep){
      const wanted=roundNearest?Math.round(desired/countStep)*countStep:desired;
      return floor(Math.min(wanted,cap),countStep);
    }
    return floor(Math.min(desired,cap),row.recipeUnit==='portion'&&!row.assignment?0.5:undefined);
  };
  const byRow=new Set();
  for(const row of rows)if(row.parentRecipeId&&['main','accompaniment'].includes(row.role)){
    if(!groups.has(row.parentRecipeId))groups.set(row.parentRecipeId,[]);
    groups.get(row.parentRecipeId).push(row);
  }
  const plates=[];
  if(validBudget)for(const members of groups.values()){
    const expected=members[0].plateParts;
    if(!expected?.length||expected.length!==members.length||expected.some(part=>members.filter(row=>row.servingPart===part).length!==1)||members.some(row=>row.recipeUnit!=='g')){
      warnings.add('Parties manquantes ou répétées : proportions non appliquées à cette préparation.');continue;
    }
    const mode=expected.includes('vegetables')?'three':expected.includes('starch')?'separate':'whole';
    plates.push({members,mode,shares:ratios[mode]});
    members.forEach(row=>byRow.add(row));
  }
  // Explicit additions keep their existing role in the kcal calculation.
  // Their ingredient loads still share the same per-meal limits.
  for(const row of rows.filter(row=>!byRow.has(row))){
    const fixed=hasFixedProtein(row)&&!row.assignment&&row.reason!=='no-slot-budget';
    if(row.quantity==null&&!fixed)continue;
    const desired=fixed?limit(row):Math.max(0,Number(row.quantity)||0);
    row.quantity=fit(row,desired);
    if(row.quantity+1e-5<desired&&Object.keys(loads(row)).length)warnings.add('Une portion a été réduite pour respecter les plafonds ou les unités.');
    if(!row.quantity&&desired>0&&!row.assignment)row.quantity=null;
    consume(row,row.quantity??0);
  }
  const total=()=>rows.reduce((sum,row)=>sum+(Number(row.quantity)||0)*(Number(row.recipeKcal)||0),0);
  const plateWeight=({members})=>members.reduce((sum,row)=>sum+(row.budgetFraction??0),0)||1;
  const extrasKcal=rows.filter(row=>!byRow.has(row)).reduce((sum,row)=>sum+(Number(row.quantity)||0)*(Number(row.recipeKcal)||0),0);
  const availableForPlates=Math.max(0,budget-extrasKcal);
  const totalPlateWeight=plates.reduce((sum,plate)=>sum+plateWeight(plate),0);
  for(const plate of plates){
    const {members,mode,shares}=plate;
    const kcal=availableForPlates*plateWeight(plate)/totalPlateWeight;
    const energy=members.reduce((sum,row)=>sum+shares[row.servingPart]*row.recipeKcal,0);
    let left=kcal;
    const put=(row,quantity)=>{
      row.quantity=quantity;consume(row,quantity);left-=quantity*row.recipeKcal;
    };
    const main=members.find(row=>row.servingPart==='main');
    const starch=members.find(row=>row.servingPart==='starch');
    const veg=members.find(row=>row.servingPart==='vegetables');
    const fixed=hasFixedProtein(main);
    if(fixed)put(main,fit(main,limit(main)));
    if(mode==='three'){
      if(!fixed)put(main,fit(main,kcal/energy*shares.main,left/main.recipeKcal,true));
      const ratio=shares.vegetables/shares.starch;
      let starchTarget=Math.max(0,Math.min(left/(starch.recipeKcal+ratio*veg.recipeKcal),limit(veg)/ratio));
      // If both sides draw on the same cap, reserve their joint load at the
      // configured ratio before assigning either side.
      for(const key of Object.keys(remaining)){
        const use=(loads(starch)[key]??0)+ratio*(loads(veg)[key]??0);
        if(use>0)starchTarget=Math.min(starchTarget,remaining[key]/use);
      }
      put(starch,fit(starch,starchTarget));
      put(veg,fit(veg,starch.quantity*ratio,Math.max(0,left)/veg.recipeKcal));
    }else{
      const ordered=members.filter(row=>!fixed||row!==main).sort((a,b)=>Number(b.countStep>0)-Number(a.countStep>0));
      for(const row of ordered)put(row,fit(row,kcal/energy*shares[row.servingPart],Math.max(0,left)/row.recipeKcal,true));
      if(mode==='separate')for(const row of fixed?[starch]:[starch,main]){
        if(!(left>1e-7))break;
        const delta=fit({...row,maxQuantity:Math.max(0,(row.maxQuantity??Infinity)-row.quantity)},left/row.recipeKcal);
        row.quantity=Number((row.quantity+delta).toFixed(5));
        consume(row,delta);left-=delta*row.recipeKcal;
      }
    }
    if(left>1)warnings.add('Le budget kcal peut rester partiellement inutilisé lorsque les plafonds ou les unités sont atteints.');
    if(members.some(row=>!row.quantity))warnings.add('Une partie ne tient pas dans les plafonds ou le budget : vérifie les quantités proposées.');
    for(const row of members)if(!row.quantity)row.quantity=null;
  }
  if(validBudget){
    for(const dessert of rows.filter(row=>row.role==='dessert'&&!row.parentRecipeId&&row.quantity>0)){
      if(total()<=budget+1e-6)break;
      dessert.quantity=0;
    }
    while(total()>budget+1e-6){
      const row=rows.find(r=>r.parentRecipeId&&r.servingPart==='starch'&&r.quantity>=(r.countStep||10)*2);
      if(!row)break;
      const veg=plates.find(plate=>plate.mode==='three'&&plate.members.includes(row))?.members.find(member=>member.servingPart==='vegetables');
      const before=row.quantity;
      row.quantity=Number((before-(row.countStep||10)).toFixed(5));
      if(veg?.quantity>0)veg.quantity=floor(veg.quantity*row.quantity/before,veg.countStep||0.00001);
    }
  }
  const roundedRemaining=effectiveServingCaps(overrides);
  const keys=Object.keys(roundedRemaining);
  for(const row of rows)for(const key of keys)roundedRemaining[key]-=(loads(row)[key]??0)*(row.quantity??0);
  const beforeRounding=total();
  const roundUp=value=>Math.ceil((value-1e-8)/10)*10;
  for(const {members,shares} of plates){
    const starch=members.find(row=>row.servingPart==='starch');
    if(!starch)continue;
    const veg=members.find(row=>row.servingPart==='vegetables');
    const roundedStarch=starch.quantity>0&&!starch.countStep?roundUp(starch.quantity):starch.quantity;
    const roundedVeg=veg?.quantity>0&&!veg.countStep
      ?roundUp(Math.max(veg.quantity,roundedStarch*shares.vegetables/shares.starch)):veg?.quantity;
    const changes=[[starch,roundedStarch]];
    if(veg)changes.push([veg,roundedVeg]);
    const extraLoad=key=>changes.reduce((sum,[row,quantity])=>sum+(loads(row)[key]??0)*((quantity??0)-(row.quantity??0)),0);
    if(changes.every(([row,quantity])=>(quantity??0)<=(row.maxQuantity??Infinity))&&keys.every(key=>extraLoad(key)<=roundedRemaining[key]+1e-8)){
      for(const key of keys)roundedRemaining[key]-=extraLoad(key);
      for(const [row,quantity] of changes)row.quantity=quantity;
    }
    if(starch.recipeUnit==='g'&&!starch.countStep&&(starch.quantity??0)*(loads(starch).starch??0)<80-1e-5)
      warnings.add('Le repère de 80 g de féculents cuits ne tient pas dans le budget ou les plafonds de cette assiette.');
  }
  if(validBudget&&beforeRounding<=budget+1e-6&&total()>budget+1e-6)
    warnings.add('L’arrondi des accompagnements dépasse le budget de calcul.');
  return {proposals:rows,warnings:[...warnings],proportionsApplied:plates.length>0,withinBudget:!validBudget||total()<=budget+1e-6,proteinKnown:rows.every(row=>!row.quantity||row.proteinG!=null)};
}
