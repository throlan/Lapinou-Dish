import {randomUUID} from 'node:crypto';
import {jsonBody,sendAccount,accountError,uuid,scopedOperation,transaction,nestedPool} from './accounts.mjs';
import {getFood,updateFood,validateFoodInput} from './foods.mjs';
import {lockHouseholdInventory} from './ingredient-stock.mjs';

function ids(value) {
 if(!Array.isArray(value)||!value.length||value.length>500||value.some(id=>!uuid(id))||new Set(value).size!==value.length)
  throw accountError('invalid-selection');
 return value;
}
function manager(actor) {if(actor.role!=='manager')throw accountError('household-manager-required',403);}
function today() {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const value=type=>parts.find(part=>part.type===type).value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}
export async function ratingsOverview(pool,actor,mealId=null) {
 const recipes=(await pool.query(`SELECT local.id,local.name,
   (SELECT round(avg(v.score)::numeric,2) FROM recipe_reviews v JOIN recipes original ON original.id=v.recipe_id WHERE original.review_key=local.review_key) AS average,
   (SELECT count(*)::int FROM recipe_reviews v JOIN recipes original ON original.id=v.recipe_id WHERE original.review_key=local.review_key) AS count
  FROM recipes local WHERE local.household_id=$1 AND local.parent_recipe_id IS NULL AND NOT local.recipe_archived`,[actor.householdId])).rows;
 const meals=actor.personId?(await pool.query(`SELECT DISTINCT m.id AS "mealId",m.meal_date::text AS date,m.slot,
   root.id AS "recipeId",root.name,review.score
  FROM planned_meals m JOIN planned_meal_attendees a ON a.meal_id=m.id AND a.person_id=$2
  JOIN planned_meal_items i ON i.meal_id=m.id JOIN recipes r ON r.id=i.recipe_id
  JOIN recipes root ON root.id=COALESCE(r.parent_recipe_id,r.id)
  LEFT JOIN recipe_reviews review ON review.meal_id=m.id AND review.recipe_id=root.id AND review.account_id=$3
  WHERE m.household_id=$1 AND m.meal_date<=$4::date
   AND (($5::uuid IS NOT NULL AND m.id=$5) OR ($5::uuid IS NULL AND m.meal_date>=$4::date-60))
  ORDER BY date DESC,m.slot,root.name LIMIT 50`,[actor.householdId,actor.personId,actor.id,today(),mealId])).rows:[];
 return {recipes:recipes.map(r=>({...r,average:r.average==null?null:Number(r.average)})),meals};
}

export async function communityFeatures(request,response,pool,actor,{snapshotPublication,importPublication}) {
 const url=new URL(request.url,'http://localhost'),method=request.method;
 if(url.pathname==='/api/community/ratings'&&method==='GET'){
  const mealId=url.searchParams.get('mealId');if(mealId&&!uuid(mealId))throw accountError('invalid-rating');
  return sendAccount(response,200,await ratingsOverview(pool,actor,mealId));
 }
 if(url.pathname==='/api/community/ratings'&&['PUT','DELETE'].includes(method)) {
  const body=await jsonBody(request);
  if(!uuid(body.mealId)||!uuid(body.recipeId)||method==='PUT'&&(!Number.isInteger(body.score)||body.score<1||body.score>5))throw accountError('invalid-rating');
  if(!actor.personId)throw accountError('profile-not-linked',409);
  await transaction(pool,async client=>{
   const meal=await client.query(`SELECT m.id FROM planned_meals m
    JOIN planned_meal_attendees a ON a.meal_id=m.id AND a.person_id=$3
    WHERE m.id=$1 AND m.household_id=$2 AND m.meal_date<=$5::date
    AND EXISTS(SELECT 1 FROM planned_meal_items i JOIN recipes r ON r.id=i.recipe_id
     WHERE i.meal_id=m.id AND COALESCE(r.parent_recipe_id,r.id)=$4) FOR UPDATE OF m`,[body.mealId,actor.householdId,actor.personId,body.recipeId,today()]);
   if(!meal.rows.length)throw accountError('meal-not-rateable',403);
   if(method==='DELETE')await client.query('DELETE FROM recipe_reviews WHERE account_id=$1 AND meal_id=$2 AND recipe_id=$3',[actor.id,body.mealId,body.recipeId]);
   else await client.query(`INSERT INTO recipe_reviews(account_id,meal_id,recipe_id,score) VALUES($1,$2,$3,$4)
    ON CONFLICT(account_id,meal_id,recipe_id) DO UPDATE SET score=EXCLUDED.score,updated_at=now()`,[actor.id,body.mealId,body.recipeId,body.score]);
  });
  return sendAccount(response,200,{saved:true});
 }
 if(url.pathname==='/api/community/food-proposals'&&method==='POST') {
  const body=await jsonBody(request);
  if(!actor.householdId||!uuid(body.foodId))throw accountError('invalid-food-proposal');
  const checked=validateFoodInput(body.input,{creating:false});
  if(checked.error)throw accountError(checked.error);
  const before=await getFood(pool,body.foodId);
  if(!before)throw accountError('food-not-found',404);
  const id=randomUUID(),reason=String(body.reason??'').trim().slice(0,2000);
  await pool.query(`INSERT INTO food_correction_proposals(id,food_id,account_id,household_id,before_state,proposed_state,reason)
   VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,[id,body.foodId,actor.id,actor.householdId,JSON.stringify(before),JSON.stringify(body.input),reason]);
  return sendAccount(response,201,{id});
 }
 if(url.pathname==='/api/community/food-proposals'&&method==='GET') {
  const proposals=(await pool.query(`SELECT p.id,p.food_id AS "foodId",f.canonical_name AS name,
   p.before_state AS before,p.proposed_state AS proposed,p.reason,p.status,p.created_at AS "createdAt",
   a.display_name AS author FROM food_correction_proposals p JOIN foods f ON f.id=p.food_id
   LEFT JOIN app_accounts a ON a.id=p.account_id
   WHERE ($1 OR p.account_id=$2) ORDER BY p.created_at DESC LIMIT 500`,[actor.applicationAdmin,actor.id])).rows;
  return sendAccount(response,200,{proposals});
 }
 const proposalId=url.pathname.match(/^\/api\/community\/food-proposals\/([a-f0-9-]{36})$/i)?.[1];
 if(proposalId&&method==='PUT') {
  if(!actor.applicationAdmin)throw accountError('application-admin-required',403);
  const body=await jsonBody(request);
  if(!['approved','rejected'].includes(body.status))throw accountError('invalid-food-proposal');
  await transaction(pool,async client=>{
   const proposal=(await client.query("SELECT * FROM food_correction_proposals WHERE id=$1 AND status='pending' FOR UPDATE",[proposalId])).rows[0];
   if(!proposal)throw accountError('proposal-already-reviewed',409);
   if(body.status==='approved') {
    await client.query('SELECT id FROM foods WHERE id=$1 FOR UPDATE',[proposal.food_id]);
    const current=await getFood(client,proposal.food_id);
    if(current.version!==proposal.before_state.version)throw accountError('food-proposal-stale',409);
    const checked=validateFoodInput(proposal.proposed_state,{creating:false});
    if(checked.error)throw accountError(checked.error);
    const result=await updateFood(nestedPool(client),proposal.food_id,checked.data);
    if(!result||result.error)throw accountError(result?.error??'food-not-found');
   }
   await client.query('UPDATE food_correction_proposals SET status=$2,reviewed_at=now(),reviewed_by=$3 WHERE id=$1',[proposalId,body.status,actor.id]);
  });
  return sendAccount(response,200,{saved:true});
 }
 if(url.pathname==='/api/community/publish-batch'&&method==='POST') {
  manager(actor);const selected=ids((await jsonBody(request)).recipeIds);
  const results=await scopedOperation(pool,actor,async scoped=>{
   await lockHouseholdInventory(scoped,actor.householdId);
   const results=[];
   for(const recipeId of selected) {
    const snapshot=await snapshotPublication(scoped,actor,'recipe',recipeId);
    if(Buffer.byteLength(JSON.stringify(snapshot))>12000000)throw accountError('publication-too-large',413);
    const previous=(await scoped.query('SELECT id FROM shared_publications WHERE author_household_id=$1 AND source_recipe_id=$2 AND NOT withdrawn ORDER BY published_at DESC LIMIT 1',[actor.householdId,recipeId])).rows[0];
    const id=previous?.id??randomUUID();
    if(previous)await scoped.query('UPDATE shared_publications SET name=$2,payload=$3::jsonb,published_at=now() WHERE id=$1',[id,snapshot.name,JSON.stringify(snapshot)]);
    else await scoped.query("INSERT INTO shared_publications(id,author_household_id,source_recipe_id,kind,name,payload) VALUES($1,$2,$3,'recipe',$4,$5::jsonb)",[id,actor.householdId,recipeId,snapshot.name,JSON.stringify(snapshot)]);
    results.push({id,recipeId,updated:Boolean(previous)});
   }
   return results;
  });
  return sendAccount(response,201,{results});
 }
 if(url.pathname==='/api/community/import-batch'&&method==='POST') {
  manager(actor);const selected=ids((await jsonBody(request)).publicationIds);
  const publications=(await pool.query('SELECT id,name,payload FROM shared_publications WHERE id=ANY($1::uuid[]) AND NOT withdrawn',[selected])).rows;
  if(publications.length!==selected.length)throw accountError('publication-unavailable',409);
  const results=await scopedOperation(pool,actor,async scoped=>{
   const results=[];for(const publication of publications)results.push(await importPublication(scoped,actor,publication));return results;
  });
  return sendAccount(response,201,{results});
 }
 return false;
}
