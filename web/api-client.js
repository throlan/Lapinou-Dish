// Share concurrent reads; only the expensive recipe catalogue has a short cache.
// A write invalidates it immediately, including reads started before that write.
export function createApiClient(fetcher=fetch,now=()=>Date.now()){
 const pending=new Map(),cache=new Map();let generation=0;
 function api(path,options={}){
  const {timeoutMs,...requestOptions}=options,method=(options.method??'GET').toUpperCase(),read=method==='GET'&&!options.signal;
  const key=path,cacheable=read&&/^\/api\/recipes\?/.test(path),version=generation;
  if(method!=='GET'&&path!=='/api/planning/copy-preview'){generation++;cache.clear();pending.clear();}
  if(cacheable&&cache.get(key)?.expires>now())return Promise.resolve(structuredClone(cache.get(key).value));
  if(read&&pending.has(key))return pending.get(key).then(structuredClone);
  const task=(async()=>{
   let response;try{response=await fetcher(path,{...requestOptions,signal:options.signal??AbortSignal.timeout(timeoutMs??30000),headers:{'Content-Type':'application/json',...(options.headers??{})}});}
   catch(error){if(error.name==='TimeoutError')throw new Error('Le serveur met trop de temps à répondre. Réessaie.');throw error;}
   const body=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(body.error??`HTTP ${response.status}`),{status:response.status,body});
   if(cacheable&&version===generation)cache.set(key,{value:structuredClone(body),expires:now()+60000});return body;
  })();
  if(read){pending.set(key,task);task.finally(()=>{if(pending.get(key)===task)pending.delete(key);}).catch(()=>{});}
  return task.then(structuredClone);
 }
 api.revision=()=>generation;return api;
}
