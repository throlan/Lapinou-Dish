import { randomUUID } from 'node:crypto';

const nutrientIds = {
  energyKcal: 'energy_kcal',
  proteinG: 'protein_g',
  carbohydrateG: 'carbohydrate_g',
  fatG: 'fat_g',
  fibreG: 'fibre_g',
};

export function validateFoodInput(input, { creating = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-body' };
  const data = {};
  if (creating || Object.hasOwn(input, 'name')) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 200) return { error: 'invalid-name' };
    data.name = input.name.trim();
  }
  for (const key of ['brand', 'sourceNote']) {
    if (!creating && !Object.hasOwn(input, key)) continue;
    const value = input[key] ?? null;
    if (value !== null && (typeof value !== 'string' || value.length > 500)) return { error: `invalid-${key}` };
    data[key] = value?.trim() || null;
  }
  if (creating || Object.hasOwn(input, 'nutrientsPer100g')) {
    const values = input.nutrientsPer100g;
    if (!values || typeof values !== 'object' || Array.isArray(values)) return { error: 'invalid-nutrients' };
    data.nutrients = {};
    for (const key of Object.keys(nutrientIds)) {
      const value = values[key] ?? null;
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000)) return { error: `invalid-${key}` };
      data.nutrients[key] = value;
    }
  }
  if (creating || Object.hasOwn(input, 'gramsPerMillilitre')) {
    const value = input.gramsPerMillilitre ?? null;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100)) return { error: 'invalid-density' };
    data.gramsPerMillilitre = value;
  }
  if (creating || Object.hasOwn(input, 'gramsPerUnit')) {
    const units = input.gramsPerUnit ?? {};
    if (!units || typeof units !== 'object' || Array.isArray(units)) return { error: 'invalid-unit-conversions' };
    data.gramsPerUnit = {};
    for (const [unit, value] of Object.entries(units)) {
      if (!/^[a-z][a-z0-9_-]{0,30}$/.test(unit) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100000) return { error: 'invalid-unit-conversions' };
      data.gramsPerUnit[unit] = value;
    }
  }
  if (creating || Object.hasOwn(input, 'aliases')) {
    const aliases = input.aliases ?? [];
    if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== 'string' || !alias.trim() || alias.length > 200)) return { error: 'invalid-aliases' };
    data.aliases = [...new Set(aliases.map((alias) => alias.trim()))];
  }
  if (Object.keys(data).length === 0) return { error: 'empty-update' };
  return { data };
}

export async function createFood(pool, data) {
  const client = await pool.connect();
  const id = randomUUID();
  try {
    await client.query('BEGIN');
    const duplicate = await findDuplicate(client, data.name, data.brand, null);
    if (duplicate.length) {
      await client.query('ROLLBACK');
      return { error: 'possible-duplicate', matches: duplicate };
    }
    await client.query(
      `INSERT INTO foods (id, canonical_name, brand, source, source_note, grams_per_millilitre)
       VALUES ($1, $2, $3, 'manual', $4, $5)`,
      [id, data.name, data.brand, data.sourceNote, data.gramsPerMillilitre],
    );
    await writeNutrients(client, id, data.nutrients, 'Saisie manuelle');
    for (const [unit, grams] of Object.entries(data.gramsPerUnit)) {
      await client.query(
        `INSERT INTO food_unit_conversions (food_id, unit_id, grams_per_unit, source_note)
         VALUES ($1, $2, $3, 'Saisie manuelle')`, [id, unit, grams],
      );
    }
    await writeAliases(client, id, data.name, data.aliases);
    const food = await getFood(client, id);
    await client.query('COMMIT');
    return food;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'unknown-unit' };
    throw error;
  } finally {
    client.release();
  }
}

export async function updateFood(pool, id, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM foods WHERE id = $1 FOR UPDATE', [id]);
    const before = await getFood(client, id);
    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }
    const afterState = {
      ...before,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.brand !== undefined ? { brand: data.brand } : {}),
      ...(data.sourceNote !== undefined ? { sourceNote: data.sourceNote } : {}),
      ...(data.gramsPerMillilitre !== undefined ? { gramsPerMillilitre: data.gramsPerMillilitre } : {}),
      ...(data.nutrients !== undefined ? { nutrientsPer100g: data.nutrients } : {}),
    };
    const duplicate = await findDuplicate(client, afterState.name, afterState.brand, id);
    if (duplicate.length) {
      await client.query('ROLLBACK');
      return { error: 'possible-duplicate', matches: duplicate };
    }
    await client.query(
      `UPDATE foods SET canonical_name = $2, brand = $3, source_note = $4,
              grams_per_millilitre = $5, manual_override = true,
              version = version + 1, updated_at = now()
        WHERE id = $1`,
      [id, afterState.name, afterState.brand, afterState.sourceNote, afterState.gramsPerMillilitre],
    );
    if (data.nutrients !== undefined) await writeNutrients(client, id, data.nutrients, 'Correction manuelle');
    if (data.gramsPerUnit !== undefined) {
      await client.query('DELETE FROM food_unit_conversions WHERE food_id = $1', [id]);
      for (const [unit, grams] of Object.entries(data.gramsPerUnit)) {
        await client.query(
          `INSERT INTO food_unit_conversions (food_id, unit_id, grams_per_unit, source_note)
           VALUES ($1, $2, $3, 'Saisie manuelle')`, [id, unit, grams],
        );
      }
    }
    if (data.name !== undefined || data.aliases !== undefined) {
      await writeAliases(client, id, afterState.name, data.aliases ?? []);
    }
    const after = await getFood(client, id);
    await client.query(
      `INSERT INTO food_change_log (id, food_id, reason, before_state, after_state)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [randomUUID(), id, 'Modification du catalogue', JSON.stringify(before), JSON.stringify(after)],
    );
    await client.query('COMMIT');
    return after;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'unknown-unit' };
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteFood(pool, id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT id FROM foods WHERE id=$1 FOR UPDATE', [id]);
    if (!found.rows.length) { await client.query('ROLLBACK'); return null; }
    const references = await client.query(
      `SELECT count(DISTINCT r.id)::integer AS recipe_count,
              COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.id IS NOT NULL), '{}') AS recipe_names,
              (SELECT count(*)::integer FROM household_ingredient_stock WHERE food_id=$1) AS stock_count
         FROM recipe_lines rl JOIN recipes r ON r.id=rl.recipe_id WHERE rl.food_id=$1`, [id],
    );
    const refs = references.rows[0];
    if (refs.recipe_count || refs.stock_count) {
      await client.query('ROLLBACK');
      return { error: 'food-in-use', recipes: refs.recipe_names, stockCount: refs.stock_count };
    }
    await client.query('DELETE FROM foods WHERE id=$1', [id]);
    await client.query('COMMIT');
    return { deleted: true };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'food-in-use', recipes: [], stockCount: 0 };
    throw error;
  } finally { client.release(); }
}

export async function fillMissingNutritionFromExternal(pool, foodId, product) {
  if (!product || !/^\d{8,14}$/.test(product.barcode ?? '') || !product.url?.startsWith('https://world.openfoodfacts.org/product/')) {
    return { error: 'invalid-nutrition-source' };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM foods WHERE id = $1 FOR UPDATE', [foodId]);
    const before = await getFood(client, foodId);
    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }
    const note = `Open Food Facts : ${product.name}${product.brand ? ` — ${product.brand}` : ''} (${product.url})`;
    const nutrientFields = [
      ['energyKcal', 'energy_kcal'], ['proteinG', 'protein_g'], ['carbohydrateG', 'carbohydrate_g'],
      ['fatG', 'fat_g'], ['fibreG', 'fibre_g'],
    ];
    const filledNutrients = [];
    for (const [key, nutrientId] of nutrientFields) {
      const value = product.nutrientsPer100g?.[key];
      if (value === null || value === undefined || !Number.isFinite(value) || value < 0 || value > 100000) continue;
      const result = await client.query(
        `INSERT INTO food_nutrients (food_id, nutrient_id, value_per_100g, source_note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (food_id, nutrient_id) DO UPDATE
           SET value_per_100g = EXCLUDED.value_per_100g, source_note = EXCLUDED.source_note
           WHERE food_nutrients.value_per_100g IS NULL
         RETURNING nutrient_id`,
        [foodId, nutrientId, value, note],
      );
      if (result.rows.length) filledNutrients.push(nutrientId);
    }
    if (filledNutrients.length) {
      await client.query(
        `UPDATE foods SET source_note = concat_ws(E'\\n', NULLIF(source_note, ''), $2),
                manual_override = true, version = version + 1, updated_at = now()
          WHERE id = $1`, [foodId, note],
      );
    }
    const food = await getFood(client, foodId);
    if (filledNutrients.length) {
      await client.query(
        `INSERT INTO food_change_log (id, food_id, reason, before_state, after_state)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
        [randomUUID(), foodId, 'Complément nutritionnel externe', JSON.stringify(before), JSON.stringify(food)],
      );
    }
    await client.query('COMMIT');
    return { food, filledNutrients, sourceName: 'Open Food Facts', sourceReference: product.barcode };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findDuplicate(client, name, brand, excludingId) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${normalizeSearch(name)}:${(brand ?? '').toLocaleLowerCase('fr-FR')}`]);
  const result = await client.query(
    `SELECT DISTINCT f.id, f.canonical_name AS name, f.brand, f.source
       FROM foods f
       JOIN food_aliases a ON a.food_id = f.id AND a.alias = f.canonical_name
      WHERE a.normalized_alias = $1
        AND lower(COALESCE(f.brand, '')) = lower(COALESCE($2, ''))
        AND ($3::uuid IS NULL OR f.id <> $3)
      ORDER BY f.canonical_name LIMIT 5`,
    [normalizeSearch(name), brand, excludingId],
  );
  return result.rows;
}

async function writeNutrients(client, foodId, nutrients, note) {
  for (const [key, id] of Object.entries(nutrientIds)) {
    await client.query(
      `INSERT INTO food_nutrients (food_id, nutrient_id, value_per_100g, source_note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (food_id, nutrient_id) DO UPDATE
         SET source_note = CASE WHEN food_nutrients.value_per_100g IS DISTINCT FROM EXCLUDED.value_per_100g
                                THEN EXCLUDED.source_note ELSE food_nutrients.source_note END,
             value_per_100g = EXCLUDED.value_per_100g`,
      [foodId, id, nutrients[key], note],
    );
  }
}

async function writeAliases(client, foodId, name, aliases) {
  for (const alias of [...aliases, name]) {
    const normalized = normalizeSearch(alias);
    if (!normalized) continue;
    await client.query(
      `INSERT INTO food_aliases (id, food_id, alias, normalized_alias, source)
       VALUES ($1, $2, $3, $4, 'manual')
       ON CONFLICT (food_id, normalized_alias) DO UPDATE SET alias = EXCLUDED.alias`,
      [randomUUID(), foodId, alias, normalized],
    );
  }
}

export async function getFood(client, id) {
  const result = await client.query(
    `SELECT f.id, f.canonical_name AS name, f.brand, f.source, f.source_reference,
            f.source_note, f.grams_per_millilitre,
            jsonb_object_agg(n.id, fn.value_per_100g ORDER BY n.sort_order)
              FILTER (WHERE n.id IS NOT NULL) AS nutrient_values,
            COALESCE((SELECT jsonb_object_agg(u.unit_id, u.grams_per_unit)
                        FROM food_unit_conversions u WHERE u.food_id = f.id), '{}'::jsonb) AS grams_per_unit,
            COALESCE((SELECT jsonb_agg(a.alias ORDER BY a.alias)
                        FROM food_aliases a WHERE a.food_id = f.id), '[]'::jsonb) AS aliases
       FROM foods f
       LEFT JOIN food_nutrients fn ON fn.food_id = f.id
       LEFT JOIN nutrients n ON n.id = fn.nutrient_id
      WHERE f.id = $1
      GROUP BY f.id`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  const nutrients = row.nutrient_values ?? {};
  const names = Object.fromEntries(Object.entries(nutrientIds).map(([key, nutrientId]) => [key, nutrients[nutrientId] == null ? null : Number(nutrients[nutrientId])]));
  return {
    id: row.id, name: row.name, brand: row.brand, source: row.source,
    sourceReference: row.source_reference, sourceNote: row.source_note,
    gramsPerMillilitre: row.grams_per_millilitre === null ? null : Number(row.grams_per_millilitre),
    gramsPerUnit: Object.fromEntries(Object.entries(row.grams_per_unit ?? {}).map(([key, value]) => [key, Number(value)])),
    aliases: row.aliases ?? [], nutrientsPer100g: names,
  };
}

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();
}
