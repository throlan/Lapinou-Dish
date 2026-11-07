import {toGrams} from '../domain/foods.ts';

const types=new Map([
  ['viandes','meat'],['charcuteries','meat'],['produits a base de viande','meat'],
  ['legumes','vegetables'],['poissons','fish'],['oeufs','eggs'],['œufs','eggs'],
  ...['feculents','tubercules','pains','pates a tarte','cereales du petit-dejeuner','legumineuses'].map(name=>[name,'starch']),
]);
const normalize=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();

function ingredientKind(food,part){
  const name=normalize(food.name).replace(/^(?:filet|blanc|escalope|steak|pave) (?:de |d['’])?/, '');
  if(/^(?:blanc|jaune) d['’](?:oeuf|œuf)|(?:oeuf|œuf), (?:blanc|jaune)/.test(name))return null;
  return types.get(normalize(food.category))??
    (/^(?:oeuf|œuf)s?\b/.test(name)?'eggs':
    /^(?:poulet|dinde|veau|boeuf|bœuf|porc|agneau|canard|lapin|mouton|viande)\b/.test(name)?'meat':
    /^(?:saumon|cabillaud|thon|truite|merlu|colin|dorade|sardine|maquereau|poisson)\b/.test(name)?'fish':
    /^(?:riz|pates|pain|semoule|quinoa|pommes? de terre|bagels?)\b/.test(name)||part==='starch'&&!food.category?'starch':part==='vegetables'&&!food.category?'vegetables':null);
}

export function servingIngredientLoad(line,food,factors,part){
  if(!food)return {};
  const kind=ingredientKind(food,part);
  if(!kind)return {};
  if(kind==='eggs'&&line.unitId==='piece')return {eggs:line.quantity};
  const grams=toGrams(line.quantity,line.unitId,food);
  const factor=line.foodCookingFactor??line.cookingFactor??factors?.[part]??1;
  if(kind==='eggs'){
    const piece=food.gramsPerUnit.piece;
    return {eggs:grams!=null&&piece>0?grams/piece:null};
  }
  const alreadyCooked=line.cookingState==='already_cooked'||line.cookingState==='legacy'&&/\b(cuit|cuite|bouilli|roti|grille|appertise|fume)s?\b/.test(normalize(food.name));
  if(kind==='starch'||kind==='vegetables')return {[kind]:grams==null?null:grams*(line.cookingState==='served_raw'||alreadyCooked?1:factor)};
  return {[kind]:grams==null?null:alreadyCooked?line.foodCookingFactor>0?grams/line.foodCookingFactor:null:grams};
}

export function addServingLoad(total,load,scale=1){
  for(const [key,value] of Object.entries(load??{})){
    total[key]=value==null||total[key]===null?null:(total[key]??0)+value*scale;
  }
}

