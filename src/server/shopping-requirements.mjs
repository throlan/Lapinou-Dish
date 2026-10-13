// Only ingredients for preparations still needed are counted. Existing finished
// batches cover meals before buying the same ingredients a second time.
export async function rawShoppingRequirements(pool, householdId, startDate, endDate) {
  const result = await pool.query(
    `WITH planned AS (
       SELECT i.recipe_id,
              sum(a.quantity) FILTER (WHERE m.meal_date BETWEEN $2::date AND $3::date) AS wanted,
              COALESCE(sum(a.quantity) FILTER (WHERE m.meal_date < $2::date), 0) AS earlier
       FROM planned_meals m JOIN planned_meal_items i ON i.meal_id = m.id
       JOIN planned_amounts a ON a.planned_item_id = i.id
       WHERE m.household_id = $1 AND m.meal_date <= $3::date GROUP BY i.recipe_id
     ), produced AS (
       SELECT recipe_id, sum(quantity) AS quantity FROM stock_lots
       WHERE household_id = $1 AND cancelled_at IS NULL AND NOT is_serving_bundle GROUP BY recipe_id
     ), needed AS (
       SELECT p.recipe_id, GREATEST(COALESCE(p.wanted, 0) - GREATEST(COALESCE(s.quantity, 0) - p.earlier, 0), 0) AS quantity
       FROM planned p LEFT JOIN produced s ON s.recipe_id = p.recipe_id
     ), ingredient_requirements AS (
       SELECT f.id AS food_id, f.canonical_name AS name, rl.unit_id, r.id AS recipe_id, r.name AS recipe_name,
              sum(rl.quantity * n.quantity / r.yield_amount) AS quantity,
              f.grams_per_millilitre AS grams_per_millilitre,
              COALESCE((SELECT jsonb_object_agg(u.unit_id, u.grams_per_unit)
                        FROM food_unit_conversions u WHERE u.food_id = f.id), '{}'::jsonb) AS grams_per_unit
       FROM needed n JOIN recipes r ON r.id = n.recipe_id
       JOIN recipe_lines rl ON rl.recipe_id = r.id JOIN foods f ON f.id = rl.food_id
       WHERE r.household_id = $1 AND n.quantity > 0
       GROUP BY f.id, rl.unit_id, r.id
     )
     SELECT food_id AS "foodId", name, unit_id AS "unitId", sum(quantity) AS quantity,
            jsonb_agg(jsonb_build_object('id', recipe_id, 'name', recipe_name,
              'quantity', quantity, 'unitId', unit_id) ORDER BY recipe_name) AS recipes,
            grams_per_millilitre AS "gramsPerMillilitre", grams_per_unit AS "gramsPerUnit"
     FROM ingredient_requirements
     GROUP BY food_id, name, unit_id, grams_per_millilitre, grams_per_unit
     ORDER BY name, "unitId"`,
    [householdId, startDate, endDate],
  );
  return result.rows.map(row => ({ ...row, quantity: Number(row.quantity), recipes: (row.recipes ?? []).map(recipe => ({
    ...recipe, quantity: Number(recipe.quantity),
  })),
    gramsPerMillilitre: row.gramsPerMillilitre == null ? null : Number(row.gramsPerMillilitre),
    gramsPerUnit: Object.fromEntries(Object.entries(row.gramsPerUnit).map(([key,value]) => [key,Number(value)])),
  }));
}
