import candidates from './catalogue-estimate-candidates.json' with {type:'json'};
import sourced from './catalogue-proposals.json' with {type:'json'};

const cookingCodes=new Set(candidates.cooking);
const densityCodes=new Set(candidates.density);
const yieldSource='https://www.ars.usda.gov/ARSUserFiles/80400530/pdf/ah102.pdf';
const meatSource='https://www.ars.usda.gov/ARSUserFiles/80400525/articles/icomst2012_meatcookingyield2.pdf';
const volumeSource='https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/methods-and-application-of-food-composition-laboratory/mafcl-site-pages/measurement-conversion-tables';
const exact=new Map();
for(const proposal of sourced){
  if(proposal.referenceOnly)continue;
  const key=`${proposal.code}:${proposal.field}`;
  if(!exact.has(key))exact.set(key,[]);
  exact.get(key).push(proposal);
}

function estimate(value,source,method,url,uncertainty='élevée'){
  return {value,source,method,url,uncertainty};
}

function cookingEstimate(food){
  const category=food.foodCategory,name=food.name.toLocaleLowerCase('fr');
  if(category==='Viandes')return estimate(.75,'USDA, rendements viandes et volailles','Moyenne de travail pour une cuisson courante ; la découpe et la méthode peuvent changer le rendement. Pour le filet de poulet, moyenne de 0,72 au four et 0,77 poché, arrondie à 0,75.',meatSource);
  if(category==='Charcuteries'){
    if(/jambon cru/.test(name))return null;
    return estimate(.8,'USDA AH-102','Approximation pour une charcuterie à cuire ; vérifier la préparation et le produit.',yieldSource);
  }
  if(category==='Poissons'||category==='Fruits de mer')return estimate(.8,'USDA AH-102','Approximation de cuisson d’une partie comestible ; vérifier peau, arêtes, coquille et méthode.',yieldSource);
  if(category==='Légumes')return estimate(/épinard|bette|blette|salade|batavia|laitue|mâche|roquette|oseille/.test(name)?.65:.9,'USDA AH-102','Approximation pour cuisson à l’eau ou vapeur ; les légumes feuilles perdent davantage de volume et le rendement varie selon égouttage.',yieldSource);
  if(category==='Féculents'){
    const value=/gnocchi/.test(name)?1.2:/précuit|precuit/.test(name)?2:/polenta|semoule|couscous/.test(name)?2.5:/pâtes/.test(name)?2.5:2.7;
    return estimate(value,'USDA AH-102','Approximation après cuisson à l’eau et égouttage ; vérifier le type de grain ou de pâte et la durée.',yieldSource);
  }
  if(category==='Légumineuses')return estimate(/frais|fraîch|surgelé/.test(name)?.95:2.4,'USDA AH-102','Approximation après cuisson à l’eau et égouttage ; les produits frais ou surgelés ne reçoivent pas le rendement des grains secs.',yieldSource);
  if(category==='Tubercules')return estimate(/tapioca/.test(name)?3:.95,'USDA AH-102','Approximation pour cuisson à l’eau ou vapeur ; les préparations préfrites et la friture ont un rendement différent.',yieldSource);
  return null;
}

function densityEstimate(food){
  const category=food.foodCategory,name=food.name.toLocaleLowerCase('fr');
  let value=null;
  if(category==='Huiles')value=.92;
  else if(category==='Eaux')value=1;
  else if(category==='Laits'||category==='Crèmes')value=1.03;
  else if(category==='Boissons sans alcool')value=/sirop|concentré/.test(name)?1.25:1.02;
  else if(category==='Boissons alcoolisées')value=.98;
  else if(category==='Sauces')value=1.05;
  else if(category==='Condiments')value=/vinaigre/.test(name)?1.01:1.05;
  else if(category==='Sucres et miels')value=1.4;
  return value==null?null:estimate(value,'Estimation de densité par famille','Densité indicative en g/ml, sans mesure du produit exact ; à remplacer par une pesée si la précision est importante.',volumeSource);
}

function manualCategory(food){
  if(food.source==='ciqual'||food.foodCategory)return null;
  const name=food.name.toLocaleLowerCase('fr');
  const groups=[
    [/whey|isolate/,'Whey'],[/farine/,'Farines'],[/flocons|psyllium/,'Céréales et fibres'],[/skyr|fromage blanc|cottage cheese/,'Laitages'],[/mozzarella/,'Fromages'],[/saumon/,'Poissons'],[/fraise|fruits rouges|mangue/,'Fruits'],[/patate douce/,'Tubercules'],[/poivron/,'Légumes'],[/sésame|amande|coco rapée/,'Graines et oléagineux'],[/lait d.avoine/,'Boissons sans alcool'],[/bouillon|court-bouillon/,'Aides culinaires'],[/assaisonnement|épices|garam masala|oignon en poudre/,'Épices'],[/sriracha|passata|vinaigre/,'Condiments'],[/spaghetti|cannelloni|canelloni|lasagne|feuilles de riz/,'Féculents'],[/andouillette/,'Charcuteries'],[/tortilla|naan/,'Pains'],[/nesquik|pépites de chocolat/,'Chocolats et confiseries'],[/glaçons/,'Eaux']
  ];
  return groups.find(([pattern])=>pattern.test(name))?.[1]??null;
}

export function estimatesForFood(food){
  const proposals={};
  for(const field of ['cookingFactor','gramsPerMillilitre','tspGrams','tbspGrams','pinchGrams','scoopGrams','pieceGrams']){
    const matches=food.source==='ciqual'?exact.get(`${food.code}:${field}`)??[]:[];
    if(matches.length){
      const values=matches.map(item=>item.value);
      const value=food.code==='36017'&&field==='cookingFactor'?.75:Number((values.reduce((sum,item)=>sum+item,0)/values.length).toFixed(3));
      proposals[field]=food.code==='36017'&&field==='cookingFactor'
        ?estimate(.75,'USDA, rendements viandes et volailles (2012)','Moyenne arrondie de 0,72 au four et 0,77 poché, choisie comme approximation par le foyer ; la méthode exacte reste variable.',matches[0].url,'élevée')
        :estimate(value,matches.map(item=>item.source).join(' ; '),matches.map(item=>item.method).join(' ; '),matches[0].url,matches.some(item=>item.uncertainty==='élevée')?'élevée':matches[0].uncertainty);
    }
  }
  if(food.source==='ciqual'&&cookingCodes.has(food.code)&&!proposals.cookingFactor)proposals.cookingFactor=cookingEstimate(food);
  if(food.source==='ciqual'&&densityCodes.has(food.code)&&!proposals.gramsPerMillilitre)proposals.gramsPerMillilitre=densityEstimate(food);
  if(proposals.gramsPerMillilitre){
    for(const [field,ml] of [['tspGrams',5],['tbspGrams',15]])if(!proposals[field])proposals[field]=estimate(Number((ml*proposals.gramsPerMillilitre.value).toFixed(2)),'Estimation volume × densité',`Cuillère de ${ml} ml × densité indicative de ${proposals.gramsPerMillilitre.value} g/ml ; vérifier si le produit n’est pas un liquide homogène.`,volumeSource);
  }
  const category=manualCategory(food);
  if(category)proposals.foodCategory={value:category,source:'Classement par nom',method:'Catégorie proposée d’après le nom de la fiche ; à vérifier pour le produit exact.',url:null,uncertainty:'moyenne'};
  return Object.fromEntries(Object.entries(proposals).filter(([,value])=>value));
}

export async function listCatalogueEstimates(pool){
  const {rows}=await pool.query(`SELECT f.id,f.canonical_name AS name,f.source,f.source_reference AS code,f.food_category AS "foodCategory",f.version,
    f.cooking_factor AS "cookingFactor",f.grams_per_millilitre AS "gramsPerMillilitre",
    COALESCE((SELECT jsonb_object_agg(unit_id,grams_per_unit) FROM food_unit_conversions WHERE food_id=f.id),'{}'::jsonb) AS "gramsPerUnit"
    FROM foods f ORDER BY lower(f.canonical_name),f.id`);
  return {foods:rows.map(food=>({...food,estimates:estimatesForFood(food)}))};
}
