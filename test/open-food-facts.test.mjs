import test from 'node:test';
import assert from 'node:assert/strict';
import { getOpenFoodFactsProduct, searchOpenFoodFacts } from '../src/server/open-food-facts.mjs';

test('Open Food Facts search uses its full-text endpoint and maps per-100g values', async () => {
  let requested;
  const products = await searchOpenFoodFacts('compote de pommes', async (url, options) => {
    requested = { url: new URL(url), options };
    return jsonResponse({ products: [{
      code: '12345678', product_name: 'Compote pomme', brands: 'Marque', quantity: '100 g',
      nutriments: { 'energy-kj_100g': '418.4', proteins_100g: '0.2', carbohydrates_100g: '12', fat_100g: '0.1', fiber_100g: '1.2' },
    }] });
  });

  assert.equal(requested.url.hostname, 'world.openfoodfacts.org');
  assert.equal(requested.url.pathname, '/cgi/search.pl');
  assert.equal(requested.url.searchParams.get('search_terms'), 'compote de pommes');
  assert.equal(requested.url.searchParams.get('fields'), 'code,product_name,brands,quantity,nutriments');
  assert.match(requested.options.headers['User-Agent'], /LapinouDish/);
  assert.deepEqual(products[0].nutrientsPer100g, { energyKcal: 100, proteinG: 0.2, carbohydrateG: 12, fatG: 0.1, fibreG: 1.2 });
  assert.equal(products[0].url, 'https://world.openfoodfacts.org/product/12345678');
});

test('Open Food Facts ignores products without a usable name or nutrition data', async () => {
  const products = await searchOpenFoodFacts('test', async () => jsonResponse({ products: [
    { code: '12345678', product_name: 'Sans nutriments', nutriments: {} },
    { code: '12345679', product_name: '', nutriments: { proteins_100g: 2 } },
  ] }));
  assert.deepEqual(products, []);
});

test('product lookup validates barcodes and handles missing products', async () => {
  let called = false;
  assert.equal(await getOpenFoodFactsProduct('not-a-barcode', async () => { called = true; }), null);
  assert.equal(called, false);
  assert.equal(await getOpenFoodFactsProduct('12345678', async () => jsonResponse({ status: 0 })), null);
});

function jsonResponse(body) {
  return { ok: true, async json() { return body; } };
}
