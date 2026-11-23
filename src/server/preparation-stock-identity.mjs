// Recipe snapshots keep their own ingredients and menu history. Only finished
// stock is pooled when the original recipe, choices and stock units agree.
export async function loadPreparationStockIdentity(client,householdId) {
  const {rows}=await client.query(`SELECT id,parent_recipe_id,choice_instance,choice_origin,production_type,replaced_by_recipe_id,
    serving_part,serving_part_active,separate_starch,yield_unit_id
    FROM recipes WHERE household_id=$1 ORDER BY created_at DESC,id DESC`,[householdId]);
  const roots=new Map(rows.filter(row=>!row.parent_recipe_id).map(row=>[row.id,row]));
  function currentRoot(id) {
    const visited=new Set();
    while(roots.get(id)?.replaced_by_recipe_id&&!visited.has(id)){
      visited.add(id);
      id=roots.get(id).replaced_by_recipe_id;
    }
    return id;
  }
  const services=new Map();
  for(const row of rows){
    if(!row.parent_recipe_id||row.serving_part_active===false)continue;
    if(!services.has(row.parent_recipe_id))services.set(row.parent_recipe_id,[]);
    services.get(row.parent_recipe_id).push(row.serving_part);
  }
  for(const parts of services.values())parts.sort();
  const groups=new Map(),keys=new Map(),members=new Map();
  for(const row of rows){
    if(row.production_type==='none'||row.serving_part_active===false)continue;
    const root=roots.get(row.parent_recipe_id??row.id);
    const origin=root?.choice_instance?root.choice_origin:null;
    if(root?.choice_instance&&(!origin?.templateId||!origin.selection))continue;
    const selection=origin?Object.entries(origin.selection).sort(([a],[b])=>a.localeCompare(b)):null;
    if(origin&&!selection.length)continue;
    const part=row.parent_recipe_id?row.serving_part:row.separate_starch?'bundle':'whole';
    const signature=JSON.stringify([currentRoot(origin?.templateId??root?.id??row.id),selection,
      services.get(root?.id)??[],part,row.yield_unit_id]);
    if(!groups.has(signature))groups.set(signature,[]);
    groups.get(signature).push(row.id);
  }
  for(const ids of groups.values()){
    if(ids.length<2)continue;
    const primary=ids[0];
    members.set(primary,ids);
    for(const id of ids)keys.set(id,primary);
  }
  const key=id=>keys.get(id)??id;
  return {key,members:id=>members.get(key(id))??[id]};
}

export function sumPreparationStock(quantities,identity){
  const pooled=new Map();
  for(const [id,quantity] of quantities){
    const key=identity.key(id);
    pooled.set(key,(pooled.get(key)??0)+quantity);
  }
  return pooled;
}
