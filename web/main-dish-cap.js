// Cooked mass per canonical recipe unit. Unknown mass remains unknown.
export function servedGramsPerUnit(recipe){
 if(recipe?.yield?.unitId==='g')return 1;
 const weight=Number(recipe?.servingWeightG),amount=Number(recipe?.yield?.amount);
 return weight>0&&amount>0?weight/amount:null;
}
export function capMainDish(input,maximum){
 const rows=input.map(row=>({...row})),warnings=[],conflicts=[];
 const parents=new Set(rows.filter(row=>row.role==='main'&&row.parentRecipeId).map(row=>row.parentRecipeId));
 const own=rows.filter(row=>!row.assignment&&(row.role==='main'||row.parentRecipeId&&parents.has(row.parentRecipeId)));
 const mass=row=>row.recipeUnit==='g'?1:row.servedGramsPerUnit;
 const total=()=>own.reduce((sum,row)=>sum+(Number(row.quantity)>0?Number(row.quantity)*mass(row):0),0);
 if(!Number.isFinite(maximum)||maximum<=0||!own.length)return {proposals:rows,warnings,conflicts,changed:false};
 if(own.some(row=>row.quantity>0&&!(mass(row)>0))){warnings.push('Poids cuit inconnu : le plafond total du plat principal ne peut pas être vérifié.');return {proposals:rows,warnings,conflicts:['unknown-served-weight'],changed:false};}
 const beforeGrams=total();if(beforeGrams<=maximum+1e-5)return {proposals:rows,warnings,conflicts,changed:false,beforeGrams,afterGrams:beforeGrams};
 const splitParents=new Set(own.filter(row=>row.role==='accompaniment').map(row=>row.parentRecipeId));
 const fixed=own.filter(row=>row.parentRecipeId&&splitParents.has(row.parentRecipeId)&&row.role==='main'&&row.fixedProteinEligible!==false&&['meat','fish','tofu','eggs'].some(key=>row.servingLoad?.[key]>0));
 const fixedMass=fixed.reduce((sum,row)=>sum+(Number(row.quantity)||0)*mass(row),0);
 const proteinFillsPlate=fixedMass>=maximum;
 if(proteinFillsPlate){
  conflicts.push('protein-part-exceeds-volume');
  warnings.push('La portion principale a été réduite pour tenir dans le plafond du plat.');
 }
 const protectedMass=proteinFillsPlate?0:fixedMass;
 const adjustable=proteinFillsPlate?own:own.filter(row=>!fixed.includes(row));
 const scale=(maximum-protectedMass)/(beforeGrams-protectedMass);
 for(const row of adjustable){
  const old=Number(row.quantity)||0;if(!old)continue;
  const step=row.countStep>0?row.countStep:['piece','slice'].includes(row.recipeUnit)?1:row.recipeUnit==='portion'?1:.00001;
  const quantity=Math.floor((old*scale+1e-9)/step)*step;
  if(quantity<=0){conflicts.push('indivisible-serving-exceeds-volume');row.quantity=null;continue;}
  row.quantity=Number(quantity.toFixed(5));
 }
 if(conflicts.includes('indivisible-serving-exceeds-volume'))warnings.push('Une portion entière dépasse la place disponible dans le plat : choisis une autre portion ou une autre recette.');
 if(own.some(row=>row.role==='main'&&!splitParents.has(row.parentRecipeId)&&['meat','fish','tofu','eggs'].some(key=>row.servingLoad?.[key]>0)))warnings.push('Plat mélangé : la quantité de viande, poisson, tofu ou œufs suit le poids servi.');
 warnings.push('Plat principal limité au poids cuit total ; des calories peuvent rester disponibles pour un dessert ou une collation.');
 return {proposals:rows,warnings,conflicts,changed:true,beforeGrams,afterGrams:total()};
}
