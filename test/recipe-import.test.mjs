import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipeArchive, parseRecipeText } from '../src/domain/recipe-import.mjs';
import {readFile} from 'node:fs/promises';

test('the supplied bread recipe imports as twenty slices with eight fixed ingredients',async()=>{
  const text=await readFile(new URL('../docs/recettes/pain-de-mie-graines-francine-t110.txt',import.meta.url),'utf8');
  const parsed=parseRecipeText(text).data;
  assert.equal(parsed.yieldAmount,20);assert.equal(parsed.yieldUnitId,'slice');
  assert.deepEqual(parsed.ingredients.map(line=>line.quantity),[350,150,250,100,20,10,8,7]);
  assert.ok(parsed.ingredients.every(line=>line.unit==='g'));
  assert.match(parsed.instructions,/découper le pain en 20 tranches/);
});

test('pasted social caption becomes an editable draft without trusting claimed macros', () => {
  const parsed = parseRecipeText(`[**b_jumpingggg**](https://www.instagram.com/jb_jumpingggg/)\nVérifié\n9 MUFFINS PROTÉINÉS FRAMBOISE : environ 80 kcal par muffin\nGourmands et moelleux.\nPour 9 muffins :\n100 g de compote de pommes\n2 œufs\n60 g de Whey vanille [@vitastrong_france](https://www.instagram.com/vitastrong_france/)\n50 g de beurre de cacahuète\n100 g de framboises surgelées\nTu mélanges et tu cuis 15 minutes.\nPour 1 muffin : environ 80 kcal, 8 g protéines\nEnregistre la recette.`);
  assert.equal(parsed.data.name, '9 MUFFINS PROTÉINÉS FRAMBOISE');
  assert.equal(parsed.data.yieldAmount, 9);
  assert.equal(parsed.data.yieldUnitId, 'piece');
  assert.deepEqual(parsed.data.ingredients.map(({ foodName, quantity }) => [foodName, quantity]), [
    ['compote de pommes', 100], ['œufs', 2], ['Whey vanille', 60], ['beurre de cacahuète', 50], ['framboises surgelées', 100],
  ]);
  assert.equal(parsed.data.instructions, 'Tu mélanges et tu cuis 15 minutes.');
});

test('Tandoor nested ZIP becomes recipe drafts and skips non-recipe records', () => {
  const nested = zip({ 'recipe.json': JSON.stringify({
    name: 'Muffins framboise', description: 'Moelleux', servings: 9, source_url: 'https://example.test/recipe',
    steps: [{ instruction: 'Mélanger puis cuire.', ingredients: [{ food: { name: 'Framboises' }, unit: { name: 'g' }, amount: 100 }] }],
  }) });
  const empty = zip({ 'recipe.json': JSON.stringify({ name: 'Menu semaine', steps: [] }) });
  const parsed = parseRecipeArchive(zip({ '1.zip': nested, '2.zip': empty }));
  assert.equal(parsed.recipes.length, 1);
  assert.equal(parsed.skipped, 1);
  assert.equal(parsed.recipes[0].name, 'Muffins framboise');
  assert.equal(parsed.recipes[0].ingredients[0].foodName, 'Framboises');
  assert.equal(parsed.recipes[0].instructions, 'Mélanger puis cuire.');
});

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [fileName, input] of Object.entries(entries)) {
    const name = Buffer.from(fileName);
    const data = Buffer.isBuffer(input) ? input : Buffer.from(input);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26); local.push(header, name, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0, 8); directory.writeUInt16LE(0, 10); directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += header.length + name.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}
