import { inflateRawSync } from 'node:zlib';

const MAX_ARCHIVE_ENTRIES = 2000;
const MAX_RECIPE_COUNT = 1000;
const MAX_ARCHIVE_UNCOMPRESSED = 80_000_000;

export function parseRecipeText(text, sourceUrl = null) {
  if (typeof text !== 'string' || !text.trim() || text.length > 100_000) return { error: 'invalid-recipe-text' };
  const rawLines = text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const lines = rawLines.map(stripMarkup);
  const titleIndex = lines.findIndex((line, index) => !/^(@|https?:\/\/|vérifié$)/i.test(line) && !/^\[[^\]]+\]\(https?:\/\/www?\.?instagram\.com\//i.test(rawLines[index]));
  const name = titleIndex >= 0 ? lines[titleIndex].replace(/\\+$/, '').replace(/:\s*(?:environ\s*)?\d+(?:[,.]\d+)?\s*(?:kcal|calories).*$/i, '').trim() : 'Recette importée';
  const servingsMatch = text.match(/(?:pour|donne|yield)\s+(\d+(?:[,.]\d+)?)\s+([^\n:]+)?/i);
  const yieldAmount = servingsMatch ? Number(servingsMatch[1].replace(',', '.')) : 1;
  const ingredientLines = [];
  const instructionLines = [];
  let section = 'before';
  for (const line of lines.slice(Math.max(0, titleIndex + 1))) {
    if (/^(pour\s+\d+|ingrédients?\s*:?)$/i.test(line)) { section = 'ingredients'; continue; }
    if (/^(préparation|instructions?|étapes?)\s*: ?$/i.test(line)) { section = 'instructions'; continue; }
    if (/^(pour\s+\d+\s+(?:muffin|portion|personne|pièce))/i.test(line)) { section = 'ingredients'; continue; }
    if (/^\d+\s*(?:kcal|calories)|environ\s+\d+\s*(?:kcal|calories)/i.test(line)) { section = 'done'; continue; }
    if (/^retouve|^retrouve|^enregistre|^suis\s+la|^crédit/i.test(line)) continue;
    if (section === 'done') continue;
    if (section === 'ingredients' || (section === 'before' && looksLikeIngredient(line))) {
      if (looksLikeIngredient(line)) ingredientLines.push(toDraftLine(line));
      else if (section === 'ingredients') section = 'instructions';
    }
    if (section === 'instructions') instructionLines.push(line);
  }
  const description = lines.slice(titleIndex + 1).find((line) => !looksLikeIngredient(line) && !/^(?:pour\s+\d+.*|ingrédients?\s*:?)$/i.test(line)) ?? '';
  return { data: { name: name.slice(0, 200), description: description.slice(0, 2000), yieldAmount: Number.isFinite(yieldAmount) && yieldAmount > 0 ? yieldAmount : 1, yieldUnitId: /muffin|œuf|oeuf|pièce/i.test(servingsMatch?.[2] ?? '') ? 'piece' : 'portion', ingredients: ingredientLines.slice(0, 300), instructions: instructionLines.join('\n').slice(0, 20_000), sourceUrl, sourceKind: sourceUrl ? platformFor(sourceUrl) : 'clipboard', rawText: text } };
}

function looksLikeIngredient(line) {
  return /^(?:[-•*]\s*)?(?:\d+(?:[.,/]\d+)?|\d+\s*\/\s*\d+)\s*(?:g|kg|mg|ml|cl|l|c\.?\s*(?:à\s*)?(?:café|soupe)|cuillères?|tasses?|œufs?|oeufs?|pièces?|gousses?|tranches?|pincées?)?\b/i.test(line)
    || /^[-•*]\s*[^.!?]{2,80}$/u.test(line);
}

function toDraftLine(rawText) {
  const clean = rawText.replace(/^[-•*]\s*/, '').trim();
  const match = clean.match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*(g|kg|mg|ml|cl|l|c\.?\s*(?:à\s*)?(?:café|soupe)|cuillères?\s+(?:à\s+)?(?:café|soupe)|tasses?|œufs?|oeufs?|pièces?|gousses?|tranches?|pincées?)?\s+(.+)$/i);
  if (!match) return { rawText: clean, quantity: null, unit: null, foodName: clean.replace(/@\w+/g, '').trim() };
  const quantity = match[1].includes('/') ? match[1].split('/').map(Number).reduce((a, b) => a / b) : Number(match[1].replace(',', '.'));
  return { rawText: clean, quantity, unit: match[2] ?? null, foodName: match[3].trim().replace(/@\w+/g, '').replace(/\s+/g, ' ').replace(/^(?:de\s+l['’]|de|du|des)\s*/i, '').trim() };
}

function stripMarkup(value) {
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1').replace(/&nbsp;/gi, ' ').trim();
}

function platformFor(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  } catch { return 'url'; }
  return 'url';
}

export function parseRecipeArchive(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const files = readZip(bytes);
  const recipes = [];
  let skipped = 0;
  const manifest = files.get('manifest.json');
  if (manifest) {
    const data = JSON.parse(manifest.toString('utf8'));
    if (data.format !== 'norish-recipes' || data.formatVersion !== 1) throw new Error('unsupported-norish-archive');
    for (const [path, content] of files) {
      if (!/^[^/]+\/recipe\.json$/.test(path)) continue;
      const normalized = normalizeNorish(JSON.parse(content.toString('utf8')), path);
      if (normalized.ingredients.length) recipes.push(normalized); else skipped++;
    }
  } else {
    for (const [path, content] of files) {
      if (!path.toLowerCase().endsWith('.zip')) continue;
      const nested = readZip(content);
      const recipe = nested.get('recipe.json');
      if (recipe) {
        const normalized = normalizeTandoor(JSON.parse(recipe.toString('utf8')), path);
        if (normalized.ingredients.length) recipes.push(normalized); else skipped++;
      }
    }
  }
  if (!recipes.length) throw new Error('no-recipes-found');
  if (recipes.length > MAX_RECIPE_COUNT) throw new Error('too-many-recipes');
  return { recipes, skipped };
}

function normalizeNorish(recipe, path) {
  return { externalId: path.split('/')[0], sourceKind: 'file', sourceUrl: recipe.url ?? null, name: recipe.name ?? 'Recette importée', description: recipe.description ?? '', yieldAmount: positive(recipe.servings, 1), yieldUnitId: 'portion', ingredients: (recipe.recipeIngredients ?? []).map((item) => ({ rawText: [item.amount, item.unit, item.ingredientName].filter(Boolean).join(' '), quantity: positive(item.amount, null), unit: item.unit ?? null, foodName: item.ingredientName ?? '' })), instructions: (recipe.steps ?? []).map((step) => step.step).filter(Boolean).join('\n'), rawPayload: recipe };
}

function normalizeTandoor(recipe, path) {
  const ingredients = [];
  const instructions = [];
  for (const step of recipe.steps ?? []) {
    if (step.instruction?.trim()) instructions.push(step.instruction.trim());
    for (const item of step.ingredients ?? []) {
      const foodName = item.food?.name ?? item.food_name ?? '';
      const unit = item.unit?.name ?? item.unit_name ?? null;
      const amount = item.no_amount ? null : positive(item.amount, null);
      ingredients.push({ rawText: [amount, unit, foodName, item.note].filter(Boolean).join(' '), quantity: amount, unit, foodName });
    }
  }
  return { externalId: path, sourceKind: 'file', sourceUrl: recipe.source_url ?? null, name: recipe.name ?? 'Recette importée', description: recipe.description ?? '', yieldAmount: positive(recipe.servings, 1), yieldUnitId: 'portion', ingredients, instructions: instructions.join('\n'), rawPayload: recipe };
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readZip(buffer) {
  const min = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= min; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('invalid-zip');
  const count = buffer.readUInt16LE(eocd + 10);
  if (count > MAX_ARCHIVE_ENTRIES) throw new Error('too-many-archive-entries');
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = new Map();
  let totalUncompressed = 0;
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('invalid-zip-directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8').replace(/\\/g, '/');
    offset += 46 + nameLength + extraLength + commentLength;
    if (!name || name.startsWith('/') || name.split('/').includes('..') || name.endsWith('/')) continue;
    if (uncompressedSize > 20_000_000) throw new Error('archive-entry-too-large');
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED) throw new Error('archive-expands-too-large');
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('invalid-zip-entry');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed, { maxOutputLength: 20_000_000 }) : null;
    if (!data || data.length !== uncompressedSize) throw new Error('unsupported-or-corrupt-zip-entry');
    files.set(name, data);
  }
  return files;
}
