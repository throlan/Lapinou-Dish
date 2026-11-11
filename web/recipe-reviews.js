import {MEAL_LABELS} from './meal-config.js';
import {accountMessage} from './accounts-ui.js';

export function ratingLabel(average,count) {
 return count>0?`★ ${Number(average).toLocaleString('fr-FR',{maximumFractionDigits:1})} / 5 · ${count} avis`:null;
}
const node=(tag,text,className)=>{
 const value=document.createElement(tag);if(text)value.textContent=text;if(className)value.className=className;return value;
};
export function createRecipeReviews({api,getAccount,onChange}) {
 let overview={recipes:[],meals:[]},filter='all',sequence=0;
 async function load(){const current=++sequence,data=await api('/api/community/ratings');if(current===sequence)overview=data;return overview;}
 function badge(id){
  const item=overview.recipes.find(r=>r.id===id),label=ratingLabel(item?.average,item?.count??0);
  return label?node('span',label,'recipe-rating'):null;
 }
 function filterRecipes(recipes){return recipes.filter(recipe=>{
  const item=overview.recipes.find(r=>r.id===recipe.id);
  return filter==='all'||filter==='unrated'&&!item?.count||filter==='recommended'&&item?.average>=4||filter==='review'&&item?.count>0&&item.average<3;
 });}
 function addFilter(parent){
  const label=node('label','Avis des utilisateurs'),select=document.createElement('select');select.id='recipe-rating-filter';
  for(const [value,text] of [['all','Toutes les notes'],['recommended','4 étoiles et plus'],['review','Moins de 3 étoiles'],['unrated','Pas encore notées']])select.add(new Option(text,value));
  select.addEventListener('change',()=>{filter=select.value;onChange();});label.append(select);parent.append(label);
 }
 function voteRow(item){
  const row=node('article',null,'recipe-review-row');
  row.append(node('strong',item.name),node('small',item.date+' · '+(MEAL_LABELS[item.slot]??'Repas')));
  const stars=node('div',null,'rating-stars');stars.setAttribute('role','group');stars.setAttribute('aria-label','Note pour '+item.name);
  const message=node('p',item.score?'Ta note : '+item.score+' / 5':'Pas encore noté','form-message');message.setAttribute('role','status');
  async function save(score){
   const controls=[...row.querySelectorAll('button')];controls.forEach(b=>b.disabled=true);
   try{
    await api('/api/community/ratings',{method:score==null?'DELETE':'PUT',body:JSON.stringify({mealId:item.mealId,recipeId:item.recipeId,...(score==null?{}:{score})})});
    item.score=score;await load();onChange();
    for(const button of stars.children)button.setAttribute('aria-pressed',String(Number(button.dataset.score)<=Number(score)));
    message.textContent=score==null?'Note retirée.':'Ta note : '+score+' / 5 · enregistrée';remove.hidden=score==null;
   }catch(error){message.textContent=accountMessage(error);}finally{controls.forEach(b=>b.disabled=false);}
  }
  for(let score=1;score<=5;score++){
   const button=node('button','★');button.type='button';button.dataset.score=score;button.setAttribute('aria-label',score+' étoile'+(score>1?'s':'')+' pour '+item.name);
   button.setAttribute('aria-pressed',String(score<=Number(item.score)));button.addEventListener('click',()=>save(score));stars.append(button);
  }
  const remove=node('button','Retirer ma note','text-button');remove.type='button';remove.hidden=item.score==null;remove.addEventListener('click',()=>save(null));
  row.append(stars,remove,message);return row;
 }
 async function renderMeal(parent,meal){
  const account=getAccount();if(!account?.personId||!meal.attendees?.some(person=>person.id===account.personId))return;
  const panel=node('section',null,'meal-reviews');panel.append(node('h3','Mon avis sur ce repas'));parent.append(panel);
  try{
   const data=await api('/api/community/ratings?mealId='+encodeURIComponent(meal.id));
   if(!panel.isConnected)return;
   const items=data.meals.filter(item=>item.mealId===meal.id);
   if(!items.length){panel.append(node('p','Tu pourras noter les recettes le jour du repas ou après.'));return;}
   panel.append(node('p','Une note par recette et par repas. Tu peux modifier ta note sans ajouter de vote.'));
   for(const item of items)panel.append(voteRow(item));
  }catch(error){panel.append(node('p',accountMessage(error)));}
 }
 function renderHome(parent){
  const panel=node('section',null,'dashboard-panel dashboard-recipe-reviews');panel.append(node('h3','Recettes les mieux notées'));
  const best=overview.recipes.filter(r=>r.count>0).sort((a,b)=>b.average-a.average||b.count-a.count||a.name.localeCompare(b.name,'fr')).slice(0,5);
  if(!best.length)panel.append(node('p','Les notes de vos repas feront apparaître le classement de vos recettes ici.'));
  for(const item of best){const row=node('p',null,'recipe-review-favourite');row.append(node('strong',item.name),node('span',ratingLabel(item.average,item.count),'recipe-rating'));panel.append(row);}
  const pending=overview.meals.filter(item=>item.score==null).slice(0,5);
  if(pending.length){panel.append(node('h3','Vos derniers repas à noter'));for(const item of pending)panel.append(voteRow(item));}
  parent.append(panel);
 }
 return {load,badge,filterRecipes,addFilter,renderMeal,renderHome};
}
