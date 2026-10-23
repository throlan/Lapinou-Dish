import {spawnSync} from 'node:child_process';
import {readFile,appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const digestPattern=/^sha256:[a-f0-9]{64}$/;
export function validateRelease({image,version,digest}){
  if(!/^ghcr\.io\/[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/.test(image))throw new Error('Invalid GHCR image');
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid release version');
  if(!digestPattern.test(digest))throw new Error('Invalid manifest digest');
}

// Published version tags are retained, including when a documentation-only main
// commit creates another image with the same package version. Never move latest.
export async function ensureVersionTags(release,registry,{strict=false}={}){
  validateRelease(release);
  const {image,version,digest}=release;
  const tags=[`${image}:${version}`,`${image}:v${version}`];
  const found=await Promise.all(tags.map(tag=>registry.inspect(tag)));
  for(const value of found)if(value!==null&&!digestPattern.test(value))throw new Error('Invalid registry digest');
  const existing=found.filter(Boolean);
  if(new Set(existing).size>1)throw new Error(`Conflicting existing tags for ${version}`);
  const target=existing[0]??digest;
  if(strict&&target!==digest)throw new Error(`Historical image mismatch for ${version}`);
  const missing=tags.filter((_,index)=>!found[index]);
  if(missing.length)await registry.tag(`${image}@${target}`,missing);
  for(const tag of tags)if(await registry.inspect(tag)!==target)throw new Error(`Verification failed: ${tag}`);
  return {version,digest:target,status:missing.length?'tagged':target===digest?'verified':'retained'};
}

function docker(args){
  const result=spawnSync('docker',['buildx','imagetools',...args],{encoding:'utf8',timeout:120000});
  if(result.error)throw result.error;
  if(result.status!==0){const error=new Error(result.stderr||result.stdout||'Docker command failed');error.dockerFailure=true;throw error;}
  return result.stdout;
}
const registry={
  async inspect(reference){
    try{
      const output=docker(['inspect',reference,'--format','{{.Manifest}}']);
      const digest=output.match(/^Digest:\s+(sha256:[a-f0-9]{64})\s*$/m)?.[1];
      if(!digest)throw new Error(`No manifest digest for ${reference}`);
      return digest;
    }catch(error){
      if(error.dockerFailure&&/manifest unknown|not found|404 Not Found/i.test(error.message))return null;
      throw error;
    }
  },
  async tag(source,tags){docker(['create','--prefer-index=false',...tags.flatMap(tag=>['--tag',tag]),source]);}
};

async function main(){
  const image=process.env.RELEASE_IMAGE,digest=process.env.RELEASE_DIGEST;
  const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const releases=JSON.parse(await readFile(new URL('../docker/rollback-images.json',import.meta.url),'utf8'));
  for(const release of [...releases,{version,digest}])validateRelease({...release,image});
  const results=[];
  for(const release of releases)results.push(await ensureVersionTags({...release,image},registry,{strict:true}));
  results.push(await ensureVersionTags({image,version,digest},registry));
  const summary=['## Versioned images retained (no automatic deletion)','',
    '| Version | Manifest digest | Result |','| --- | --- | --- |',
    ...results.map(row=>`| ${row.version} | ${row.digest} | ${row.status} |`),'',
    `Rollback: \`${image}:0.2.97\` (also available with a v prefix).`,
    'Version 0.2.98 is retained for traceability but has the known startup defect; prefer 0.2.97 or 0.2.99.',''].join('\n');
  console.log(summary);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
