const SLOTS = new Set(['breakfast','lunch','snack','dinner','evening_snack']);
const RECIPE_TYPES = new Set(['dish','accompaniment','salad','beverage','sauce','dessert']);
const ID_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;

export function validateMealAdditions(input) {
  if (!Array.isArray(input) || input.length > 20) return { error:'invalid-meal-additions' };
  const ids=new Set(), additions=[];
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || typeof item.id !== 'string' || !ID_PATTERN.test(item.id) || item.id === 'main' || ids.has(item.id)
      || typeof item.label !== 'string' || !item.label.trim() || item.label.trim().length > 60
      || typeof item.recipeType !== 'string' || !ID_PATTERN.test(item.recipeType)
      || (!RECIPE_TYPES.has(item.recipeType) && !/^custom-[a-z0-9_-]{1,33}$/.test(item.recipeType))
      || !Array.isArray(item.slots) || !item.slots.length
      || item.slots.some(slot=>!SLOTS.has(slot)) || new Set(item.slots).size!==item.slots.length) return { error:'invalid-meal-addition' };
    ids.add(item.id);
    const role=item.role == null ? (['beverage','sauce','dessert'].includes(item.recipeType)?item.recipeType:'accompaniment') : item.role;
    if(!['accompaniment','beverage','sauce','dessert'].includes(role))return {error:'invalid-meal-addition'};
    additions.push({id:item.id,label:item.label.trim(),recipeType:item.recipeType,role,slots:[...item.slots]});
  }
  return {data:additions};
}

export async function readMealAdditions(pool, householdId) {
  const result=await pool.query('SELECT meal_additions FROM households WHERE id=$1',[householdId]);
  return result.rows.length ? { additions:result.rows[0].meal_additions ?? [] } : null;
}

export async function saveMealAdditions(pool, householdId, input) {
  const checked=validateMealAdditions(input);
  if(checked.error)return checked;
  const result=await pool.query('UPDATE households SET meal_additions=$2::jsonb WHERE id=$1 RETURNING meal_additions',[householdId,JSON.stringify(checked.data)]);
  return result.rows.length ? {additions:result.rows[0].meal_additions} : {error:'household-not-found'};
}
