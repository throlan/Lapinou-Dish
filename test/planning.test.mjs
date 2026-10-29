import test from 'node:test';
import assert from 'node:assert/strict';
import { listPlannedMeals, listPlannedRecipeIds, validatePlannedMeal } from '../src/server/planning.mjs';

const householdId = '11111111-1111-4111-8111-111111111111';
const recipeId = '22222222-2222-4222-8222-222222222222';
const personA = '33333333-3333-4333-8333-333333333333';
const personB = '44444444-4444-4444-8444-444444444444';

function valid(overrides = {}) {
  return {
    householdId, mealDate: '2026-10-12', slot: 'lunch', notes: '',
    attendeeIds: [personA, personB],
    items: [{ recipeId, amounts: [{ personId: personA, quantity: 1 }, { personId: personB, quantity: 0.5 }] }],
    ...overrides,
  };
}

test('accepts a planned recipe with explicit attendees and separate quantities', () => {
  const result = validatePlannedMeal(valid());
  assert.equal(result.error, undefined);
  assert.equal(result.data.items[0].amounts[1].quantity, 0.5);
  assert.equal(result.data.items[0].role, 'main');
});

test('requires a person to be explicitly selected', () => {
  assert.equal(validatePlannedMeal(valid({ attendeeIds: [] })).error, 'attendees-required');
});

test('the main recipe requires everyone while every optional addition may be person-specific', () => {
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, amounts: [{ personId: personA, quantity: 1 }] }] })).error, 'amounts-must-match-attendees');
  const individualDrink = validatePlannedMeal(valid({ items: [{ recipeId, role: 'beverage', amounts: [{ personId: personA, quantity: 1 }] }] }));
  assert.equal(individualDrink.error, undefined);
  assert.equal(individualDrink.data.items[0].amounts.length, 1);
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, role: 'beverage', amounts: [] }] })).error, 'invalid-beverage-amounts');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, amounts: [{ personId: personA, quantity: 0 }, { personId: personB, quantity: 1 }] }] })).error, 'invalid-planned-quantity');
  const individualSide=validatePlannedMeal(valid({items:[{recipeId,role:'accompaniment',categoryId:'patisserie',amounts:[{personId:personB,quantity:1}]}]}));
  assert.equal(individualSide.error,undefined);
  assert.equal(individualSide.data.items[0].categoryId,'patisserie');
  assert.equal(validatePlannedMeal(valid({items:[{recipeId,role:'accompaniment',categoryId:'patisserie',amounts:[]}]})).error,'invalid-accompaniment-amounts');
  assert.equal(validatePlannedMeal(valid({items:[{recipeId,role:'accompaniment',categoryId:'Pâtisserie',amounts:[{personId:personB,quantity:1}]}]})).error,'invalid-planned-item-category');
});

test('rejects invalid dates, slots and people outside the attendee set', () => {
  assert.equal(validatePlannedMeal(valid({ mealDate: '2026-02-30' })).error, 'invalid-meal-date');
  assert.equal(validatePlannedMeal(valid({ slot: 'midnight' })).error, 'invalid-meal-slot');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, amounts: [{ personId: '55555555-5555-4555-8555-555555555555', quantity: 1 }, { personId: personB, quantity: 1 }] }] })).error, 'invalid-planned-amount-person');
});

test('planned meals keep their exact calendar date when listed', async () => {
  const mealId = '55555555-5555-4555-8555-555555555555';
  const queries = [];
  const pool = { query: async (sql, values) => {
    queries.push(sql);
    if (sql.includes('FROM planned_meals WHERE household_id')) {
      return { rows: [{ id: mealId, meal_date: '2026-10-12', slot: 'lunch', notes: '' }] };
    }
    if (sql.includes('FROM planned_meal_attendees')) return { rows: [{ id: personA, display_name: 'Lapinou' }] };
    if (sql.includes('FROM planned_meal_items')) return { rows: [] };
    throw new Error('Unexpected query');
  } };
  const meals = await listPlannedMeals(pool, householdId, '2026-10-12');
  assert.ok(queries[0].includes('meal_date::text AS meal_date'));
  assert.equal(meals[0].mealDate, '2026-10-12');
});


test('accepts meal item categories and rejects unsupported categories', () => {
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, role: 'unknown', amounts: [{ personId: personA, quantity: 1 }, { personId: personB, quantity: 1 }] }] })).error, 'invalid-planned-item-role');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, role: 'beverage', amounts: [{ personId: personA, quantity: 1 }, { personId: personB, quantity: 1 }] }] })).data.items[0].role, 'beverage');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, role: 'dessert', amounts: [{ personId: personA, quantity: 1 }, { personId: personB, quantity: 1 }] }] })).data.items[0].role, 'dessert');
});test('shared recipes require everyone while beverage amounts may be person-specific', () => {
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, amounts: [{ personId: personA, quantity: 1 }] }] })).error, 'amounts-must-match-attendees');
  const individualDrink = validatePlannedMeal(valid({ items: [{ recipeId, role: 'beverage', amounts: [{ personId: personA, quantity: 1 }] }] }));
  assert.equal(individualDrink.error, undefined);
  assert.equal(individualDrink.data.items[0].amounts.length, 1);
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, role: 'beverage', amounts: [] }] })).error, 'invalid-beverage-amounts');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, amounts: [{ personId: personA, quantity: 0 }, { personId: personB, quantity: 1 }] }] })).error, 'invalid-planned-quantity');
});

test('accepts a quota-exempt occasion with a kcal estimate per attendee and no recipes',()=>{
  const result=validatePlannedMeal(valid({isOccasion:true,occasionTitle:'Raclette',items:[],occasionEnergy:[{personId:personA,kcal:1800},{personId:personB,kcal:1450}]}));
  assert.equal(result.error,undefined);assert.equal(result.data.isOccasion,true);assert.equal(result.data.occasionEnergy[0].kcal,1800);
  assert.equal(validatePlannedMeal(valid({isOccasion:true,occasionTitle:'Raclette',items:[]})).error,'occasion-energy-required');
  assert.equal(validatePlannedMeal(valid({isOccasion:true,occasionTitle:'',items:[],occasionEnergy:[{personId:personA,kcal:1},{personId:personB,kcal:1}]})).error,'occasion-title-required');
  assert.equal(validatePlannedMeal(valid({isOccasion:true,occasionTitle:'Raclette',items:[{recipeId,amounts:[{personId:personA,quantity:1},{personId:personB,quantity:1}]}],occasionEnergy:[{personId:personA,kcal:1},{personId:personB,kcal:1}]})).error,'occasion-cannot-have-recipes');
});

test('rejects invalid dates, slots and people outside the attendee set', () => {
  assert.equal(validatePlannedMeal(valid({ mealDate: '2026-02-30' })).error, 'invalid-meal-date');
  assert.equal(validatePlannedMeal(valid({ slot: 'midnight' })).error, 'invalid-meal-slot');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, amounts: [{ personId: '55555555-5555-4555-8555-555555555555', quantity: 1 }, { personId: personB, quantity: 1 }] }] })).error, 'invalid-planned-amount-person');
});

test('planned meals keep their exact calendar date when listed', async () => {
  const mealId = '55555555-5555-4555-8555-555555555555';
  const queries = [];
  const pool = { query: async (sql, values) => {
    queries.push(sql);
    if (sql.includes('FROM planned_meals WHERE household_id')) {
      return { rows: [{ id: mealId, meal_date: '2026-10-12', slot: 'lunch', notes: '' }] };
    }
    if (sql.includes('FROM planned_meal_attendees')) return { rows: [{ id: personA, display_name: 'Lapinou' }] };
    if (sql.includes('FROM planned_meal_items')) return { rows: [] };
    throw new Error('Unexpected query');
  } };
  const meals = await listPlannedMeals(pool, householdId, '2026-10-12');
  assert.ok(queries[0].includes('meal_date::text AS meal_date'));
  assert.equal(meals[0].mealDate, '2026-10-12');
});


test('accepts meal item categories and rejects unsupported categories', () => {
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, role: 'beverage', amounts: [{ personId: personA, quantity: 1 }, { personId: personB, quantity: 1 }] }] })).data.items[0].role, 'beverage');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, role: 'dessert', amounts: [{ personId: personA, quantity: 1 }, { personId: personB, quantity: 1 }] }] })).data.items[0].role, 'dessert');
});


test('planned recipe lookup returns distinct parent recipe IDs from the requested date onward', async () => {
  const queries=[];
  const pool={query:async(sql,values)=>{queries.push({sql,values});return {rows:[{recipe_id:recipeId}]};}};
  assert.deepEqual(await listPlannedRecipeIds(pool,householdId,'2026-10-01'),[recipeId]);
  assert.match(queries[0].sql,/COALESCE\(r\.parent_recipe_id,r\.id\)/);
  assert.match(queries[0].sql,/m\.meal_date >= \$2::date/);
  assert.deepEqual(queries[0].values,[householdId,'2026-10-01']);
});
