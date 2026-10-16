import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateRecipeImage, inspectRecipeImageStorage, migrateLegacyRecipeImages, readRecipeImage, recipeImageStorageConfig, removeRecipeImage, saveRecipeImage, validateRecipeImageUpload } from '../src/server/recipe-images.mjs';

const householdId='11111111-1111-4111-8111-111111111111';
const recipeId='22222222-2222-4222-8222-222222222222';
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);

test('personal uploads accept only supported image signatures and bounded base64',()=>{
  assert.equal(validateRecipeImageUpload({householdId,mediaType:'image/png',imageBase64:png.toString('base64')}).data.source,'personal');
  assert.equal(validateRecipeImageUpload({householdId,mediaType:'image/jpeg',imageBase64:png.toString('base64')}).error,'invalid-recipe-image');
  assert.equal(validateRecipeImageUpload({householdId,mediaType:'image/gif',imageBase64:'R0lGODlh'}).error,'invalid-recipe-image');
});

test('recipe image storage reports the configured directory and whether it is a mounted writable volume',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'lapinou-images-'));
  const mountInfoPath=path.join(directory,'mountinfo');
  try{
    assert.deepEqual(recipeImageStorageConfig(' /images '),{mode:'filesystem',directory:path.resolve('/images')});
    assert.deepEqual(recipeImageStorageConfig('  '),{mode:'database',directory:null});
    await writeFile(mountInfoPath,`1 0 0:1 / / rw - overlay overlay rw\n2 1 0:2 / ${directory} rw - ext4 /dev/test rw`);
    const status=await inspectRecipeImageStorage(directory,{mountInfoPath,platform:'linux'});
    assert.equal(status.mode,'filesystem');
    assert.equal(status.mounted,true);
    assert.equal(status.mountPoint,directory);
    assert.equal(status.writable,true);
    await writeFile(mountInfoPath,'1 0 0:1 / / rw - overlay overlay rw');
    assert.equal((await inspectRecipeImageStorage(directory,{mountInfoPath,platform:'linux'})).mounted,false);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('image generation avoids network without a key and validates returned image data',async()=>{
  let called=false;
  assert.deepEqual(await generateRecipeImage('photo',{fetchImpl:async()=>{called=true;}}),{error:'openai-not-configured'});
  assert.equal(called,false);
  const result=await generateRecipeImage('photo',{apiKey:'test-key',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/images/generations');
    assert.equal(JSON.parse(options.body).model,'gpt-image-2.5-sunburst');
    return {ok:true,json:async()=>({data:[{b64_json:png.toString('base64')}]})};
  }});
  assert.equal(result.data.mediaType,'image/png');
  assert.equal(result.data.source,'openai');
});

test('image generation retains only safe OpenAI access diagnostics for 401 and 403 errors',async()=>{
  const call=(status,code)=>generateRecipeImage('photo',{apiKey:'test-key',fetchImpl:async()=>({status,ok:false,headers:{get:name=>name==='x-request-id'?'req_123':null},json:async()=>({error:{code,message:'Do not expose provider message or secrets'}})})});
  assert.deepEqual(await call(401,'invalid_api_key'),{error:'openai-access-denied',providerStatus:401,providerCode:'invalid_api_key',requestId:'req_123'});
  assert.deepEqual(await call(403,'organization_verification_required'),{error:'openai-access-denied',providerStatus:403,providerCode:'organization_verification_required',requestId:'req_123'});
});

test('recipe images are stored as private files, can be read, replaced and removed',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'lapinou-images-'));
  let row=null;
  const pool={async query(sql,values=[]){
    if(sql.startsWith('SELECT id FROM recipes'))return{rowCount:1,rows:[{id:recipeId}]};
    if(sql.startsWith('SELECT file_name FROM recipe_images'))return{rowCount:row?1:0,rows:row?[{file_name:row.file_name}]:[]};
    if(sql.startsWith('INSERT INTO recipe_images')){row={recipe_id:values[0],media_type:values[1],source:values[2],image_bytes:values[3],file_name:values[4]};return{rowCount:1,rows:[]};}
    if(sql.includes('SELECT i.media_type'))return{rowCount:row?1:0,rows:row?[row]:[]};
    if(sql.startsWith('DELETE FROM recipe_images')){const deleted=row;row=null;return{rowCount:deleted?1:0,rows:deleted?[{recipe_id:recipeId,file_name:deleted.file_name}]:[]};}
    throw new Error(`Unexpected query: ${sql}`);
  }};
  try{
    const data={householdId,mediaType:'image/png',image:png,source:'personal'};
    const saved=await saveRecipeImage(pool,recipeId,data,{imageDirectory:directory});
    assert.deepEqual(saved.storage,{mode:'filesystem',directory});
    assert.equal(row.image_bytes,null);
    assert.match(row.file_name,/^22222222-2222-4222-8222-222222222222-[0-9a-f-]{36}\.png$/);
    assert.deepEqual(await readFile(path.join(directory,row.file_name)),png);
    assert.deepEqual(await readRecipeImage(pool,recipeId,householdId,{imageDirectory:directory}),{mediaType:'image/png',image:png});
    const firstFile=row.file_name;
    await saveRecipeImage(pool,recipeId,{...data,source:'openai'},{imageDirectory:directory});
    assert.notEqual(row.file_name,firstFile);
    assert.deepEqual(await readdir(directory),[row.file_name]);
    assert.equal(await removeRecipeImage(pool,recipeId,householdId,{imageDirectory:directory}),true);
    assert.deepEqual(await readdir(directory),[]);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('existing database images migrate to files without losing image content',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'lapinou-images-'));
  let row={recipe_id:recipeId,media_type:'image/png',image_bytes:png,file_name:null};
  const pool={async query(sql,values=[]){
    if(sql.startsWith('SELECT recipe_id, media_type, image_bytes'))return{rows:row?.image_bytes?[{...row}]:[]};
    if(sql.startsWith('UPDATE recipe_images')){row={...row,image_bytes:null,file_name:values[1]};return{rowCount:1,rows:[]};}
    throw new Error(`Unexpected query: ${sql}`);
  }};
  try{
    assert.equal(await migrateLegacyRecipeImages(pool,{imageDirectory:directory}),1);
    assert.equal(row.image_bytes,null);
    assert.deepEqual(await readFile(path.join(directory,row.file_name)),png);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('recipe images stay in PostgreSQL when no persistent folder is configured',async()=>{
  let row=null;
  const pool={async query(sql,values=[]){
    if(sql.startsWith('SELECT id FROM recipes'))return{rowCount:1,rows:[{id:recipeId}]};
    if(sql.startsWith('SELECT file_name FROM recipe_images'))return{rows:[]};
    if(sql.startsWith('INSERT INTO recipe_images')){row={media_type:values[1],image_bytes:values[3],file_name:values[4]};return{rowCount:1,rows:[]};}
    if(sql.includes('SELECT i.media_type'))return{rows:[row]};
    throw new Error(`Unexpected query: ${sql}`);
  }};
  await saveRecipeImage(pool,recipeId,{householdId,mediaType:'image/png',image:png,source:'personal'},{imageDirectory:null});
  assert.deepEqual(await readRecipeImage(pool,recipeId,householdId,{imageDirectory:null}),{mediaType:'image/png',image:png});
});
