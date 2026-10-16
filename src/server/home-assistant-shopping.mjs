import { shoppingExportLine } from './shopping-presentation.mjs';

function endpoint(baseUrl,path) {
  const url=new URL(baseUrl);
  if(!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)throw new Error('invalid-home-assistant-url');
  return new URL(path,url.toString().replace(/\/+$/,'')+'/').toString();
}

export async function exportToHomeAssistant(items,entityId,{url,token,fetchImpl=fetch}={}) {
  if(!url || !token)return {error:'home-assistant-not-configured'};
  if(!/^todo\.[a-z0-9_]+$/.test(entityId??''))return {error:'home-assistant-list-not-configured'};
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const call=async(path,data)=>{
    const response=await fetchImpl(endpoint(url,path),{method:'POST',headers,body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(`home-assistant-http-${response.status}`);
    return response.json();
  };
  try {
    const result=await call('api/services/todo/get_items?return_response=true',{entity_id:entityId,status:'needs_action'});
    const current=result?.service_response?.[entityId]?.items??result?.[entityId]?.items;
    if(!Array.isArray(current))throw new Error('home-assistant-invalid-list-response');
    const desired=new Set(items.filter(item=>!item.checked).map(shoppingExportLine));
    const existing=new Set(current.map(item=>item.summary));
    let added=0,skipped=0;
    for(const name of desired) {
      if(existing.has(name)){skipped++;continue;}
      await call('api/services/todo/add_item',{entity_id:entityId,item:name});
      existing.add(name);added++;
    }
    let removed=0;
    for(const item of current) {
      // Legacy exports have no ownership metadata, so recognize only the exact
      // formatted lines produced by shoppingExportLine. Other list entries stay untouched.
      const isLapinouLine=typeof item.summary==='string' && (item.summary.includes(' — ') && item.summary.includes(' (Besoin : ')
        || / — .+ \(\d+ gousses? nécessaires \(≈ .+ tête\)\)$/.test(item.summary));
      if(!isLapinouLine || desired.has(item.summary))continue;
      await call('api/services/todo/remove_item',{entity_id:entityId,item:item.uid??item.summary});
      removed++;
    }
    return {added,skipped,removed};
  }catch(error){return {error:error.message.startsWith('home-assistant-http-')?error.message:'home-assistant-unavailable'};}
}
