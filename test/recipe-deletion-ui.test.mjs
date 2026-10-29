import {recipeServiceChoices,recipeServiceMode} from '../web/recipe-directory.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function requestRecipeDeletion('),end=source.indexOf('\nfunction recipeCard(',start);
assert.ok(start>=0&&end>start);
function deletionUI(){
  const recipe={id:'delete-this',name:'Duplicate',version:7},duplicate={id:'keep-this',name:'Duplicate',version:1};
  const elements=new Map(),requests=[],hidden=[];
  const $=key=>{if(!elements.has(key))elements.set(key,{classList:{add:value=>hidden.push([key,value])}});return elements.get(key);};
  const context={$,confirm:()=>true,state:{household:{id:'household'},recipes:[recipe,duplicate],editingRecipeId:recipe.id,editingRecipeForDeletion:recipe},
    api:async(url,options)=>{requests.push({url,...options});return {deleted:true};},showMessage:(element,text)=>{element.textContent=text;},
    renderFilteredRecipes(){},refreshRecipes:async()=>{}};
  runInNewContext(source.slice(start,end)+'\nglobalThis.removeRecipe=requestRecipeDeletion;',context);
  const button={disabled:false},message={};
  return {context,recipe,duplicate,button,message,requests,hidden,$,remove:()=>context.removeRecipe(recipe,button,message)};
}

test('recipe removal confirms once and removes only the selected duplicate after API success',async()=>{
  const ui=deletionUI();let confirmation='';ui.context.confirm=text=>{confirmation=text;return true;};
  await ui.remove();
  assert.match(confirmation,/Duplicate/);assert.match(confirmation,/définitivement/);
  assert.equal(ui.requests[0].url,'/api/recipes/delete-this');assert.equal(ui.requests[0].method,'DELETE');
  assert.deepEqual(JSON.parse(ui.requests[0].body),{householdId:'household',version:7});
  assert.equal(ui.context.state.recipes.length,1);assert.equal(ui.context.state.recipes[0].id,'keep-this');
  assert.equal(ui.context.state.editingRecipeId,null);
  assert.ok(ui.hidden.some(([key])=>key==='#recipe-form'));
  assert.match(ui.$('#recipe-list-message').textContent,/a été supprimée/);
});

test('cancelling confirmation or clicking a disabled removal never sends a request',async()=>{
  const ui=deletionUI();ui.context.confirm=()=>false;
  await ui.remove();assert.equal(ui.requests.length,0);assert.equal(ui.button.disabled,false);
  ui.button.disabled=true;ui.context.confirm=()=>{throw Error('must not ask');};
  await ui.remove();assert.equal(ui.requests.length,0);
});

test('protected recipes, conflicts and connection failures keep the card and show an actionable message',async()=>{
  for(const [body,expected] of [[{error:'recipe-in-use',meals:2,productions:1},/menus concernés.*historique de production/],
    [{error:'recipe-version-conflict'},/Actualise la liste/],[{error:'recipe-not-found'},/plus disponible/],[{},/connexion/]]){
    const ui=deletionUI();ui.context.api=async()=>{throw {body};};
    await ui.remove();assert.equal(ui.context.state.recipes.length,2);
    assert.equal(ui.context.state.editingRecipeId,ui.recipe.id);assert.equal(ui.button.disabled,false);
    assert.match(ui.message.textContent,expected);
  }
  const ui=deletionUI();ui.context.api=async()=>({deleted:true,imageCleanupPending:true});
  await ui.remove();assert.match(ui.$('#recipe-list-message').textContent,/fichier photo/);
});

test('rendered recipe cards visibly expose a named delete action bound to that recipe',()=>{
  const a=source.indexOf('function recipeCard('),b=source.indexOf('\nfunction renderRecipe(',a);
  const element=tag=>({tag,options:[],replaceChildren(){this.options=[];},children:[],attributes:{},handlers:{},append(...items){this.children.push(...items);for(const item of items)if(item&&typeof item==='object')item.parentElement=this;if(tag==='select')this.options.push(...items);},
    dataset:{},setAttribute(key,value){this.attributes[key]=value;},addEventListener(name,fn){this.handlers[name]=fn;}});
  const removed=[];const recipe={id:'card-id',name:'Visible recipe',lines:[],yield:{amount:4,unitId:'portion'},nutrition:{complete:true,perYieldUnit:{}}};
  const context={recipeServiceChoices,recipeServiceMode,document:{createElement:element,createTextNode:text=>({textContent:text})},recipeTypeLabel:()=> 'Plat',productionTypeLabel:id=>id,populateProductionTypeSelect:(select,value)=>{select.replaceChildren({value,textContent:'none'});select.value=value;},format:String,
    recipeMissingData:()=>[],requestRecipeDeletion:(...args)=>removed.push(args)};
  runInNewContext(source.slice(a,b)+'\nglobalThis.render=recipeCard;',context);
  const card=context.render(recipe);
  const all=node=>[node,...(node.children??[]).flatMap(all)];
  const button=all(card).find(node=>node.tag==='button'&&node.textContent==='Supprimer');
  assert.ok(button);assert.equal(button.attributes['aria-label'],'Supprimer Visible recipe');
  button.handlers.click();assert.equal(removed[0][0],recipe);assert.equal(removed[0][1],button);
  assert.equal(removed[0][2].attributes.role,'status');
});
