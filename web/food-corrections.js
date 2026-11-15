const measureFields = {tsp:'tspGrams',tbsp:'tbspGrams',scoop:'scoopGrams',cup:'cupGrams',piece:'pieceGrams'};
export const foodMeasureVolumes = {tspGrams:5,tbspGrams:15,scoopGrams:60,cupGrams:240};
export const foodMeasureLabels = {gramsPerMillilitre:'la densité',tspGrams:'la c. à café de 5 ml',tbspGrams:'la c. à soupe de 15 ml',scoopGrams:'le scoop de 60 ml',cupGrams:'la cup de 240 ml'};

// Derived values are a view of the explicit measurements, never a second saved
// measurement that would become stale when its source is corrected later.
export function deriveFoodMeasures(values) {
  const known=field=>Number.isFinite(values[field])&&values[field]>0;
  const fields=['gramsPerMillilitre',...Object.keys(foodMeasureVolumes)];
  const source=fields.find(known);
  const density=source?(source==='gramsPerMillilitre'?values[source]:values[source]/foodMeasureVolumes[source]):null;
  return Object.fromEntries(fields.map(field=>[field,known(field)?{value:values[field],derived:false,source:field}:
    density==null?{value:null,derived:false,source:null}:{value:Number((density*(foodMeasureVolumes[field]??1)).toPrecision(12)),derived:true,source}]));
}

export function foodCorrectionField(line, issue) {
  if (issue.reason === 'unit-conversion-missing') return measureFields[line?.unitId] ?? 'gramsPerMillilitre';
  return issue.missingNutrients?.[0] ?? 'energyKcal';
}

// Unexposed historical conversions must survive edits of the simpler food form.
export function foodMeasurePayload(existing, values) {
  const result = {...existing};
  for (const [unit, field] of Object.entries(measureFields)) {
    if (values[field] == null) delete result[unit];
    else result[unit] = values[field];
  }
  return result;
}

export function foodMeasureComparisons(values) {
  const density = values.gramsPerMillilitre;
  if (!(density > 0)) return [];
  return [['tspGrams',5,'c. à café'],['tbspGrams',15,'c. à soupe'],['scoopGrams',60,'scoop de 60 ml'],['cupGrams',240,'cup de 240 ml']]
    .filter(([field, ml]) => values[field] > 0 && Math.abs(values[field] - density * ml) > Math.max(0.1, density * ml * 0.05))
    .map(([field, ml, label]) => ({field, label, measured:values[field], fromDensity:density * ml}));
}

export function foodPurchaseMode(form) {
  const named = form.elements.purchaseMode.value === 'named';
  form.querySelector('#food-purchase-unit-settings').hidden = !named;
  form.elements.shoppingPackageQuantity.closest('label').hidden = named;
  // The named package's content unit also defines its shopping classification.
  form.elements.shoppingUnitId.closest('label').hidden = named;
  return named;
}
