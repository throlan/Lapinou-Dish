import { validMealRatios, validPlateRatios } from '../../web/meal-config.js';

export async function readMealSettings(pool, householdId) {
  const result=await pool.query('SELECT meal_ratios FROM households WHERE id=$1',[householdId]);
  return result.rows.length ? {ratios:result.rows[0].meal_ratios} : null;
}
export async function saveMealSettings(pool, householdId, ratios) {
  if(!validMealRatios(ratios)) return {error:'invalid-meal-ratios'};
  const result=await pool.query('UPDATE households SET meal_ratios=$2::jsonb WHERE id=$1 RETURNING meal_ratios',[householdId,JSON.stringify(ratios)]);
  return result.rows.length ? {ratios:result.rows[0].meal_ratios} : {error:'household-not-found'};
}

export async function readPlateSettings(pool, householdId) {
  const result=await pool.query('SELECT plate_ratios FROM households WHERE id=$1',[householdId]);
  return result.rows.length ? {ratios:result.rows[0].plate_ratios} : null;
}
export async function savePlateSettings(pool, householdId, ratios) {
  if(!validPlateRatios(ratios)) return {error:'invalid-plate-ratios'};
  const result=await pool.query('UPDATE households SET plate_ratios=$2::jsonb WHERE id=$1 RETURNING plate_ratios',[householdId,JSON.stringify(ratios)]);
  return result.rows.length ? {ratios:result.rows[0].plate_ratios} : {error:'household-not-found'};
}
