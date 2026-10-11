import { randomUUID } from 'node:crypto';

export async function saveImportDrafts(pool, householdId, drafts) {
  const client = await pool.connect();
  const results = [];
  try {
    await client.query('BEGIN');
    for (const draft of drafts) {
      const sourceKind = ['file', 'clipboard'].includes(draft.sourceKind) ? draft.sourceKind : 'url';
      const sourceReference = draft.externalId ? `${draft.sourceKind}:${draft.externalId}` : draft.sourceUrl ?? null;
      if (sourceKind === 'file' && sourceReference) {
        const existing = await client.query('SELECT id FROM recipe_import_drafts WHERE household_id = $1 AND source_reference = $2', [householdId, sourceReference]);
        if (existing.rows.length) { results.push({ id: existing.rows[0].id, name: draft.name, duplicate: true }); continue; }
      }
      const id = randomUUID();
      await client.query(
        `INSERT INTO recipe_import_drafts (id, household_id, source_kind, source_reference, raw_payload, state)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'draft')`,
        [id, householdId, sourceKind, sourceReference, JSON.stringify({ name: draft.name, description: draft.description, yieldAmount: draft.yieldAmount, yieldUnitId: draft.yieldUnitId, instructions: draft.instructions, sourceUrl: draft.sourceUrl, sourcePlatform: draft.sourceKind, original: draft.rawPayload ?? draft.rawText ?? null })],
      );
      for (const [index, line] of (draft.ingredients ?? []).entries()) {
        await client.query(
          `INSERT INTO recipe_import_draft_lines (id, draft_id, raw_text, suggested_quantity, suggested_food_name, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), id, line.rawText || line.foodName || 'Ingrédient à identifier', line.quantity, line.foodName || null, index],
        );
      }
      results.push({ id, name: draft.name, duplicate: false });
    }
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'unknown-household' };
    throw error;
  } finally { client.release(); }
}

export async function listImportDrafts(pool, householdId) {
  const drafts = await pool.query(
    `SELECT id, source_kind, source_reference, raw_payload, state, created_at
       FROM recipe_import_drafts WHERE household_id = $1 AND state = 'draft'
      ORDER BY created_at DESC`, [householdId],
  );
  const result = [];
  for (const draft of drafts.rows) {
    const lines = await pool.query(
      `SELECT raw_text, suggested_quantity, suggested_unit_id, suggested_food_id, suggested_food_name, sort_order
         FROM recipe_import_draft_lines WHERE draft_id = $1 ORDER BY sort_order`, [draft.id],
    );
    result.push({ id: draft.id, sourceKind: draft.source_kind, sourceReference: draft.source_reference, state: draft.state, createdAt: draft.created_at, ...draft.raw_payload, ingredients: lines.rows.map((line) => ({ rawText: line.raw_text, foodName: line.suggested_food_name, quantity: line.suggested_quantity == null ? null : Number(line.suggested_quantity), unitId: line.suggested_unit_id, foodId: line.suggested_food_id })) });
  }
  return result;
}
