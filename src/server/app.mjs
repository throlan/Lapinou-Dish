import { createServer } from 'node:http';
import { setMealPrepared } from './meal-preparation.mjs';
import { listFoodStores, saveFoodStores, validateFoodStores } from './food-stores.mjs';
import { exportToHomeAssistant } from './home-assistant-shopping.mjs';
import { deletePurchaseUnit,listPurchaseUnits,savePurchaseUnit,validatePurchaseUnit } from './purchase-units.mjs';
import { previewDailyRebalance, applyDailyRebalance } from './daily-rebalance.mjs';
import { readMealSettings, saveMealSettings, readPlateSettings, savePlateSettings } from './meal-settings.mjs';
import { deleteSavingPlan, getEnergyReserveOverview, saveSavingPlan, validateSavingPlan } from './energy-reserve.mjs';
import { countProductInventory, listIngredientStock, recordPurchaseReceipt, saveIngredientStock, validateIngredientStock, validateProductCount, validatePurchaseReceipt } from './ingredient-stock.mjs';
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { createFood, deleteFood, fillMissingNutritionFromExternal, getFood, updateFood, validateFoodInput } from './foods.mjs';
import { getOpenFoodFactsProduct, searchOpenFoodFacts } from './open-food-facts.mjs';
import { createRecipe, listRecipes, readRecipe, updateRecipe, updateRecipeSettings, validateRecipeInput, validateRecipeSettings } from './recipes.mjs';
import { listImportDrafts, saveImportDrafts } from './recipe-imports.mjs';
import { extractRecipeWithOpenAI } from './openai-recipe-import.mjs';
import { generateRecipeImage, inspectRecipeImageStorage, readRecipeImage, removeRecipeImage, saveRecipeImage, validateRecipeImageUpload } from './recipe-images.mjs';
import { retrieveInstagramCaption, instagramPostUrl } from './instagram-caption.mjs';
import { addProfileHistory, addWeightEntry, createPerson, listPeople, validatePersonInput, validateProfileHistoryInput, validateWeightInput } from './people.mjs';
import { deletePlannedMeal, duplicatePlannedMeal, listPlannedMeals, listPlannedRecipeIds, savePlannedMeal, validateMealDuplication, validatePlannedMeal } from './planning.mjs';
import { addStockLot, cancelStockLot, completeRoutine, deleteOrderLink, getRoutineSettings, listOrderLinks, listPreparationsToMake, listShoppingRequirements, listStock, saveOrderLink, saveRoutineSettings, saveShoppingLineState, validateOrderLinkInput, validateProductionInput, validateRoutineSettings, validateShoppingLineState } from './household-planning.mjs';
import { parseRecipeArchive, parseRecipeText } from '../domain/recipe-import.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/portion-planner.js', ['portion-planner.js', 'text/javascript; charset=utf-8']],
  ['/meal-config.js', ['meal-config.js', 'text/javascript; charset=utf-8']],
  ['/preparation-weeks.js', ['preparation-weeks.js', 'text/javascript; charset=utf-8']],
  ['/cooking-sheet.js', ['cooking-sheet.js', 'text/javascript; charset=utf-8']],
  ['/recipe-directory.js', ['recipe-directory.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

export function createApp(pool, { appPassword, recipeAI = {} } = {}) {
  return createServer((request, response) => handleRequest(request, response, pool, appPassword, recipeAI));
}

const loginAttempts = new Map();
const SESSION_SECONDS = 604800;
const activeRecipeImports = new Set();
const activeImageGenerations = new Set();

export async function handleRequest(request, response, pool, appPassword = null, recipeAI = {}) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const staticFile = staticFiles.get(url.pathname);
    if (request.method === 'GET' && staticFile) {
      try {
        const contents = await readFile(path.join(webRoot, staticFile[0]));
        response.setHeader('Content-Type', staticFile[1]);
        response.setHeader('Cache-Control', 'no-store, max-age=0, no-transform');
        response.writeHead(200);
        return response.end(contents);
      } catch {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        return send(response, 500, { error: 'page-unavailable' });
      }
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'same-origin');

    if (request.method === 'GET' && url.pathname === '/api/health') {
      try {
        await pool.query('SELECT 1');
        return send(response, 200, { status: 'ok' });
      } catch {
        return send(response, 503, { status: 'database-unavailable' });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/session') {
      return send(response, 200, { authenticated: Boolean(appPassword && hasSession(request, appPassword)) });
    }
    if (request.method === 'POST' && url.pathname === '/api/login') {
      if (!appPassword) return send(response, 503, { error: 'authentication-not-configured' });
      const ip = request.socket?.remoteAddress ?? 'unknown';
      const attempts = loginAttempts.get(ip) ?? { count: 0, startedAt: Date.now() };
      if (Date.now() - attempts.startedAt > 15 * 60 * 1000) { attempts.count = 0; attempts.startedAt = Date.now(); }
      if (attempts.count >= 8) {
        response.setHeader('Retry-After', '900');
        return send(response, 429, { error: 'too-many-login-attempts' });
      }
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const supplied = typeof body.value?.password === 'string' ? body.value.password : '';
      const expected = scryptSync(appPassword, 'lapinou-dish-login-v1', 32);
      const candidate = scryptSync(supplied, 'lapinou-dish-login-v1', 32);
      if (!timingSafeEqual(expected, candidate)) {
        attempts.count += 1;
        loginAttempts.set(ip, attempts);
        return send(response, 401, { error: 'invalid-password' });
      }
      loginAttempts.delete(ip);
      const issuedAt = Math.floor(Date.now() / 1000).toString();
      const token = signSession(issuedAt, appPassword);
      const secure = request.headers?.['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      response.setHeader('Set-Cookie', `lapinou_session=${issuedAt}.${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Strict${secure}`);
      return send(response, 200, { authenticated: true });
    }
    if (request.method === 'POST' && url.pathname === '/api/logout') {
      response.setHeader('Set-Cookie', 'lapinou_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
      return send(response, 200, { authenticated: false });
    }

    if (url.pathname.startsWith('/api/') && appPassword && !hasSession(request, appPassword)) {
      return send(response, 401, { error: 'authentication-required' });
    }

    if ((url.pathname === '/api/planning/rebalance-preview' && request.method==='GET') || (url.pathname === '/api/planning/rebalance' && request.method==='POST')) {
      const body=request.method==='POST'?await readJson(request):null;
      if(body?.error)return send(response,body.status ?? 400,{error:body.error});
      const householdId=body?.value?.householdId ?? url.searchParams.get('householdId'),date=body?.value?.date ?? url.searchParams.get('date');
      if(!isUuid(householdId) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date ?? '') || !Number.isFinite(Date.parse(date+'T00:00:00Z')) || new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)return send(response,400,{error:'invalid-rebalance-request'});
      if(request.method==='POST' && !/^[0-9a-f]{64}$/.test(body.value?.token ?? ''))return send(response,400,{error:'invalid-rebalance-request'});
      try {
        const result=request.method==='GET'?await previewDailyRebalance(pool,householdId,date):await applyDailyRebalance(pool,householdId,date,body.value.token);
        return send(response,result.error?409:200,result);
      }catch{return send(response,500,{error:'daily-rebalance-failed'});}
    }
    if (['/api/meal-settings','/api/plate-settings'].includes(url.pathname) && ['GET','PUT'].includes(request.method)) {
      const body=request.method === 'PUT' ? await readJson(request) : null;
      if(body?.error) return send(response,body.status ?? 400,{error:body.error});
      const householdId=request.method === 'PUT' ? body.value?.householdId : url.searchParams.get('householdId');
      if(!isUuid(householdId)) return send(response,400,{error:'invalid-household-id'});
      try {
        const readSettings=url.pathname==='/api/plate-settings'?readPlateSettings:readMealSettings;
        const saveSettings=url.pathname==='/api/plate-settings'?savePlateSettings:saveMealSettings;
        const result=request.method === 'GET' ? await readSettings(pool,householdId) : await saveSettings(pool,householdId,body.value?.ratios);
        if(!result || result.error === 'household-not-found') return send(response,404,{error:'household-not-found'});
        return send(response,result.error ? 400 : 200,result);
      } catch { return send(response,500,{error:'meal-settings-failed'}); }
    }
    if (url.pathname === '/api/energy-reserve' && request.method === 'GET') {
      const householdId=url.searchParams.get('householdId'),asOf=url.searchParams.get('asOf');
      if(!isUuid(householdId) || !isValidDate(asOf)) return send(response,400,{error:'invalid-energy-reserve-query'});
      try { const result=await getEnergyReserveOverview(pool,householdId,asOf);return send(response,result.error?400:200,result); }
      catch { return send(response,500,{error:'energy-reserve-read-failed'}); }
    }
    if (url.pathname === '/api/energy-reserve/plans' && request.method === 'POST') {
      const body=await readJson(request);if(body.error)return send(response,body.status??400,{error:body.error});
      const validation=validateSavingPlan(body.value);if(validation.error)return send(response,400,{error:validation.error});
      try { const result=await saveSavingPlan(pool,validation.data);return send(response,result.error?400:201,result); }
      catch { return send(response,500,{error:'saving-plan-save-failed'}); }
    }
    const savingPlanId=url.pathname.match(/^\/api\/energy-reserve\/plans\/([0-9a-f-]{36})$/i)?.[1];
    if(savingPlanId && request.method==='DELETE') {
      const householdId=url.searchParams.get('householdId');if(!isUuid(householdId))return send(response,400,{error:'invalid-household-id'});
      try { return await deleteSavingPlan(pool,householdId,savingPlanId)?send(response,200,{deleted:true}):send(response,404,{error:'saving-plan-not-found'}); }
      catch { return send(response,500,{error:'saving-plan-delete-failed'}); }
    }
    if (request.method === 'GET' && url.pathname === '/api/households') {
      try {
        const result = await pool.query('SELECT id, name FROM households ORDER BY created_at');
        return send(response, 200, { households: result.rows });
      } catch {
        return send(response, 500, { error: 'household-list-failed' });
      }
    }
    if (request.method === 'POST' && url.pathname === '/api/households') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const name = body.value?.name;
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) return send(response, 400, { error: 'invalid-household-name' });
      try {
        const result = await pool.query('INSERT INTO households (id, name) VALUES ($1, $2) RETURNING id, name', [randomUUID(), name.trim()]);
        return send(response, 201, { household: result.rows[0] });
      } catch {
        return send(response, 500, { error: 'household-create-failed' });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/people') {
      const householdId = url.searchParams.get('householdId');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try { return send(response, 200, { people: await listPeople(pool, householdId) }); }
      catch { return send(response, 500, { error: 'people-list-failed' }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/people') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      if (!isUuid(body.value?.householdId)) return send(response, 400, { error: 'invalid-household-id' });
      const validation = validatePersonInput(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try { return send(response, 201, { person: await createPerson(pool, body.value.householdId, validation.data) }); }
      catch (error) { return send(response, error.code === '23505' ? 409 : 500, { error: error.code === '23505' ? 'person-already-exists' : 'person-create-failed' }); }
    }
    const personAction = url.pathname.match(/^\/api\/people\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(weights|profile-history)$/i);
    if (personAction && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      if (!isUuid(body.value?.householdId)) return send(response, 400, { error: 'invalid-household-id' });
      const isWeight = personAction[2] === 'weights';
      const validation = isWeight ? validateWeightInput(body.value) : validateProfileHistoryInput(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const result = isWeight
          ? await addWeightEntry(pool, personAction[1], body.value.householdId, validation.data)
          : await addProfileHistory(pool, personAction[1], body.value.householdId, validation.data);
        if (!result) return send(response, 404, { error: 'person-not-found' });
        return send(response, 201, { [isWeight ? 'measurement' : 'profileHistoryEntry']: result });
      } catch (error) {
        if (error.code === '23505') return send(response, 409, { error: isWeight ? 'weight-entry-already-exists-for-date' : 'profile-entry-already-exists-for-date' });
        return send(response, 500, { error: isWeight ? 'weight-entry-create-failed' : 'profile-history-create-failed' });
      }
    }

    if (url.pathname === '/api/household-planning' && request.method === 'GET') {
      const householdId = url.searchParams.get('householdId');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try {
        const [routines, stock, ingredients] = await Promise.all([getRoutineSettings(pool, householdId), listStock(pool, householdId), listIngredientStock(pool, householdId)]);
        return send(response, 200, { routines, stock, ingredients });
      } catch { return send(response, 500, { error: 'household-planning-read-failed' }); }
    }
    if (url.pathname === '/api/household-food-stores' && request.method === 'GET') {
      const householdId=url.searchParams.get('householdId');
      if(!isUuid(householdId))return send(response,400,{error:'invalid-household-id'});
      try{return send(response,200,{assignments:await listFoodStores(pool,householdId)});}
      catch{return send(response,500,{error:'food-stores-read-failed'});}
    }
    if (url.pathname === '/api/household-food-stores' && request.method === 'PUT') {
      const body=await readJson(request);if(body.error)return send(response,body.status??400,{error:body.error});
      const validation=validateFoodStores(body.value);if(validation.error)return send(response,400,{error:validation.error});
      try{const result=await saveFoodStores(pool,validation.data);return send(response,result.error?404:200,result);}
      catch{return send(response,500,{error:'food-stores-save-failed'});}
    }
    if (url.pathname === '/api/household-order-links' && request.method === 'GET') {
      const householdId=url.searchParams.get('householdId');
      if(!isUuid(householdId))return send(response,400,{error:'invalid-household-id'});
      try{return send(response,200,{links:await listOrderLinks(pool,householdId)});}
      catch{return send(response,500,{error:'order-links-read-failed'});}
    }
    if (url.pathname === '/api/household-order-links' && request.method === 'POST') {
      const body=await readJson(request);if(body.error)return send(response,body.status??400,{error:body.error});
      const validation=validateOrderLinkInput(body.value);if(validation.error)return send(response,400,{error:validation.error});
      try{const link=await saveOrderLink(pool,validation.data);return link?send(response,200,{link}):send(response,404,{error:'order-link-not-found'});}
      catch{return send(response,500,{error:'order-link-save-failed'});}
    }
    const orderLinkId=url.pathname.match(/^\/api\/household-order-links\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
    if(orderLinkId&&request.method==='DELETE'){
      const householdId=url.searchParams.get('householdId');if(!isUuid(householdId))return send(response,400,{error:'invalid-household-id'});
      try{return await deleteOrderLink(pool,householdId,orderLinkId)?send(response,200,{deleted:true}):send(response,404,{error:'order-link-not-found'});}
      catch{return send(response,500,{error:'order-link-delete-failed'});}
    }
    if (url.pathname === '/api/household-planning/ingredients' && request.method === 'PUT') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error:body.error });
      const validation = validateIngredientStock(body.value);
      if (validation.error) return send(response, 400, { error:validation.error });
      try {
        const result = await saveIngredientStock(pool,validation.data);
        if (result.error) return send(response,result.error === 'ingredient-stock-changed' ? 409 : 404,result);
        return send(response,200,result);
      } catch { return send(response,500,{error:'ingredient-stock-save-failed'}); }
    }
    if (url.pathname === '/api/household-planning/purchases' && request.method === 'POST') {
      const body=await readJson(request);if(body.error)return send(response,body.status??400,{error:body.error});
      const validation=validatePurchaseReceipt(body.value);if(validation.error)return send(response,400,{error:validation.error});
      try{
        const result=await recordPurchaseReceipt(pool,validation.data);
        return send(response,result.error?(result.error==='purchase-request-conflict'?409:result.error==='ingredient-conversion-missing'?422:404):201,result);
      }catch{return send(response,500,{error:'purchase-receipt-save-failed'});}
    }
    if (url.pathname === '/api/household-planning/ingredients/count' && request.method === 'PUT') {
      const body=await readJson(request);if(body.error)return send(response,body.status??400,{error:body.error});
      const validation=validateProductCount(body.value);if(validation.error)return send(response,400,{error:validation.error});
      try{
        const result=await countProductInventory(pool,validation.data);
        return send(response,result.error?(result.error==='ingredient-stock-changed'?409:result.error==='ingredient-conversion-missing'?422:404):200,result);
      }catch{return send(response,500,{error:'product-count-save-failed'});}
    }
    if (url.pathname === '/api/household-planning/routines' && request.method === 'PUT') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      if (!isUuid(body.value?.householdId)) return send(response, 400, { error: 'invalid-household-id' });
      const validation = validateRoutineSettings(body.value?.routines);
      if (validation.error) return send(response, 400, { error: validation.error });
      try { return send(response, 200, { routines: await saveRoutineSettings(pool, body.value.householdId, validation.data) }); }
      catch { return send(response, 500, { error: 'household-routines-save-failed' }); }
    }
    if (url.pathname === '/api/household-planning/routines/complete' && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      if (!isUuid(body.value?.householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try {
        const routine = await completeRoutine(pool, body.value.householdId, body.value.routineId);
        return routine ? send(response, 200, { routine }) : send(response, 404, { error: 'routine-not-found' });
      } catch { return send(response, 500, { error: 'routine-complete-failed' }); }
    }
    if (url.pathname === '/api/household-planning/production' && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateProductionInput(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const lot = await addStockLot(pool, validation.data);
        if (lot?.error?.startsWith('ingredient-') || lot?.error?.startsWith('production-request-')) return send(response, 409, lot);
        if (lot?.error === 'recipe-not-for-production') return send(response, 400, { error: lot.error });
        if (lot?.error) return send(response, 404, { error: lot.error });
        return send(response, 201, { lot });
      } catch { return send(response, 500, { error: 'production-stock-save-failed' }); }
    }
    const cancelledLotId = url.pathname.match(/^\/api\/household-planning\/production\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
    if (cancelledLotId && request.method === 'DELETE') {
      const householdId = url.searchParams.get('householdId');
      if (!isUuid(householdId)) return send(response,400,{error:'invalid-household-id'});
      try {
        const result = await cancelStockLot(pool,householdId,cancelledLotId);
        return send(response,result.error?(result.error==='production-already-used'?409:404):200,result);
      } catch { return send(response,500,{error:'production-lot-cancel-failed'}); }
    }
    if (url.pathname === '/api/shopping-list' && request.method === 'GET') {
      const householdId = url.searchParams.get('householdId');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate) return send(response, 400, { error: 'invalid-shopping-period' });
      if ((new Date(endDate) - new Date(startDate)) / 86400000 > 62) return send(response, 400, { error: 'shopping-period-too-long' });
      try { return send(response, 200, { items: await listShoppingRequirements(pool, householdId, startDate, endDate) }); }
      catch { return send(response, 500, { error: 'shopping-list-read-failed' }); }
    }
    if (url.pathname === '/api/household-planning/preparations' && request.method === 'GET') {
      const householdId=url.searchParams.get('householdId');
      const startDate=url.searchParams.get('startDate');
      const endDate=url.searchParams.get('endDate');
      if(!isUuid(householdId))return send(response,400,{error:'invalid-household-id'});
      if(!isValidDate(startDate)||!isValidDate(endDate)||endDate<startDate)return send(response,400,{error:'invalid-shopping-period'});
      if((new Date(endDate)-new Date(startDate))/86400000>62)return send(response,400,{error:'shopping-period-too-long'});
      try{return send(response,200,{preparations:await listPreparationsToMake(pool,householdId,startDate,endDate)});}
      catch{return send(response,500,{error:'preparations-read-failed'});}
    }
    if(url.pathname==='/api/household-purchase-units' && request.method==='GET'){
      const householdId=url.searchParams.get('householdId');if(!isUuid(householdId))return send(response,400,{error:'invalid-household-id'});
      try{return send(response,200,{units:await listPurchaseUnits(pool,householdId)});}
      catch{return send(response,500,{error:'purchase-units-read-failed'});}
    }
    if(url.pathname==='/api/household-purchase-units' && request.method==='PUT'){
      const body=await readJson(request);if(body.error)return send(response,body.status??400,{error:body.error});
      const validation=validatePurchaseUnit(body.value);if(validation.error)return send(response,400,{error:validation.error});
      try{const saved=await savePurchaseUnit(pool,validation.data);return send(response,200,{saved:!!saved});}
      catch(error){return send(response,error.code==='23503'?404:500,{error:error.code==='23503'?'food-or-household-not-found':'purchase-unit-save-failed'});}
    }
    if(url.pathname==='/api/household-purchase-units' && request.method==='DELETE'){
      const householdId=url.searchParams.get('householdId'),foodId=url.searchParams.get('foodId');
      if(!isUuid(householdId)||!isUuid(foodId))return send(response,400,{error:'invalid-purchase-unit'});
      try{return send(response,200,{deleted:await deletePurchaseUnit(pool,householdId,foodId)});}
      catch{return send(response,500,{error:'purchase-unit-delete-failed'});}
    }
    if (url.pathname === '/api/shopping-list/export/home-assistant' && request.method === 'POST') {
      const body=await readJson(request);if(body.error)return send(response,body.status??400,{error:body.error});
      const {householdId,startDate,endDate,storeId}=body.value??{};
      if(!isUuid(householdId)||!isUuid(storeId)||!isValidDate(startDate)||!isValidDate(endDate)||endDate<startDate
        ||(new Date(endDate)-new Date(startDate))/86400000>62)return send(response,400,{error:'invalid-shopping-export'});
      if(!process.env.HOME_ASSISTANT_URL||!process.env.HOME_ASSISTANT_TOKEN)
        return send(response,503,{error:'home-assistant-not-configured'});
      try {
        const links=await listOrderLinks(pool,householdId),store=links.find(link=>link.id===storeId);
        if(!store)return send(response,404,{error:'store-not-found'});
        if(!store.homeAssistantEntityId)return send(response,400,{error:'home-assistant-list-not-configured'});
        const items=(await listShoppingRequirements(pool,householdId,startDate,endDate)).filter(item=>item.store?.id===storeId);
        const result=await exportToHomeAssistant(items,store.homeAssistantEntityId,
          {url:process.env.HOME_ASSISTANT_URL,token:process.env.HOME_ASSISTANT_TOKEN});
        return send(response,result.error?502:200,result);
      }catch{return send(response,500,{error:'shopping-export-failed'});}
    }
    if (url.pathname === '/api/shopping-list/state' && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateShoppingLineState(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const result = await saveShoppingLineState(pool, validation.data);
        if (result.error) return send(response, 404, { error: result.error });
        return send(response, 200, result);
      } catch { return send(response, 500, { error: 'shopping-list-state-save-failed' }); }
    }

    if (request.method === 'GET' && url.pathname === '/api/planning/recipe-ids') {
      const householdId = url.searchParams.get('householdId');
      const fromDate = url.searchParams.get('fromDate');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      if (!isValidDate(fromDate)) return send(response, 400, { error: 'invalid-from-date' });
      try { return send(response, 200, { recipeIds: await listPlannedRecipeIds(pool, householdId, fromDate) }); }
      catch { return send(response, 500, { error: 'planning-list-failed' }); }
    }
    if (request.method === 'GET' && url.pathname === '/api/planning') {
      const householdId = url.searchParams.get('householdId');
      const weekStart = url.searchParams.get('weekStart');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      if (!isValidDate(weekStart) || new Date(`${weekStart}T00:00:00Z`).getUTCDay() !== 1) return send(response, 400, { error: 'invalid-week-start' });
      try { return send(response, 200, { meals: await listPlannedMeals(pool, householdId, weekStart) }); }
      catch { return send(response, 500, { error: 'planning-list-failed' }); }
    }
    if (url.pathname === '/api/planning/meals' && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validatePlannedMeal(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const meal = await savePlannedMeal(pool, null, validation.data);
        if (meal?.error) return send(response, 400, { error: meal.error });
        return send(response, 201, { meal });
      } catch { return send(response, 500, { error: 'planning-save-failed' }); }
    }
    const duplicateSourceId=url.pathname.match(/^\/api\/planning\/meals\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/duplicate$/i)?.[1];
    if(duplicateSourceId && request.method==='POST'){
      const body=await readJson(request);if(body.error)return send(response,body.status??400,{error:body.error});
      const validation=validateMealDuplication(body.value);if(validation.error)return send(response,400,validation);
      try{
        const result=await duplicatePlannedMeal(pool,duplicateSourceId,validation.data);
        return send(response,result.error?(result.error==='source-meal-not-found'?404:409):201,result);
      }catch{return send(response,500,{error:'meal-duplication-failed'});}
    }
    const preparedMealId=url.pathname.match(/^\/api\/planning\/meals\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/prepared$/i)?.[1];
    if(preparedMealId && request.method==='PUT'){
      const body=await readJson(request);if(body.error)return send(response,body.status??400,{error:body.error});
      if(!isUuid(body.value?.householdId)||typeof body.value?.prepared!=='boolean')return send(response,400,{error:'invalid-meal-preparation'});
      try{
        const result=await setMealPrepared(pool,body.value.householdId,preparedMealId,body.value.prepared);
        return send(response,result.error?(result.error==='planned-meal-not-found'?404:409):200,result);
      }catch{return send(response,500,{error:'meal-preparation-failed'});}
    }
    const plannedMealId = url.pathname.match(/^\/api\/planning\/meals\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
    if (plannedMealId && request.method === 'PUT') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validatePlannedMeal(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const meal = await savePlannedMeal(pool, plannedMealId, validation.data);
        if (!meal) return send(response, 404, { error: 'planned-meal-not-found' });
        if (meal.error) return send(response, 400, { error: meal.error });
        return send(response, 200, { meal });
      } catch { return send(response, 500, { error: 'planning-save-failed' }); }
    }
    if (plannedMealId && request.method === 'DELETE') {
      const householdId = url.searchParams.get('householdId');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try { const result=await deletePlannedMeal(pool, plannedMealId, householdId);
        return result?.error?send(response,409,result):result?send(response,200,{deleted:true}):send(response,404,{error:'planned-meal-not-found'}); }
      catch { return send(response, 500, { error: 'planning-delete-failed' }); }
    }

    if (request.method === 'POST' && url.pathname === '/api/recipes') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateRecipeInput(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const recipe = await createRecipe(pool, validation.data);
        if (recipe.error) return send(response, 400, { error: recipe.error });
        return send(response, 201, { recipe });
      } catch {
        return send(response, 500, { error: 'recipe-create-failed' });
      }
    }
    if (request.method === 'GET' && url.pathname === '/api/recipes') {
      const householdId = url.searchParams.get('householdId');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(householdId ?? '')) return send(response, 400, { error: 'invalid-household-id' });
      try {
        return send(response, 200, { recipes: await listRecipes(pool, householdId) });
      } catch {
        return send(response, 500, { error: 'recipe-list-failed' });
      }
    }
    const recipeImageRoute = url.pathname.match(/^\/api\/recipes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/image$/i);
    const recipeImageGenerationRoute = url.pathname.match(/^\/api\/recipes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/image\/ai$/i);
    if (recipeImageRoute && request.method === 'GET') {
      const householdId = url.searchParams.get('householdId');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try {
        const result = await readRecipeImage(pool, recipeImageRoute[1], householdId);
        if (!result) return send(response, 404, { error: 'recipe-image-not-found' });
        response.setHeader('Content-Type', result.mediaType);
        response.setHeader('Cache-Control', 'private, max-age=300');
        return response.end(result.image);
      } catch { return send(response, 500, { error: 'recipe-image-read-failed' }); }
    }
    if (recipeImageRoute && request.method === 'PUT') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateRecipeImageUpload(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const result = await saveRecipeImage(pool, recipeImageRoute[1], validation.data);
        return result ? send(response, 200, result) : send(response, 404, { error: 'recipe-not-found' });
      } catch { return send(response, 500, { error: 'recipe-image-save-failed' }); }
    }
    if (recipeImageRoute && request.method === 'DELETE') {
      const householdId = url.searchParams.get('householdId');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try {
        const result = await removeRecipeImage(pool, recipeImageRoute[1], householdId);
        return result === null ? send(response, 404, { error: 'recipe-not-found' }) : send(response, 200, { imageAvailable: false });
      } catch { return send(response, 500, { error: 'recipe-image-delete-failed' }); }
    }
    if (recipeImageGenerationRoute && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const householdId = body.value?.householdId;
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      const apiKey = recipeAI.apiKey ?? process.env.OPENAI_API_KEY;
      if (!apiKey) return send(response, 503, { error: 'openai-not-configured' });
      const key = `${householdId}:${recipeImageGenerationRoute[1]}`;
      if (activeImageGenerations.has(key)) return send(response, 429, { error: 'recipe-image-generation-in-progress' });
      activeImageGenerations.add(key);
      try {
        const owned = await pool.query('SELECT name FROM recipes WHERE id=$1 AND household_id=$2 AND parent_recipe_id IS NULL', [recipeImageGenerationRoute[1], householdId]);
        if (!owned.rowCount) return send(response, 404, { error: 'recipe-not-found' });
        const recipe = await readRecipe(pool, recipeImageGenerationRoute[1]);
        const ingredients = recipe.lines.map(line => line.foodName).filter(Boolean).slice(0, 30);
        const prompt = `Create a realistic, appetizing food photograph for a home-cooking recipe named “${recipe.name.slice(0, 200)}”. Main ingredients: ${ingredients.join(', ') || 'not specified'}. Show the finished dish naturally served on a simple plate, soft daylight, uncluttered background, no text, no labels, no people, no packaging. This is an illustrative image, not a nutrition or portion-size reference.`;
        const generated = await generateRecipeImage(prompt, { apiKey, model: recipeAI.imageModel, fetchImpl: recipeAI.imageFetch });
        if (generated.error) return send(response, generated.error === 'openai-not-configured' ? 503 : generated.error === 'openai-access-denied' || generated.error === 'openai-rate-limited' || generated.error === 'recipe-image-too-large' ? 422 : 502, generated);
        const saved = await saveRecipeImage(pool, recipeImageGenerationRoute[1], { householdId, ...generated.data });
        return saved ? send(response, 200, saved) : send(response, 404, { error: 'recipe-not-found' });
      } catch { return send(response, 502, { error: 'openai-image-generation-failed' }); }
      finally { activeImageGenerations.delete(key); }
    }
    if (request.method === 'GET' && url.pathname === '/api/recipe-imports/config') {
      const openaiEnabled = Boolean(recipeAI.apiKey ?? process.env.OPENAI_API_KEY);
      const imageStorage = await inspectRecipeImageStorage();
      return send(response, 200, { openaiEnabled, imageGenerationEnabled: openaiEnabled, imageStorage });
    }
    if (request.method === 'POST' && url.pathname === '/api/recipe-imports/ai') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const householdId = body.value?.householdId;
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      if (!(recipeAI.apiKey ?? process.env.OPENAI_API_KEY)) return send(response, 503, { error: 'openai-not-configured' });
      let text = body.value?.text ?? '';
      let sourceUrl = body.value?.sourceUrl || null;
      if (typeof text !== 'string' || text.length > 30_000) return send(response, 400, { error: 'invalid-recipe-text' });
      if (sourceUrl && !isSupportedRecipeUrl(sourceUrl)) return send(response, 400, { error: 'unsupported-source-url' });
      if (!text.trim() && !instagramPostUrl(sourceUrl)) return send(response, 400, { error: 'invalid-instagram-post-url' });
      if (activeRecipeImports.has(householdId)) return send(response, 429, { error: 'recipe-import-in-progress' });
      activeRecipeImports.add(householdId);
      try {
        const household = await pool.query('SELECT id FROM households WHERE id = $1', [householdId]);
        if (!household.rows.length) return send(response, 404, { error: 'unknown-household' });
        if (!text.trim()) {
          const caption = await retrieveInstagramCaption(sourceUrl, { fetchImpl: recipeAI.instagramFetch });
          if (caption.error) return send(response, 422, { error: caption.error });
          text = caption.text; sourceUrl = caption.sourceUrl;
        }
        const parsed = await extractRecipeWithOpenAI(text, sourceUrl, recipeAI);
        if (parsed.error) return send(response, 422, { error: parsed.error });
        const drafts = await saveImportDrafts(pool, householdId, [parsed.data]);
        if (drafts.error) return send(response, 400, { error: drafts.error });
        return send(response, 201, { drafts });
      } catch { return send(response, 500, { error: 'recipe-import-save-failed' }); }
      finally { activeRecipeImports.delete(householdId); }
    }
    if (request.method === 'GET' && url.pathname === '/api/recipe-imports') {
      const householdId = url.searchParams.get('householdId');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try { return send(response, 200, { drafts: await listImportDrafts(pool, householdId) }); }
      catch { return send(response, 500, { error: 'recipe-import-list-failed' }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/recipe-imports/text') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const householdId = body.value?.householdId;
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      const sourceUrl = body.value?.sourceUrl || null;
      if (sourceUrl && !isSupportedRecipeUrl(sourceUrl)) return send(response, 400, { error: 'unsupported-source-url' });
      const parsed = parseRecipeText(body.value?.text, sourceUrl);
      if (parsed.error) return send(response, 400, { error: parsed.error });
      try {
        const drafts = await saveImportDrafts(pool, householdId, [parsed.data]);
        if (drafts.error) return send(response, 400, { error: drafts.error });
        return send(response, 201, { drafts });
      } catch { return send(response, 500, { error: 'recipe-import-save-failed' }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/recipe-imports/archive') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const householdId = body.value?.householdId;
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      const encoded = body.value?.archiveBase64;
      if (typeof encoded !== 'string' || encoded.length > 9_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return send(response, 400, { error: 'invalid-archive' });
      try {
        const archive = parseRecipeArchive(Buffer.from(encoded, 'base64'));
        const drafts = await saveImportDrafts(pool, householdId, archive.recipes);
        if (drafts.error) return send(response, 400, { error: drafts.error });
        return send(response, 201, { imported: drafts.filter((draft) => !draft.duplicate).length, duplicates: drafts.filter((draft) => draft.duplicate).length, skipped: archive.skipped, drafts });
      } catch (error) {
        return send(response, 400, { error: ['unsupported-norish-archive', 'invalid-zip', 'invalid-zip-directory', 'invalid-zip-entry', 'unsupported-or-corrupt-zip-entry', 'no-recipes-found', 'too-many-recipes', 'archive-entry-too-large', 'archive-expands-too-large', 'too-many-archive-entries'].includes(error.message) ? error.message : 'invalid-recipe-archive' });
      }
    }
    const importDraftAction = url.pathname.match(/^\/api\/recipe-imports\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(converted|discarded)$/i);
    if (importDraftAction && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      if (!isUuid(body.value?.householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try {
        const state = importDraftAction[2];
        const result = await pool.query(`UPDATE recipe_import_drafts SET state = $3 WHERE id = $1 AND household_id = $2 AND state = 'draft' RETURNING id`, [importDraftAction[1], body.value.householdId, state]);
        return result.rowCount ? send(response, 200, { state }) : send(response, 404, { error: 'recipe-import-draft-not-found' });
      } catch { return send(response, 500, { error: 'recipe-import-update-failed' }); }
    }
    const recipeId = url.pathname.match(/^\/api\/recipes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
    if (recipeId && request.method === 'PATCH') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateRecipeSettings(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const recipe = await updateRecipeSettings(pool, recipeId, validation.data);
        if (!recipe) return send(response, 404, { error: 'recipe-not-found' });
        if (recipe.error) return send(response, 409, { error: recipe.error });
        return send(response, 200, { recipe });
      } catch { return send(response, 500, { error: 'recipe-settings-update-failed' }); }
    }
    if (recipeId && request.method === 'PUT') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateRecipeInput(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const recipe = await updateRecipe(pool, recipeId, validation.data);
        if (!recipe) return send(response, 404, { error: 'recipe-not-found' });
        if (recipe.error) return send(response, recipe.error==='recipe-used-in-prepared-meal'?409:400, { error: recipe.error });
        return send(response, 200, { recipe });
      } catch {
        return send(response, 500, { error: 'recipe-update-failed' });
      }
    }
    if (recipeId && request.method === 'GET') {
      try {
        const recipe = await readRecipe(pool, recipeId);
        return recipe ? send(response, 200, { recipe }) : send(response, 404, { error: 'recipe-not-found' });
      } catch {
        return send(response, 500, { error: 'recipe-read-failed' });
      }
    }

    if (url.pathname === '/api/foods' && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateFoodInput(body.value, { creating: true });
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const food = await createFood(pool, validation.data);
        if (food.error) return send(response, 409, { error: food.error, matches: food.matches ?? [] });
        return send(response, 201, { food });
      } catch {
        return send(response, 500, { error: 'food-create-failed' });
      }
    }

    const foodId = url.pathname.match(/^\/api\/foods\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
    const suggestionsMatch = url.pathname.match(/^\/api\/foods\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/nutrition-suggestions$/i);
    if (suggestionsMatch && request.method === 'GET') {
      try {
        const food = await getFood(pool, suggestionsMatch[1]);
        if (!food) return send(response, 404, { error: 'food-not-found' });
        const products = await searchOpenFoodFacts(food.name);
        return send(response, 200, { source: 'Open Food Facts', products });
      } catch {
        return send(response, 503, { error: 'external-nutrition-source-unavailable' });
      }
    }
    const completionMatch = url.pathname.match(/^\/api\/foods\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/complete-nutrition$/i);
    if (completionMatch && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      if (body.value.source !== 'open-food-facts' || !/^\d{8,14}$/.test(body.value.sourceReference ?? '')) {
        return send(response, 400, { error: 'invalid-nutrition-source' });
      }
      try {
        const product = await getOpenFoodFactsProduct(body.value.sourceReference);
        if (!product) return send(response, 404, { error: 'external-product-not-found' });
        const result = await fillMissingNutritionFromExternal(pool, completionMatch[1], product);
        if (!result) return send(response, 404, { error: 'food-not-found' });
        if (result.error) return send(response, 400, { error: result.error });
        return send(response, 200, result);
      } catch {
        return send(response, 503, { error: 'external-nutrition-source-unavailable' });
      }
    }
    if (foodId && request.method === 'GET') {
      try {
        const food = await getFood(pool, foodId);
        return food ? send(response, 200, { food }) : send(response, 404, { error: 'food-not-found' });
      } catch {
        return send(response, 500, { error: 'food-read-failed' });
      }
    }
    if (foodId && request.method === 'DELETE') {
      try {
        const result = await deleteFood(pool, foodId);
        if (!result) return send(response, 404, { error: 'food-not-found' });
        if (result.error) return send(response, 409, result);
        return send(response, 200, result);
      } catch {
        return send(response, 500, { error: 'food-delete-failed' });
      }
    }
    if (foodId && request.method === 'PATCH') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateFoodInput(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const food = await updateFood(pool, foodId, validation.data);
        if (!food) return send(response, 404, { error: 'food-not-found' });
        if (food.error) return send(response, 409, { error: food.error, matches: food.matches ?? [] });
        return send(response, 200, { food });
      } catch {
        return send(response, 500, { error: 'food-update-failed' });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/foods') {
      const query = (url.searchParams.get('q') ?? '').trim();
      const unit = url.searchParams.get('unit') ?? '';
      const onlyIncomplete = url.searchParams.get('incomplete') === 'true';
      const sourceFilter = url.searchParams.get('source') === 'ciqual' ? 'ciqual' : '';
      if (query.length === 1) return send(response, 200, { foods: [], total: 0, limit: 50, offset: 0 });
      const normalizedQuery = normalizeSearch(query);
      const ignoredSearchTokens = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'au', 'aux']);
      const searchTokens = [...new Set(normalizedQuery.split(' ').filter((token) => token.length > 1 && !ignoredSearchTokens.has(token))
        .map((token) => token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token))];
      const limit = integerInRange(url.searchParams.get('limit'), 50, 1, 100);
      const offset = integerInRange(url.searchParams.get('offset'), 0, 0, 100000);
      try {
        const result = await pool.query(
          `SELECT f.id, f.canonical_name AS name, f.brand, f.source,
                  f.source_reference, f.source_note,
                  jsonb_object_agg(n.id, fn.value_per_100g ORDER BY n.sort_order)
                    FILTER (WHERE n.id IS NOT NULL) AS nutrients_per_100g
             FROM foods f
             LEFT JOIN food_nutrients fn ON fn.food_id = f.id
             LEFT JOIN nutrients n ON n.id = fn.nutrient_id
            WHERE ($8 = '' OR f.source = $8)
              AND ($7::boolean = false OR EXISTS (
                    SELECT 1 FROM nutrients required
                     WHERE required.is_required_for_recipe
                       AND NOT EXISTS (SELECT 1 FROM food_nutrients missing
                                        WHERE missing.food_id = f.id
                                          AND missing.nutrient_id = required.id
                                          AND missing.value_per_100g IS NOT NULL)
                  ))
              AND ($1 = '' OR lower(f.canonical_name) LIKE '%' || lower($1) || '%'
               OR EXISTS (
                    SELECT 1 FROM food_aliases a
                     WHERE a.food_id = f.id
                       AND a.normalized_alias LIKE '%' || $2 || '%'
                  )
               OR (cardinality($6::text[]) > 0 AND (
                    SELECT count(*) FROM unnest($6::text[]) AS search_token
                     WHERE lower(f.canonical_name) LIKE '%' || search_token || '%'
                        OR EXISTS (SELECT 1 FROM food_aliases a
                                    WHERE a.food_id = f.id
                                      AND a.normalized_alias LIKE '%' || search_token || '%')
                  ) >= GREATEST(1, ceil(cardinality($6::text[]) * 0.6)::integer)))
            GROUP BY f.id
            ORDER BY CASE WHEN
                       ($5 IN ('ml', 'l', 'tsp', 'tbsp', 'cup') AND f.grams_per_millilitre IS NOT NULL)
                       OR ($5 = 'piece' AND EXISTS (SELECT 1 FROM food_unit_conversions c WHERE c.food_id = f.id AND c.unit_id = 'piece'))
                       OR ($5 NOT IN ('ml', 'l', 'tsp', 'tbsp', 'cup', 'piece'))
                     THEN 0 ELSE 1 END,
                     CASE WHEN $1 <> '' AND lower(f.canonical_name) = lower($1) THEN 0
                          WHEN EXISTS (SELECT 1 FROM food_aliases a WHERE a.food_id = f.id AND a.normalized_alias = $2) THEN 0
                          WHEN EXISTS (SELECT 1 FROM food_aliases a WHERE a.food_id = f.id AND a.normalized_alias LIKE $2 || '%') THEN 1
                          ELSE 2 END,
                     (SELECT count(*) FROM unnest($6::text[]) AS search_token
                       WHERE lower(f.canonical_name) LIKE '%' || search_token || '%'
                          OR EXISTS (SELECT 1 FROM food_aliases a
                                      WHERE a.food_id = f.id
                                        AND a.normalized_alias LIKE '%' || search_token || '%')) DESC,
                     f.canonical_name
            LIMIT $3 OFFSET $4`,
          [query, normalizedQuery, limit, offset, unit, searchTokens, onlyIncomplete, sourceFilter],
        );
        const count = await pool.query(
          `SELECT count(*)::integer AS total FROM foods f
            WHERE ($5 = '' OR f.source = $5)
              AND ($4::boolean = false OR EXISTS (
                    SELECT 1 FROM nutrients required
                     WHERE required.is_required_for_recipe
                       AND NOT EXISTS (SELECT 1 FROM food_nutrients missing
                                        WHERE missing.food_id = f.id
                                          AND missing.nutrient_id = required.id
                                          AND missing.value_per_100g IS NOT NULL)
                  ))
              AND ($1 = '' OR lower(f.canonical_name) LIKE '%' || lower($1) || '%'
               OR EXISTS (SELECT 1 FROM food_aliases a WHERE a.food_id = f.id AND a.normalized_alias LIKE '%' || $2 || '%')
               OR (cardinality($3::text[]) > 0 AND (
                    SELECT count(*) FROM unnest($3::text[]) AS search_token
                     WHERE lower(f.canonical_name) LIKE '%' || search_token || '%'
                        OR EXISTS (SELECT 1 FROM food_aliases a
                                    WHERE a.food_id = f.id
                                      AND a.normalized_alias LIKE '%' || search_token || '%')
                  ) >= GREATEST(1, ceil(cardinality($3::text[]) * 0.6)::integer)))`,
          [query, normalizedQuery, searchTokens, onlyIncomplete, sourceFilter],
        );
        return send(response, 200, { foods: result.rows, total: count.rows[0].total, limit, offset });
      } catch {
        return send(response, 500, { error: 'food-search-failed' });
      }
    }

    return send(response, 404, { error: 'not-found' });
}

function send(response, status, body) {
  response.writeHead(status);
  response.end(JSON.stringify(body));
}

function signSession(issuedAt, password) {
  return createHmac('sha256', password).update(issuedAt).digest('base64url');
}

function hasSession(request, password) {
  const cookieHeader = request.headers?.cookie ?? '';
  const cookie = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith('lapinou_session='));
  const value = cookie?.slice('lapinou_session='.length) ?? '';
  const [issuedAt, signature, extra] = value.split('.');
  if (!issuedAt || !signature || extra || !/^\d+$/.test(issuedAt)) return false;
  const timestamp = Number(issuedAt);
  const now = Math.floor(Date.now() / 1000);
  if (timestamp > now + 60 || now - timestamp > SESSION_SECONDS) return false;
  const expected = Buffer.from(signSession(issuedAt, password));
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();
}

function integerInRange(value, fallback, min, max) {
  const parsed = value === null ? fallback : Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

async function readJson(request) {
  let raw = '';
  try {
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 9_500_000) return { error: 'body-too-large', status: 413 };
    }
    return { value: JSON.parse(raw || '{}') };
  } catch {
    return { error: 'invalid-json' };
  }
}


function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
function isSupportedRecipeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && ['instagram.com', 'www.instagram.com', 'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].includes(url.hostname.toLowerCase()); }
  catch { return false; }
}
