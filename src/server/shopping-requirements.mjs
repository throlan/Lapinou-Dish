import {recipeRequirements} from './recipe-ingredients.mjs';

export async function rawShoppingRequirements(pool,householdId,startDate,endDate) {
  return (await recipeRequirements(pool,householdId,startDate,endDate)).foods;
}
