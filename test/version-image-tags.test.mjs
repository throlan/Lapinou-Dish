import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateRelease,ensureVersionTags} from '../scripts/version-image-tags.mjs';
const image='ghcr.io/throlan/lapinou-dish',digest='sha256:'+'a'.repeat(64),older='sha256:'+'b'.repeat(64);
function registry(initial={}){
  const values=new Map(Object.entries(initial)),writes=[];
  return {values,writes,async inspect(tag){return values.get(tag)??null;},async tag(source,tags){writes.push({source,tags});for(const tag of tags)values.set(tag,source.split('@')[1]);}};
}
test('release aliases use the exact source digest and never move latest or delete images',async()=>{
  const r=registry({[image+':latest']:older});
  await ensureVersionTags({image,version:'0.2.97',digest},r,{strict:true});
  assert.deepEqual(r.writes,[{source:image+'@'+digest,tags:[image+':0.2.97',image+':v0.2.97']}]);
  assert.equal(r.values.get(image+':latest'),older);
  await ensureVersionTags({image,version:'0.2.97',digest},r,{strict:true});assert.equal(r.writes.length,1);
});
test('existing version tags survive documentation republishes and historical mismatches fail closed',async()=>{
  const r=registry({[image+':0.2.99']:older});
  const result=await ensureVersionTags({image,version:'0.2.99',digest},r);
  assert.equal(result.digest,older);assert.equal(r.values.get(image+':v0.2.99'),older);
  await assert.rejects(ensureVersionTags({image,version:'0.2.99',digest},r,{strict:true}),/Historical image mismatch/);
  r.values.set(image+':v0.2.99',digest);
  await assert.rejects(ensureVersionTags({image,version:'0.2.99',digest},r),/Conflicting/);
});
test('invalid references, registry errors and failed writes cannot silently retag a release',async()=>{
  for(const patch of [{image:'bad; command'},{version:'latest'},{digest:'latest'}])await assert.rejects(ensureVersionTags({image,version:'0.2.99',digest,...patch},registry()),/Invalid/);
  await assert.rejects(ensureVersionTags({image,version:'0.2.99',digest},{inspect:async()=>{throw Error('unauthorized');}}),/unauthorized/);
  const r=registry();r.tag=async()=>{};
  await assert.rejects(ensureVersionTags({image,version:'0.2.99',digest},r),/Verification failed/);
  const recovery=JSON.parse(await readFile(new URL('../docker/rollback-images.json',import.meta.url),'utf8'));
  recovery.forEach(release=>validateRelease({...release,image}));
  assert.deepEqual(recovery.map(r=>r.version),['0.2.95','0.2.96','0.2.97','0.2.98','0.2.99']);
});
