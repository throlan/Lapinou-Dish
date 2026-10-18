// Calendar quantities remain canonical (estimated grams for split services).
// Only unambiguous single-ingredient count services have a count equivalent.
function hasCountedServing(recipe) {
  return recipe?.yield?.unitId==='g' && ['piece','slice'].includes(recipe?.servingDisplay?.unitId)
    && Number.isFinite(recipe.servingDisplay.gramsPerUnit) && recipe.servingDisplay.gramsPerUnit>0;
}
export function servingScale(recipe) { return hasCountedServing(recipe)?recipe.servingDisplay.gramsPerUnit:1; }
export function servingUnit(recipe) { return hasCountedServing(recipe)?recipe.servingDisplay.unitId:recipe?.yield?.unitId??'portion'; }
export function servingUnitLabel(unit) { return {piece:'pièce',slice:'tranche',portion:'portion'}[unit]??unit; }
export function displayServingQuantity(recipe,quantity) { return Number(quantity)/servingScale(recipe); }
export function canonicalServingQuantity(recipe,quantity) { return Math.round(Number(quantity)*servingScale(recipe)*1e5)/1e5; }
export function setServingInput(input,recipe,quantity) {
  if(servingUnit(recipe)===recipe?.yield?.unitId)return;
  input.dataset.quantityScale=String(servingScale(recipe));
  input.dataset.canonicalQuantity=String(quantity??'');
  input.value=quantity==null||quantity===''?'':String(Number(displayServingQuantity(recipe,quantity).toFixed(6)));
  input.dataset.displayQuantity=input.value;
  input.step='any'; // Existing fractional menus must remain saveable unchanged.
  input.min='0.000001';
}
export function servingInputValue(input) {
  const scale=Number(input.dataset?.quantityScale);
  if(!(scale>0))return input.value;
  if(input.value===input.dataset.displayQuantity)return input.dataset.canonicalQuantity;
  return input.value===''?'':String(Math.round(Number(input.value)*scale*1e5)/1e5);
}
