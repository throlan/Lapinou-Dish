import {randomUUID,createHash} from 'node:crypto';
import {jsonBody,sendAccount,accountError,uuid,scopedOperation} from './accounts.mjs';
import {readRecipe,createRecipe,validateRecipeInput} from './recipes.mjs';
import {getFood,createFood,validateFoodInput} from './foods.mjs';
import {readRecipeImage} from './recipe-images.mjs';
import {lockHouseholdInventory} from './ingredient-stock.mjs';
import {communityFeatures} from './community-features.mjs';

function requireManager(actor){if(actor.role!=='manager')throw accountError('household-manager-required',403);}
function recipeInput(recipe,householdId){
 const servingMode=!recipe.separateStarch?'original':recipe.servingParts?.some(p=>p.servingPart==='vegetables')?'three':
  recipe.servingParts?.some(p=>p.servingPart==='starch')?'separate':'whole';
 return {...recipe,householdId,servingMode};
}
export async function snapshotPublication(scoped,actor,kind,id){
 const foods=new Map(),recipes=new Map(),images={};
 async function food(foodId){
  if(foods.has(foodId))return;
  const item=await getFood(scoped,foodId);
  if(!item)throw accountError('food-not-found',404);
  const content={...item};delete content.ownerHouseholdId;
  foods.set(foodId,content);
 }
 async function visit(recipeId,path=[]){
  if(path.includes(recipeId))throw accountError('recipe-ingredient-cycle');
  if(recipes.has(recipeId))return;
  if(recipes.size+path.length>100)throw accountError('publication-too-large');
  const recipe=await readRecipe(scoped,recipeId);
  if(!recipe)throw accountError('recipe-not-found',404);
  for(const line of recipe.lines){
   if(line.recipeId)await visit(line.recipeId,[...path,recipeId]);
   else await food(line.foodId);
  }
  const input=recipeInput(recipe,actor.householdId);
  // Only recipe content and its food dependencies are published.
  const {data,error}=validateRecipeInput(input);
  if(error)throw accountError(error);
  const content={...data};delete content.householdId;delete content.reviewValidated;delete content.ratingEnabled;delete content.createdByAccountId;
  const reviewKey=(await scoped.query('SELECT review_key FROM recipes WHERE id=$1',[recipeId])).rows[0]?.review_key;
  recipes.set(recipeId,{id:recipeId,...content,reviewKey});
  const photo=await readRecipeImage(scoped,recipeId,actor.householdId);
  if(photo)images[recipeId]={mediaType:photo.mediaType,base64:Buffer.from(photo.image).toString('base64')};
 }
 if(kind==='food')await food(id);
 else await visit(id);
 const root=kind==='food'?foods.get(id):recipes.get(id);
 let image=null;
 if(kind==='recipe'){
  const original=await readRecipe(scoped,id);
  image=images[id]??null;
  if(original.recipeArchived)throw accountError('publish-current-recipe');
 }
 return {version:1,kind,rootId:id,name:root.name,foods:[...foods.values()],recipes:[...recipes.values()],image,images};
}
export async function importPublication(scoped,actor,publication){
 await lockHouseholdInventory(scoped,actor.householdId);
 const previous=await scoped.query('SELECT result_id FROM household_publication_imports WHERE household_id=$1 AND publication_id=$2',[actor.householdId,publication.id]);
 if(previous.rows.length){
  const table=publication.payload.kind==='food'?'foods':'recipes';
  const current=await scoped.query('SELECT id FROM '+table+' WHERE id=$1',[previous.rows[0].result_id]);
  if(current.rows.length)return {id:current.rows[0].id,replayed:true};
  await scoped.query('DELETE FROM household_publication_imports WHERE household_id=$1 AND publication_id=$2',[actor.householdId,publication.id]);
 }
 const snapshot=publication.payload;
 if(snapshot.version!==1||!Array.isArray(snapshot.foods)||!Array.isArray(snapshot.recipes))throw accountError('invalid-publication');
 const foodIds=new Map(),recipeIds=new Map(),createdRecipes=new Set();
 for(const original of snapshot.foods){
  const common=await getFood(scoped,original.id);
  if(common){foodIds.set(original.id,common.id);continue;}
  const definition={name:original.name,brand:original.brand,nutrients:original.nutrientsPer100g,units:original.gramsPerUnit,density:original.gramsPerMillilitre,cookingFactor:original.cookingFactor,category:original.foodCategory};
  const fingerprint=createHash('sha256').update(JSON.stringify(definition)).digest('hex');
  const existing=await scoped.query('SELECT food_id FROM household_imported_foods WHERE household_id=$1 AND fingerprint=$2',[actor.householdId,fingerprint]);
  if(existing.rows.length){foodIds.set(original.id,existing.rows[0].food_id);continue;}
  const checked=validateFoodInput({...original,sourceNote:[original.sourceNote,original.sourceReference,'Import volontaire de « '+publication.name+' ».'].filter(Boolean).join('\n').slice(0,500)},{creating:true});
  if(checked.error)throw accountError(checked.error);
  const item=await createFood(scoped,checked.data,{allowDuplicate:true});
  if(item.error)throw accountError(item.error);
  await scoped.query('INSERT INTO household_imported_foods(household_id,fingerprint,food_id) VALUES($1,$2,$3)',[actor.householdId,fingerprint,item.id]);
  foodIds.set(original.id,item.id);
 }
 // Dependencies were serialized before the recipes which use them.
 for(const original of snapshot.recipes){
  const lines=original.lines.map(line=>({...line,foodId:line.foodId?foodIds.get(line.foodId):null,recipeId:line.recipeId?recipeIds.get(line.recipeId):null}));
  const checked=validateRecipeInput({...original,ratingEnabled:undefined,householdId:actor.householdId,lines});
  if(checked.error)throw accountError(checked.error);
  const definition={...checked.data};delete definition.householdId;
  const fingerprint=createHash('sha256').update(original.id+JSON.stringify(definition)).digest('hex');
  const existing=await scoped.query('SELECT recipe_id FROM household_imported_recipes WHERE household_id=$1 AND fingerprint=$2',[actor.householdId,fingerprint]);
  if(existing.rows.length){
   await scoped.query('UPDATE recipes SET review_key=$2 WHERE id=$1',[existing.rows[0].recipe_id,original.reviewKey??original.id]);
   recipeIds.set(original.id,existing.rows[0].recipe_id);continue;
  }
  const item=await createRecipe(scoped,checked.data);
  if(item.error)throw accountError(item.error);
  await scoped.query('UPDATE recipes SET review_key=$2 WHERE id=$1',[item.id,original.reviewKey??original.id]);
  await scoped.query('INSERT INTO household_imported_recipes(household_id,fingerprint,recipe_id) VALUES($1,$2,$3)',[actor.householdId,fingerprint,item.id]);
  createdRecipes.add(item.id);
  recipeIds.set(original.id,item.id);
 }
 const id=(snapshot.kind==='food'?foodIds:recipeIds).get(snapshot.rootId);
 if(!id)throw accountError('invalid-publication');
 const images=snapshot.images??(snapshot.image?{[snapshot.rootId]:snapshot.image}:{});
 for(const [sourceId,image] of Object.entries(images)){
  const recipeId=recipeIds.get(sourceId);
  if(!createdRecipes.has(recipeId))continue;
  await scoped.query('INSERT INTO recipe_images(recipe_id,media_type,source,image_bytes) VALUES($1,$2,$3,$4)',[recipeId,image.mediaType,'personal',Buffer.from(image.base64,'base64')]);
 }
 await scoped.query('INSERT INTO household_publication_imports(household_id,publication_id,result_id) VALUES($1,$2,$3)',[actor.householdId,publication.id,id]);
 return {id,replayed:false};
}
export async function communityRoutes(request,response,pool,actor){
 const feature=await communityFeatures(request,response,pool,actor,{snapshotPublication,importPublication});
 if(feature!==false)return feature;
 const url=new URL(request.url,'http://localhost'),method=request.method;
 if(url.pathname==='/api/community'&&method==='GET'){
  const publications=(await pool.query(`SELECT id,kind,name,published_at AS "publishedAt",
   author_household_id=$1 AS mine,source_recipe_id AS "sourceRecipeId",
   (SELECT round(avg(v.score)::numeric,2) FROM recipe_reviews v JOIN recipes r ON r.id=v.recipe_id
    WHERE r.review_key=COALESCE((shared_publications.payload->'recipes'->-1->>'reviewKey')::uuid,(shared_publications.payload->>'rootId')::uuid)) AS "ratingAverage",
   (SELECT count(*)::int FROM recipe_reviews v JOIN recipes r ON r.id=v.recipe_id
    WHERE r.review_key=COALESCE((shared_publications.payload->'recipes'->-1->>'reviewKey')::uuid,(shared_publications.payload->>'rootId')::uuid)) AS "ratingCount"
   FROM shared_publications WHERE NOT withdrawn ORDER BY published_at DESC LIMIT 5000`,[actor.householdId])).rows;
  const packages=(await pool.query('SELECT id,name,description,publication_ids AS "publicationIds" FROM starter_packages WHERE active ORDER BY name')).rows;
  return sendAccount(response,200,{publications,packages});
 }
 if(url.pathname==='/api/community/publish'&&method==='POST'){
  requireManager(actor);const body=await jsonBody(request);
  if(!['recipe','food'].includes(body.kind)||!uuid(body.id))throw accountError('invalid-publication');
  const snapshot=await scopedOperation(pool,actor,async scoped=>{
   await lockHouseholdInventory(scoped,actor.householdId);
   return snapshotPublication(scoped,actor,body.kind,body.id);
  });
  if(Buffer.byteLength(JSON.stringify(snapshot))>12000000)throw accountError('publication-too-large',413);
  const id=randomUUID();
  await pool.query('INSERT INTO shared_publications(id,author_household_id,kind,name,payload,source_recipe_id) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[id,actor.householdId,body.kind,snapshot.name,JSON.stringify(snapshot),body.kind==='recipe'?body.id:null]);
  return sendAccount(response,201,{id});
 }
 if(url.pathname==='/api/community/import'&&method==='POST'){
  requireManager(actor);const body=await jsonBody(request);
  if(!uuid(body.publicationId))throw accountError('invalid-publication');
  const publication=(await pool.query('SELECT id,name,payload FROM shared_publications WHERE id=$1 AND NOT withdrawn',[body.publicationId])).rows[0];
  if(!publication)throw accountError('publication-not-found',404);
  const result=await scopedOperation(pool,actor,scoped=>importPublication(scoped,actor,publication));
  return sendAccount(response,201,result);
 }
 const publicationId=url.pathname.match(/^\/api\/community\/publications\/([a-f0-9-]{36})$/i)?.[1];
 if(publicationId&&method==='GET'){
  const publication=(await pool.query('SELECT id,name,payload FROM shared_publications WHERE id=$1 AND NOT withdrawn',[publicationId])).rows[0];
  if(!publication)throw accountError('publication-not-found',404);
  return sendAccount(response,200,publication);
 }
 if(publicationId&&method==='DELETE'){
  if(!actor.applicationAdmin)requireManager(actor);
  const result=await pool.query('UPDATE shared_publications SET withdrawn=true WHERE id=$1 AND (author_household_id=$2 OR $3) RETURNING id',[publicationId,actor.householdId,actor.applicationAdmin]);
  if(!result.rows.length)throw accountError('publication-not-found',404);
  return sendAccount(response,200,{withdrawn:true});
 }
 if(url.pathname==='/api/community/packages'&&method==='POST'){
  if(!actor.applicationAdmin)throw accountError('application-admin-required',403);
  const body=await jsonBody(request),ids=body.publicationIds;
  const name=String(body.name??'').trim(),description=String(body.description??'').trim();
  if(!name||name.length>120||description.length>2000||!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>!uuid(id))||new Set(ids).size!==ids.length)throw accountError('invalid-starter-package');
  const valid=await pool.query("SELECT id FROM shared_publications WHERE id=ANY($1::uuid[]) AND NOT withdrawn AND kind='recipe'",[ids]);
  if(valid.rows.length!==ids.length)throw accountError('invalid-starter-package');
  const id=randomUUID();
  await pool.query('INSERT INTO starter_packages(id,name,description,publication_ids) VALUES($1,$2,$3,$4)',[id,name,description,ids]);
  return sendAccount(response,201,{id});
 }
 const packageId=url.pathname.match(/^\/api\/community\/packages\/([a-f0-9-]{36})$/i)?.[1];
 if(packageId&&method==='DELETE'){
  if(!actor.applicationAdmin)throw accountError('application-admin-required',403);
  const result=await pool.query('UPDATE starter_packages SET active=false WHERE id=$1 RETURNING id',[packageId]);
  if(!result.rows.length)throw accountError('package-not-found',404);
  return sendAccount(response,200,{withdrawn:true});
 }
 if(url.pathname==='/api/community/packages/import'&&method==='POST'){
  requireManager(actor);const body=await jsonBody(request);
  if(!uuid(body.packageId)||!Array.isArray(body.publicationIds)||!body.publicationIds.length||body.publicationIds.length>500||new Set(body.publicationIds).size!==body.publicationIds.length||body.publicationIds.some(id=>!uuid(id)))throw accountError('invalid-starter-package');
  const pack=(await pool.query('SELECT publication_ids FROM starter_packages WHERE id=$1 AND active',[body.packageId])).rows[0];
  if(!pack||body.publicationIds.some(id=>!pack.publication_ids.includes(id)))throw accountError('invalid-starter-package');
  const publications=(await pool.query('SELECT id,name,payload FROM shared_publications WHERE id=ANY($1::uuid[]) AND NOT withdrawn',[body.publicationIds])).rows;
  if(publications.length!==body.publicationIds.length)throw accountError('publication-unavailable',409);
  const results=await scopedOperation(pool,actor,async scoped=>{
   const result=[];for(const publication of publications)result.push(await importPublication(scoped,actor,publication));return result;
  });
  return sendAccount(response,201,{results});
 }
 throw accountError('community-route-not-found',404);
}
