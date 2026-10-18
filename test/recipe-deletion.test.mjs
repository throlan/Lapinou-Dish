import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {PGlite} from '@electric-sql/pglite';
import {createRecipe,readRecipe,deleteRecipe,validateRecipeInput,validateRecipeDeletion} from '../src/server/recipes.mjs';
import {saveRecipeImage,removeStoredRecipeImageFiles} from '../src/server/recipe-images.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {addStockLot,cancelStockLot} from '../src/server/household-planning.mjs';
import {handleRequest} from '../src/server/app.mjs';

const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
async function fixture(){
  const db=new PGlite(),directory=await mkdtemp(path.join(tmpdir(),'lapinou-delete-'));
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const householdId=randomUUID(),other=randomUUID(),foodId=randomUUID(),personId=randomUUID();
    await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic'),($2,'Other synthetic')",[householdId,other]);
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Test')",[personId,householdId]);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Test food','manual')",[foodId]);
    const create=async(split=false)=>{
      const checked=validateRecipeInput({householdId,name:'Same title',productionType:'batch_cooking',recipeType:'dish',yield:{amount:4,unitId:'portion'},
        ...(split?{separateStarch:true,servingMode:'separate',cookingFactors:{main:1,starch:3}}:{}),
        lines:[{foodId,quantity:100,unitId:'g',servingPart:'main'},...(split?[{foodId,quantity:50,unitId:'g',servingPart:'starch'}]:[])]});
      assert.equal(checked.error,undefined);return createRecipe(pool,checked.data);
    };
    return {db,pool,directory,householdId,other,foodId,personId,create,async close(){await db.close();await rm(directory,{recursive:true,force:true});}};
  }catch(error){await db.close();await rm(directory,{recursive:true,force:true});throw error;}
}

test('unused duplicate deletion removes only its id, generated parts and photo after commit',async()=>{
  const f=await fixture();
  try{
    const recipe=await f.create(true),duplicate=await f.create(true);
    await saveRecipeImage(f.pool,recipe.id,{householdId:f.householdId,mediaType:'image/png',source:'personal',image:png},{imageDirectory:f.directory});
    assert.equal((await readdir(f.directory)).length,1);
    assert.deepEqual(await deleteRecipe(f.pool,recipe.id,{householdId:f.householdId,version:recipe.version},{imageDirectory:f.directory}),{deleted:true,imageCleanupPending:false});
    for(const id of [recipe.id,...recipe.servingParts.map(p=>p.id)])assert.equal(await readRecipe(f.pool,id),null);
    assert.ok(await readRecipe(f.pool,duplicate.id));
    assert.equal((await f.pool.query('SELECT count(*) FROM recipe_images')).rows[0].count,0);
    assert.equal((await f.pool.query('SELECT count(*) FROM foods WHERE id=$1',[f.foodId])).rows[0].count,1);
    assert.deepEqual(await readdir(f.directory),[]);
    assert.equal(await deleteRecipe(f.pool,recipe.id,{householdId:f.householdId,version:recipe.version}),null);
  }finally{await f.close();}
});

test('menus protect both parent and generated parts, including prepared historical meals',async()=>{
  const f=await fixture();
  try{
    const recipe=await f.create(true),part=recipe.servingParts[0];
    const meal=await savePlannedMeal(f.pool,null,{householdId:f.householdId,mealDate:'2026-01-01',slot:'lunch',notes:'History',attendeeIds:[f.personId],items:[{recipeId:part.id,role:'main',amounts:[{personId:f.personId,quantity:50}]}]});
    await f.pool.query('UPDATE planned_meals SET prepared_at=now() WHERE id=$1',[meal.id]);
    assert.deepEqual(await deleteRecipe(f.pool,recipe.id,{householdId:f.householdId,version:recipe.version}),{error:'recipe-in-use',meals:1,productions:0});
    assert.ok(await readRecipe(f.pool,recipe.id));assert.ok(await readRecipe(f.pool,part.id));
    assert.equal((await f.pool.query('SELECT count(*) FROM planned_amounts')).rows[0].count,1);
  }finally{await f.close();}
});

test('production history remains protected even after cancellation',async()=>{
  const f=await fixture();
  try{
    const recipe=await f.create(true);
    const lot=await addStockLot(f.pool,{householdId:f.householdId,recipeId:recipe.id,quantity:4,producedOn:'2026-10-18',storage:'freezer',note:''});
    await cancelStockLot(f.pool,f.householdId,lot.id);
    const result=await deleteRecipe(f.pool,recipe.id,{householdId:f.householdId,version:recipe.version});
    assert.equal(result.error,'recipe-in-use');assert.equal(result.productions,3);
    assert.equal((await f.pool.query('SELECT count(*) FROM stock_lots')).rows[0].count,3);
    assert.ok(await readRecipe(f.pool,recipe.id));
  }finally{await f.close();}
});

test('deletion validates ownership, source recipe and current version before changing data',async()=>{
  const f=await fixture();
  try{
    const recipe=await f.create(true);
    assert.equal(await deleteRecipe(f.pool,recipe.id,{householdId:f.other,version:recipe.version}),null);
    assert.equal(await deleteRecipe(f.pool,recipe.servingParts[0].id,{householdId:f.householdId,version:recipe.version}),null);
    assert.deepEqual(await deleteRecipe(f.pool,recipe.id,{householdId:f.householdId,version:recipe.version+1}),{error:'recipe-version-conflict'});
    assert.ok(await readRecipe(f.pool,recipe.id));
    assert.equal(validateRecipeDeletion({householdId:f.householdId,version:recipe.version}).error,undefined);
    for(const version of [undefined,-1,'0',1.5,Infinity])assert.equal(validateRecipeDeletion({householdId:f.householdId,version}).error,'invalid-recipe-version');
    assert.equal(validateRecipeDeletion({householdId:'bad',version:0}).error,'invalid-household-id');
  }finally{await f.close();}
});

test('failed deletion restores database rows and does not remove the photo',async()=>{
  const f=await fixture();
  try{
    const recipe=await f.create(true);
    await saveRecipeImage(f.pool,recipe.id,{householdId:f.householdId,mediaType:'image/png',source:'personal',image:png},{imageDirectory:f.directory});
    const failing={async connect(){return {async query(sql,args){if(sql.startsWith('DELETE FROM recipes WHERE id='))throw Error('synthetic database failure');return f.pool.query(sql,args);},release(){}};}};
    await assert.rejects(deleteRecipe(failing,recipe.id,{householdId:f.householdId,version:recipe.version},{imageDirectory:f.directory}),/synthetic database failure/);
    assert.ok(await readRecipe(f.pool,recipe.id));for(const part of recipe.servingParts)assert.ok(await readRecipe(f.pool,part.id));
    assert.equal((await readdir(f.directory)).length,1);
    assert.equal((await f.pool.query('SELECT count(*) FROM recipe_images')).rows[0].count,1);
    assert.deepEqual(await deleteRecipe(f.pool,recipe.id,{householdId:f.householdId,version:recipe.version},{imageDirectory:null}),{deleted:true,imageCleanupPending:true});
    const keep=path.join(f.directory,'keep.txt');await writeFile(keep,'keep');
    assert.deepEqual(await removeStoredRecipeImageFiles(['../keep.txt'],{imageDirectory:f.directory}),{imageCleanupPending:true});
    assert.equal(await readFile(keep,'utf8'),'keep');
  }finally{await f.close();}
});

async function removeHTTP(id,body,pool,password=null){
  const request=Readable.from([Buffer.from(JSON.stringify(body))]);request.method='DELETE';request.url=`/api/recipes/${id}`;request.headers={};
  const response={setHeader(){},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(String(value));}};
  await handleRequest(request,response,pool,password);return response;
}

test('DELETE recipe API requires authentication and a validated body, and deletes an unused recipe',async()=>{
  const id=randomUUID(),h=randomUUID();let touched=false;
  const pool={query:async()=>{touched=true;throw Error('unexpected');},connect:async()=>{touched=true;throw Error('unexpected');}};
  assert.equal((await removeHTTP(id,{householdId:h,version:0},pool,'synthetic-password')).status,401);
  assert.equal((await removeHTTP(id,{householdId:h},pool)).status,400);assert.equal(touched,false);
  const f=await fixture();
  try{
    const recipe=await f.create();
    const response=await removeHTTP(recipe.id,{householdId:f.householdId,version:recipe.version},f.pool);
    assert.equal(response.status,200);assert.equal(response.body.deleted,true);
  }finally{await f.close();}
});
