import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRecipeImage, validateRecipeImageUpload } from '../src/server/recipe-images.mjs';

const householdId='11111111-1111-4111-8111-111111111111';
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);

test('personal uploads accept only supported image signatures and bounded base64',()=>{
  assert.equal(validateRecipeImageUpload({householdId,mediaType:'image/png',imageBase64:png.toString('base64')}).data.source,'personal');
  assert.equal(validateRecipeImageUpload({householdId,mediaType:'image/jpeg',imageBase64:png.toString('base64')}).error,'invalid-recipe-image');
  assert.equal(validateRecipeImageUpload({householdId,mediaType:'image/gif',imageBase64:'R0lGODlh'}).error,'invalid-recipe-image');
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
