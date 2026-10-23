const unitNames={g:'g',kg:'kg',ml:'ml',l:'l',piece:'pièce',tsp:'cuillère à café',tbsp:'cuillère à soupe',cup:'tasse',pinch:'pincée',scoop:'dosette'};
const errors={
  'purchase-product-chain':'Les regroupements en chaîne ne sont pas permis. Choisis directement le produit final.',
  'purchase-product-unit-conflict':'Utilise la même unité d’achat que les autres aliments rattachés à ce produit.',
  'purchase-source-history-present':'Des préparations actives peuvent encore restituer l’ancien stock de cet aliment. Conserve-le séparé, ou annule les préparations concernées avant de regrouper.',
  'purchase-source-stock-present':'Cet aliment a encore un stock ou des seuils. Remets-les à zéro après vérification avant de le rattacher à un stock commun.',
  'ingredient-conversion-missing':'Complète les équivalences en grammes des deux aliments dans leurs fiches Mesures.',
  'use-purchase-product-stock':'Compte ou achète le produit commun plutôt que cet aliment rattaché.',
};
export function shoppingPreferenceError(error){return errors[error.body?.error??error.message]??('Réglage non enregistré : '+(error.body?.error??error.message));}
const element=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
function unitSelect(value){const e=element('select');for(const [id,name] of Object.entries(unitNames))e.add(new Option(name,id));e.value=value;return e;}
function field(text,input){const label=element('label',text);label.append(input);return label;}
function action(label,callback){const b=element('button',label);b.type='button';b.className='secondary';b.addEventListener('click',callback);return b;}

export function shoppingPreferenceControls(item,preferences,actions){
  const root=element('details');root.className='shopping-product-settings';root.append(element('summary','Acheter sous… et exclusions'));
  const message=element('p');message.setAttribute('role','status');
  const persist=async(data,button)=>{button.disabled=true;try{await actions.save({foodId:item.foodId,...data});}catch(error){message.textContent=shoppingPreferenceError(error);button.disabled=false;}};
  const exclusions=element('div');exclusions.className='shopping-preference-actions';
  for(const [scope,label] of [['period','Masquer pour ces courses'],['always','Toujours exclure des courses']]){
    const button=action(label,()=>persist({kind:'exclusion',scope,excluded:true,startDate:actions.startDate,endDate:actions.endDate},button));exclusions.append(button);
  }
  root.append(exclusions);
  const mapping=preferences.mappings.find(row=>row.foodId===item.foodId);
  const form=element('form');form.className='shopping-product-form';
  const title=element('strong','Produit commun à acheter pour '+item.name);
  const search=element('input');search.type='search';search.placeholder='Rechercher un aliment du catalogue';search.setAttribute('aria-label','Rechercher le produit d’achat pour '+item.name);
  const target=element('select');target.required=true;target.setAttribute('aria-label','Produit à acheter pour '+item.name);
  target.add(new Option('Choisir le produit à acheter',''));
  if(mapping){target.add(new Option(mapping.purchaseName,mapping.purchaseFoodId));target.value=mapping.purchaseFoodId;}
  let sequence=0;
  search.addEventListener('input',async()=>{
    const request=++sequence,query=search.value.trim();if(query.length<2)return;
    try{const foods=await actions.searchFoods(query);if(request!==sequence)return;
      const selected=target.value,selectedName=target.options?.[target.selectedIndex]?.textContent;
      target.replaceChildren(new Option('Choisir le produit à acheter',''));
      for(const food of foods.filter(food=>food.id!==item.foodId))target.add(new Option(food.name,food.id));
      if(selected&&!foods.some(food=>food.id===selected))target.add(new Option(selectedName??mapping?.purchaseName??'Produit sélectionné',selected));
      target.value=selected;
    }catch{if(request===sequence)message.textContent='Recherche indisponible. Réessaie.';}
  });
  const sourceUnit=unitSelect(mapping?.sourceUnitId??item.unitId),targetUnit=unitSelect(mapping?.targetUnitId??(item.unitId==='piece'?'piece':'g'));
  sourceUnit.setAttribute('aria-label','Unité de l’aliment utilisé');targetUnit.setAttribute('aria-label','Unité du produit à acheter');
  const factor=element('input');factor.type='number';factor.min='0.000001';factor.max='1000000';factor.step='any';factor.required=true;factor.value=String(mapping?.factor??1);
  const hint=element('p','Pour 1 unité de cet aliment, indique la quantité du produit à acheter. Exemple : 1 pièce d’œuf dur nécessite 1 pièce d’œuf cru. Pour les blancs, choisis explicitement œufs entiers ou blanc en bouteille. Exemple : 250 g de pois chiches cuits égouttés peuvent correspondre à 200 g de pois chiches secs (coefficient 0,8). Le magasin, le format d’achat et le stock seront ceux du produit choisi. Les recettes gardent leurs ingrédients et leurs valeurs nutritionnelles.');
  const save=element('button','Enregistrer le regroupement');save.type='submit';save.className='secondary';
  form.append(title,search,target,hint,field('Pour 1 unité de cet aliment',sourceUnit),field('Quantité du produit à acheter',factor),field('Unité du produit à acheter',targetUnit),save);
  form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity())persist({kind:'product',purchaseFoodId:target.value,sourceUnitId:sourceUnit.value,targetUnitId:targetUnit.value,factor:Number(factor.value)},save);});
  if(mapping){const remove=action('Retirer ce regroupement',()=>persist({kind:'product',purchaseFoodId:null},remove));form.append(remove);}
  root.append(form,message);return root;
}

export function shoppingPreferencesPanel(preferences,actions){
  const root=element('details');root.className='shopping-preferences-panel';
  const relevant=preferences.exclusions.filter(row=>row.scope==='always'||row.scope===actions.startDate+'/'+actions.endDate);
  root.append(element('summary',`Regroupements et exclusions · ${preferences.mappings.length} regroupement(s), ${relevant.length} exclusion(s)`));
  root.append(element('p','Ces réglages concernent uniquement les achats et le stock commun. Ils sont propres à ce foyer. Les recettes et leur nutrition restent distinctes.'));
  for(const mapping of preferences.mappings){
    const card=element('section');card.append(element('p',`${mapping.name} → ${mapping.purchaseName} · 1 ${unitNames[mapping.sourceUnitId]} nécessite ${mapping.factor} ${unitNames[mapping.targetUnitId]}`));
    card.append(shoppingPreferenceControls({foodId:mapping.foodId,name:mapping.name,unitId:mapping.sourceUnitId},preferences,actions));root.append(card);
  }
  for(const exclusion of relevant){
    const row=element('p',exclusion.name+' · '+(exclusion.scope==='always'?'toujours exclu':'masqué pour ces courses')+' ');
    const restore=action('Réafficher',async()=>{
      restore.disabled=true;try{await actions.save({kind:'exclusion',foodId:exclusion.foodId,scope:exclusion.scope==='always'?'always':'period',startDate:actions.startDate,endDate:actions.endDate,excluded:false});}
      catch(error){row.append(element('span',shoppingPreferenceError(error)));restore.disabled=false;}
    });row.append(restore);root.append(row);
  }
  return root;
}
