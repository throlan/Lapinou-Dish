const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const API_URL = 'https://world.openfoodfacts.org/api/v2';
const REQUEST_TIMEOUT_MS = 6000;

export async function searchOpenFoodFacts(query, fetchImpl = fetch) {
  const term = typeof query === 'string' ? query.trim().slice(0, 100) : '';
  if (term.length < 2) return [];
  const url = new URL(SEARCH_URL);
  url.search = new URLSearchParams({
    search_terms: term,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '8',
    fields: 'code,product_name,brands,quantity,nutriments',
  });
  const response = await fetchImpl(url, requestOptions());
  if (!response.ok) throw new Error(`open-food-facts-http-${response.status}`);
  const body = await response.json();
  return (Array.isArray(body.products) ? body.products : [])
    .map(mapProduct)
    .filter((product) => product && Object.values(product.nutrientsPer100g).some((value) => value !== null));
}

export async function getOpenFoodFactsProduct(barcode, fetchImpl = fetch) {
  if (!isBarcode(barcode)) return null;
  const fields = 'code,product_name,brands,quantity,nutriments';
  const url = `${API_URL}/product/${encodeURIComponent(barcode)}.json?fields=${fields}`;
  const response = await fetchImpl(url, requestOptions());
  if (!response.ok) throw new Error(`open-food-facts-http-${response.status}`);
  const body = await response.json();
  if (body.status !== 1 || !body.product) return null;
  return mapProduct(body.product);
}

function requestOptions() {
  return {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'LapinouDish/0.2.14 (household recipe nutrition lookup)',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
}

function mapProduct(product) {
  if (!product || !isBarcode(String(product.code ?? ''))) return null;
  const name = cleanText(product.product_name);
  if (!name) return null;
  const raw = product.nutriments ?? {};
  const energyKcal = parseNutrient(raw['energy-kcal_100g']) ?? parseNutrient(raw['energy-kcal-value_100g'])
    ?? (parseNutrient(raw['energy-kj_100g']) === null ? null : Math.round((parseNutrient(raw['energy-kj_100g']) / 4.184) * 10) / 10);
  return {
    barcode: String(product.code),
    name,
    brand: cleanText(product.brands),
    quantity: cleanText(product.quantity),
    url: `https://world.openfoodfacts.org/product/${encodeURIComponent(String(product.code))}`,
    nutrientsPer100g: {
      energyKcal,
      proteinG: parseNutrient(raw.proteins_100g),
      carbohydrateG: parseNutrient(raw.carbohydrates_100g),
      fatG: parseNutrient(raw.fat_100g),
      fibreG: parseNutrient(raw.fiber_100g),
    },
  };
}

function isBarcode(value) {
  return typeof value === 'string' && /^\d{8,14}$/.test(value);
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 200) || null : null;
}

function parseNutrient(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100000 ? number : null;
}
