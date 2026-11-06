const unitFields={tspGrams:'tsp',tbspGrams:'tbsp',pinchGrams:'pinch',scoopGrams:'scoop',pieceGrams:'piece'};

export function catalogueCurrent(food,field){
  if(field==='foodCategory')return food.foodCategory??null;
  if(field==='cookingFactor'||field==='gramsPerMillilitre')return food[field]==null?null:Number(food[field]);
  return food.gramsPerUnit?.[unitFields[field]]==null?null:Number(food.gramsPerUnit[unitFields[field]]);
}

export function catalogueSame(current,proposal){
  if(current==null||proposal==null)return false;
  if(typeof proposal==='string')return String(current).trim()===proposal.trim();
  return Math.abs(Number(current)-Number(proposal))<0.000001;
}

export function catalogueExclusion(food,exclusions){
  if(exclusions.categories.includes(food.foodCategory??'__none__'))return 'catégorie';
  if(exclusions.foodIds.includes(food.id.toLowerCase()))return 'aliment';
  return null;
}

export function filterCatalogueReview(foods,{field,query='',filter='all',selectedIds=new Set(),exclusions={categories:[],foodIds:[]},hideSame=true}){
  const search=query.trim().toLocaleLowerCase('fr');
  return foods.filter(food=>{
    const selected=selectedIds.has(food.id),excluded=field==='cookingFactor'?catalogueExclusion(food,exclusions):null;
    const current=catalogueCurrent(food,field),proposal=food.estimates?.[field];
    if(search&&!`${food.name} ${food.code??''} ${food.foodCategory??''}`.toLocaleLowerCase('fr').includes(search))return false;
    if(filter==='excluded')return Boolean(excluded);
    if(excluded)return false;
    if(hideSame&&!selected&&catalogueSame(current,proposal?.value))return false;
    if(filter==='proposed')return Boolean(proposal);
    if(filter==='missing')return current==null;
    if(filter==='current')return current!=null;
    if(filter==='current-no-proposal')return current!=null&&!proposal;
    if(filter==='selected')return selected;
    return true;
  });
}

function csvCell(value){
  const string=String(value??'');
  const safe=typeof value!=='number'&&/^[\s]*[=+\-@]/.test(string)?`'${string}`:string;
  return `"${safe.replaceAll('"','""')}"`;
}

export function catalogueReviewCsv(foods,{field,selected=new Map(),exclusions={categories:[],foodIds:[]}}){
  const columns=['id','code Ciqual','nom','catégorie','champ','valeur actuelle','estimation','valeur cochée','source saisie','source proposée','lien source','méthode','incertitude','exclusion cuisson'];
  const lines=foods.map(food=>{
    const proposal=food.estimates?.[field],choice=selected.get(food.id);
    return [food.id,food.code??'',food.name,food.foodCategory??'',field,catalogueCurrent(food,field)??'',proposal?.value??'',choice?.value??'',choice?.sourceNote??'',proposal?.source??'',proposal?.url??'',proposal?.method??'',proposal?.uncertainty??'',catalogueExclusion(food,exclusions)??''].map(csvCell).join(';');
  });
  return '\uFEFF'+[columns.map(csvCell).join(';'),...lines].join('\r\n')+'\r\n';
}
