import test from 'node:test';
import assert from 'node:assert/strict';
import proposals from '../src/server/catalogue-proposals.json' with { type: 'json' };

test('new USDA portion suggestions remain sourced, distinct and review only', () => {
  const newCodes = new Set(['11064', '11066', '11077', '10999', '11034', '11036', '15034', '11065', '11039', '11050', '11062', '15052', '11061', '15203']);
  const batch = proposals.filter(item => newCodes.has(item.code));
  assert.equal(batch.length, 27);
  assert.equal(new Set(batch.map(item => item.code)).size, 14);
  assert.equal(new Set(batch.map(item => `${item.code}:${item.field}`)).size, batch.length);
  assert.ok(batch.every(item => ['tspGrams', 'tbspGrams'].includes(item.field)
    && Number.isFinite(item.value) && item.value > 0
    && item.source.includes('FoodData Central')
    && item.url.startsWith('https://fdc.nal.usda.gov/')
    && /FDC \d{6}/.test(item.method)));
  assert.equal(batch.filter(item => item.referenceOnly).length, 8);
  assert.equal(batch.find(item => item.code === '11064' && item.field === 'tspGrams').value, 2.1);
  assert.equal(batch.find(item => item.code === '11061' && item.field === 'tbspGrams').value, 8.8);
  assert.equal(batch.find(item => item.code === '11039' && item.field === 'tspGrams').referenceOnly, true);
});
