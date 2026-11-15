import {randomUUID,createHash} from 'node:crypto';
import {transaction,nestedPool,jsonBody,sendAccount,accountError} from './accounts.mjs';
import {createRecipe,readRecipe,validateRecipeInput} from './recipes.mjs';
import {selectedRecipeLines} from './recipe-choice-model.mjs';
import {readRecipeImage,saveRecipeImage} from './recipe-images.mjs';

const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const fail=(code,status=400)=>{throw accountError(code,status);};

export async function previewRecipeChoices(pool,id,householdId,selection,expectedVersion){
 const own=await pool.query('SELECT id FROM recipes WHERE id=$1 AND household_id=$2',[id,householdId]);
 if(!own.rows.length)fail('recipe-not-found',404);
 const recipe=await readRecipe(pool,id);
 if(!recipe||recipe.parentRecipeId||recipe.choiceInstance)fail('recipe-not-found',404);
 if(recipe.recipeArchived)fail('recipe-replaced',409);
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion!==recipe.version)fail('recipe-version-conflict',409);
 const chosen=selectedRecipeLines(recipe,selection);if(chosen.error)fail(chosen.error);
 const servingMode=!recipe.separateStarch?'original':recipe.servingParts.some(p=>p.servingPart==='vegetables')?'three':recipe.servingParts.some(p=>p.servingPart==='starch')?'separate':'whole';
 const checked=validateRecipeInput({...recipe,householdId,servingMode,lines:chosen.lines,choiceGroups:[]});if(checked.error)fail(checked.error);
 const result=await readRecipe(pool,id,[],null,{lines:chosen.lines,name:recipe.name});
 if(result.version!==expectedVersion)fail('recipe-version-conflict',409);
 return {name:result.name,version:result.version,labels:chosen.labels,selection,yield:result.yield,outputUnits:result.outputUnits,
  nutrition:result.nutrition,servingWeightG:result.servingWeightG,energyKnown:result.energyKnown,containsWhey:result.containsWhey};
}

export async function resolveRecipeChoices(pool,id,householdId,selection,expectedVersion){
 return transaction(pool,async client=>{
  // Serialize with recipe edits and other resolutions, including identical concurrent requests.
  await client.query('SELECT id FROM households WHERE id=$1 FOR UPDATE',[householdId]);
  const recipe=await readRecipe(client,id);
  if(!recipe||recipe.parentRecipeId||recipe.choiceInstance)fail('recipe-not-found',404);
  const own=await client.query('SELECT id FROM recipes WHERE id=$1 AND household_id=$2',[id,householdId]);
  if(!own.rows.length)fail('recipe-not-found',404);
  if(recipe.recipeArchived)fail('recipe-replaced',409);
  if(expectedVersion!==undefined&&(!Number.isSafeInteger(expectedVersion)||expectedVersion!==recipe.version))fail('recipe-version-conflict',409);
  if(!recipe.choiceGroups.length)return recipe;
  const chosen=selectedRecipeLines(recipe,selection);if(chosen.error)fail(chosen.error);
  const key=createHash('sha256').update(JSON.stringify([id,recipe.version,recipe.choiceGroups.map(g=>[g.id,selection[g.id]])])).digest('hex');
  const existing=await client.query("SELECT id FROM recipes WHERE household_id=$1 AND choice_instance AND choice_origin->>'key'=$2",[householdId,key]);
  if(existing.rows.length)return readRecipe(client,existing.rows[0].id);
  const suffix=chosen.labels.join(' · ');
  const servingMode=!recipe.separateStarch?'original':recipe.servingParts.some(p=>p.servingPart==='vegetables')?'three':recipe.servingParts.some(p=>p.servingPart==='starch')?'separate':'whole';
  const checked=validateRecipeInput({...recipe,householdId,name:(recipe.name+' — '+suffix).slice(0,200),servingMode,lines:chosen.lines,choiceGroups:[]});
  if(checked.error)fail(checked.error);
  const scoped=nestedPool(client),instance=await createRecipe(scoped,checked.data);
  if(instance.error)fail(instance.error);
  const origin={templateId:id,templateName:recipe.name,key,selection,labels:chosen.labels,templateVersion:recipe.version};
  await client.query('UPDATE recipes SET choice_instance=true,choice_origin=$2::jsonb,created_by_account_id=$3,review_key=(SELECT review_key FROM recipes WHERE id=$4) WHERE id=$1',[instance.id,JSON.stringify(origin),recipe.createdByAccountId,id]);
  const photo=await readRecipeImage(client,id,householdId);
  if(photo)await saveRecipeImage(scoped,instance.id,{householdId,mediaType:photo.mediaType,image:photo.image,source:'personal'});
  return readRecipe(client,instance.id);
 });
}

export async function recipeChoiceRoutes(request,response,pool,url){
 const preview=url.pathname.match(/^\/api\/recipes\/([a-f0-9-]{36})\/choices\/preview$/i);
 if(preview&&request.method==='GET'){
  try{const householdId=url.searchParams.get('householdId');if(!uuid(householdId))fail('invalid-household-id');
   let selection;try{selection=JSON.parse(url.searchParams.get('selection'));}catch{fail('invalid-choice-selection');}
   sendAccount(response,200,{preview:await previewRecipeChoices(pool,preview[1],householdId,selection,Number(url.searchParams.get('version')))});
  }catch(error){if(!error.status)throw error;sendAccount(response,error.status,{error:error.message});}return true;
 }
 const resolve=url.pathname.match(/^\/api\/recipes\/([a-f0-9-]{36})\/choices\/resolve$/i);
 if(resolve&&request.method==='POST'){
  try{const body=await jsonBody(request);if(!uuid(body.householdId))fail('invalid-household-id');
   sendAccount(response,200,{recipe:await resolveRecipeChoices(pool,resolve[1],body.householdId,body.selection,body.version)});
  }catch(error){if(!error.status)throw error;sendAccount(response,error.status,{error:error.message});}return true;
 }
 const list=url.pathname.match(/^\/api\/recipe-choice-lists(?:\/([a-f0-9-]{36}))?$/i);
 if(!list)return false;
 try{
  if(request.method==='GET'){
   const householdId=url.searchParams.get('householdId');if(!uuid(householdId))fail('invalid-household-id');
   const lists=(await pool.query('SELECT id,name,food_ids AS "foodIds",version FROM recipe_choice_lists WHERE household_id=$1 AND NOT archived ORDER BY name',[householdId])).rows;
   const ids=[...new Set(lists.flatMap(l=>l.foodIds))];
   const foods=ids.length?(await pool.query('SELECT id,canonical_name AS name FROM foods WHERE id=ANY($1::uuid[])',[ids])).rows:[];
   sendAccount(response,200,{lists:lists.map(l=>({...l,foods:l.foodIds.map(id=>foods.find(f=>f.id===id)).filter(Boolean)}))});return true;
  }
  const body=await jsonBody(request);if(!uuid(body.householdId))fail('invalid-household-id');
  if(!['POST','PUT','DELETE'].includes(request.method))fail('method-not-allowed',405);
  if(request.method!=='POST'&&(!list[1]||!Number.isSafeInteger(body.version)))fail('invalid-choice-list');
  if(request.method==='DELETE'){
   const updated=await pool.query('UPDATE recipe_choice_lists SET archived=true,version=version+1 WHERE id=$1 AND household_id=$2 AND version=$3 RETURNING id',[list[1],body.householdId,body.version]);
   if(!updated.rows.length)fail('choice-list-version-conflict',409);
   await pool.query('DELETE FROM recipe_choice_list_food_refs WHERE list_id=$1',[list[1]]);
   sendAccount(response,200,{archived:true});return true;
  }
  if(typeof body.name!=='string'||!body.name.trim()||body.name.length>100||!Array.isArray(body.foodIds)||!body.foodIds.length||body.foodIds.length>50||body.foodIds.some(id=>!uuid(id))||new Set(body.foodIds).size!==body.foodIds.length)fail('invalid-choice-list');
  const foods=await pool.query('SELECT id FROM foods WHERE id=ANY($1::uuid[])',[body.foodIds]);
  if(foods.rows.length!==body.foodIds.length)fail('unknown-choice-food');
  const id=list[1]??randomUUID();
  if(request.method==='POST'){
   if(list[1])fail('invalid-choice-list');
   await pool.query('INSERT INTO recipe_choice_lists(id,household_id,name,food_ids) VALUES($1,$2,$3,$4)',[id,body.householdId,body.name.trim(),body.foodIds]);
  }else{
   const updated=await pool.query('UPDATE recipe_choice_lists SET name=$3,food_ids=$4,version=version+1,updated_at=now() WHERE id=$1 AND household_id=$2 AND version=$5 AND NOT archived RETURNING id',[id,body.householdId,body.name.trim(),body.foodIds,body.version]);
   if(!updated.rows.length)fail('choice-list-version-conflict',409);
  }
  await pool.query('DELETE FROM recipe_choice_list_food_refs WHERE list_id=$1',[id]);
  for(const foodId of body.foodIds)await pool.query('INSERT INTO recipe_choice_list_food_refs(list_id,food_id) VALUES($1,$2)',[id,foodId]);
  sendAccount(response,request.method==='POST'?201:200,{id});return true;
 }catch(error){if(!error.status)throw error;sendAccount(response,error.status,{error:error.message});return true;}
}
