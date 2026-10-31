import { breakfastServingLimit, calculateDailyEnergy, calculateDailyProtein, calculatePersonEnergy, calculatePersonProtein, calculateWeeklyEnergyTarget, dailyProteinTarget, capAccompanimentQuantity, mainServingLimit, MIN_PROTEIN_G_PER_MEAL, rebalanceNaturalPortions, saladServingLimit, SLOT_RATIOS, suggestQuantity } from './portion-planner.js';
import {mountCookingInstagram} from './cooking-instagram.js';
import {servingUnit,servingUnitLabel,displayServingQuantity,setServingInput,servingInputValue} from './serving-quantities.js';
import {roundServingCalories,compensateManualServing} from './serving-compensation.js';
import {shoppingPreferenceControls,shoppingPreferencesPanel,shoppingPreferenceError} from './shopping-preferences.js';
import { MEAL_ORDER, MEAL_LABELS, validMealRatios } from './meal-config.js';
import { suggestPlatePortions } from './portion-planner.js';
import { PLATE_PARTS, validPlateRatios } from './meal-config.js';
import { preparationWeeks } from './preparation-weeks.js';
import { clampFoodPageOffset } from './food-pagination.js';
import { groupPreparations, suggestedProductionQuantity, suggestedServingQuantities, scaledIngredients, scaledSourceIngredients, productionRecipe, cookingYield } from './cooking-sheet.js';
import { ingredientCookingFactor, fillCookingFactorOptions, recipeServiceChoices, recipeServiceMode, recipeDisplayPreferences, filterRecipeDirectory, recipeCardForSource, recipeMissingData, recipeMomentLabel, recipeTypeLabel, recipePlanningLabel } from './recipe-directory.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { offset: 0, limit: 50, query: '', onlyIncomplete: false, total: 0, household: null, selectedFoodIds:new Set(), foodYieldConversions:[], mealAdditions:[], productionTypes:[], productionTypesHouseholdId:null, debounce: null, editingRecipeId: null, editingFoodFromRecipe: false, editingFoodFromShopping: false, editingOrderLinkId: null, importingDraftId: null, generateImportedImage: false, people: [], recipes: [], plannedRecipeIds: [], plannedRecipeLookupError: null, preparations: [], calendarWeekStart: null, calendarMealId: null, calendarMeals: [], routines: [], ingredients: [], reserveOverview: null, calendarReserveOverview: null, proteinTargets: {}, mealOccasionEnergy: {}, openShoppingStores: new Set(), openShoppingProducts: new Set() };
let recipeImageConfig={enabled:false}, imageRecipeId=null;
const nutrientLabels = [['energyKcal', 'kcal'], ['proteinG', 'g prot.'], ['carbohydrateG', 'g gluc.'], ['fatG', 'g lip.']];
const selectedStoreFoods=new Map();
let visibleStoreFoods=[],storeSearchSequence=0,storeSearchTimer;
let preparationsRequest=0;

async function api(path, options = {}) {
  const { timeoutMs, ...requestOptions } = options;
  const response = await fetch(path, {
    ...requestOptions,
    signal: options.signal ?? AbortSignal.timeout(timeoutMs ?? 8000),
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error ?? `HTTP ${response.status}`), { status: response.status, body });
  return body;
}

function showMessage(target, text, success = false) {
  target.textContent = text;
  target.style.color = success ? 'var(--positive, #63d7b0)' : '';
}

const appViewHistory=[];
let currentAppView='home';
function setView(name, { recordHistory=true }={}) {
  if(name === 'profiles')name='admin';
  if(recordHistory&&name!==currentAppView){appViewHistory.push(currentAppView);currentAppView=name;$('#app-back').disabled=appViewHistory.length===0;}
  $('#home-view').classList.toggle('hidden', name !== 'home');
  $('#foods-view').classList.toggle('hidden', name !== 'foods');
  $('#recipes-view').classList.toggle('hidden', name !== 'recipes');
  $('#import-view').classList.toggle('hidden', name !== 'import');
  $('#calendar-view').classList.toggle('hidden', name !== 'calendar');
  $('#profiles-view').classList.toggle('hidden', name !== 'admin');
  $('#shopping-view').classList.toggle('hidden', name !== 'shopping');
  $('#admin-view').classList.toggle('hidden', name !== 'admin');
  $$('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'home') refreshDashboard();
  if (name === 'foods') return refreshFoods();
  if (name === 'recipes') return refreshFoodYieldConversions().then(refreshRecipes);
  if (name === 'import') return Promise.all([refreshImportDrafts(),refreshRecipeAIConfig()]);
  if (name === 'calendar') refreshCalendar();
  if (name === 'profiles') refreshPeople();
  if (name === 'shopping') refreshShopping();
  if (name === 'admin') refreshMealSettings();
}
$('#app-back')?.addEventListener('click',()=>{
  const previous=appViewHistory.pop();
  if(!previous)return;
  currentAppView=previous;$('#app-back').disabled=appViewHistory.length===0;
  setView(previous,{recordHistory:false});
});
function setAdminTab(name){
  $$('.admin-tabs [data-admin-tab]').forEach(button=>{const selected=button.dataset.adminTab===name;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
  $$('[data-admin-panel]').forEach(panel=>{panel.hidden=panel.dataset.adminPanel!==name;});
}
$$('.admin-tabs [data-admin-tab]').forEach(button=>{
  button.addEventListener('click',()=>setAdminTab(button.dataset.adminTab));
  button.addEventListener('keydown',event=>{
    const buttons=$$('.admin-tabs [data-admin-tab]'),index=buttons.indexOf(button);
    const next=event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index-1+buttons.length)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:-1;
    if(next>=0){event.preventDefault();buttons[next].focus();setAdminTab(buttons[next].dataset.adminTab);}
  });
});

const dashboardSlots = MEAL_ORDER;
const dashboardSlotLabels = MEAL_LABELS;
function dashboardPanel(title, className='dashboard-panel') {
  const panel=document.createElement('section'); panel.className=className;
  const heading=document.createElement('h2'); heading.textContent=title; panel.append(heading); return panel;
}
function dashboardAction(label,view) {
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;button.addEventListener('click',()=>setView(view));return button;
}
function mealNutritionForPerson(meal,personId) {
  if(meal.isOccasion){const entry=meal.occasionEnergy?.find(value=>value.personId===personId);return{kcal:Number(entry?.kcal??0),protein:0,missing:!entry,items:[{name:meal.occasionTitle||'Repas exceptionnel',quantity:1,unit:'estimation'}]};}
  let kcal=0,protein=0,missing=false,items=[];
  for(const item of meal.items??[]){
    const amount=item.amounts.find(entry=>entry.personId===personId); if(!amount) continue;
    const per=item.recipe?.nutrition?.perYieldUnit;
    const energy=per?.energyKcal, prot=per?.proteinG;
    if(energy==null||prot==null||!item.recipe?.nutrition?.complete) missing=true;
    if(energy!=null)kcal+=energy*amount.quantity;
    if(prot!=null)protein+=prot*amount.quantity;
    items.push({name:item.recipe?.name??'Recette',quantity:displayServingQuantity(item.recipe,amount.quantity),unit:servingUnitLabel(servingUnit(item.recipe))});
  }
  return {kcal,protein,missing,items};
}
async function refreshDashboard() {
  const root=$('#dashboard-content'); if(!root||!state.household){if(root)root.replaceChildren(emptyMessage('Crée d’abord un foyer.'));return;}
  root.replaceChildren(emptyMessage('Chargement du tableau de bord…'));
  const today=localDateValue();
  try {
    const [plan,peopleResult,planning,reserve]=await Promise.all([
      api(`/api/planning?householdId=${encodeURIComponent(state.household.id)}&weekStart=${mondayOf(today)}`),
      api(`/api/people?householdId=${encodeURIComponent(state.household.id)}`),
      api(`/api/household-planning?householdId=${encodeURIComponent(state.household.id)}`),
      api(`/api/energy-reserve?householdId=${encodeURIComponent(state.household.id)}&asOf=${today}`)
    ]);
    state.reserveOverview=reserve;
    const meals=(plan.meals??[]).filter(meal=>meal.mealDate===today);
    const people=peopleResult.people??[]; state.people=people; state.routines=planning.routines??[];
    const intro=document.createElement('div');intro.className='dashboard-welcome';
    const copy=document.createElement('div');const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent=displayDate(today,{weekday:'long',day:'numeric',month:'long'});
    const title=document.createElement('h1');title.textContent='Aujourd’hui à la maison';
    const subtitle=document.createElement('p');subtitle.textContent='Tes repas, les repères du foyer et ce qui mérite ton attention.';
    copy.append(eyebrow,title,subtitle);intro.append(copy,dashboardAction('Ouvrir le calendrier','calendar'));root.replaceChildren(intro);
    const stats=document.createElement('div');stats.className='dashboard-stats';
    const plannedCount=meals.length;
    const plannedRecipes=new Set(meals.flatMap(meal=>meal.items.map(item=>item.recipeId))).size;
    const lowStock=(planning.stock??[]).filter(item=>Number(item.availableQuantity)<=0);
    const nextRoutine=(planning.routines??[]).slice().sort((x,y)=>x.nextDate.localeCompare(y.nextDate))[0];
    const statData=[
      [`${plannedCount}`,'repas planifié'+(plannedCount===1?'':'s')],
      [`${plannedRecipes}`,'préparation'+(plannedRecipes===1?'':'s')+' au menu'],
      [`${lowStock.length}`,'stock'+(lowStock.length===1?'':'s')+' à refaire'],
      [nextRoutine?displayDate(nextRoutine.nextDate,{day:'numeric',month:'short'}):'—',nextRoutine?routineLabels[nextRoutine.routineId]:'Prochaine routine']
    ];
    for(const [value,label] of statData){const card=document.createElement('article');card.className='dashboard-stat';const strong=document.createElement('strong');strong.textContent=value;const small=document.createElement('span');small.textContent=label;card.append(strong,small);stats.append(card);}root.append(stats);
    const layout=document.createElement('div');layout.className='dashboard-layout';
    const menu=dashboardPanel('Menus du jour');menu.classList.add('dashboard-menu');
    for(const slot of dashboardSlots){
      const section=document.createElement('section');section.className='dashboard-meal-slot';
      const heading=document.createElement('h3');heading.textContent=dashboardSlotLabels[slot];section.append(heading);
      const slotMeals=meals.filter(meal=>meal.slot===slot);
      if(!slotMeals.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Rien de planifié';section.append(empty);}
      for(const meal of slotMeals){
        const mealCard=document.createElement('article');mealCard.className='dashboard-meal';
        const photoRecipe=meal.items.map(item=>item.recipe).find(recipe=>recipe?.imageAvailable);
        if(photoRecipe){const photo=document.createElement('img');photo.className='dashboard-meal-photo';photo.alt='';photo.loading='lazy';
          photo.src=`/api/recipes/${photoRecipe.id}/image?householdId=${encodeURIComponent(state.household.id)}&v=${photoRecipe.version??0}`;
          photo.addEventListener('error',()=>{photo.hidden=true;});mealCard.append(photo);}

        const mealHead=document.createElement('div');mealHead.className='dashboard-meal-heading';
        const note=document.createElement('span');note.textContent=meal.notes||'Repas familial';
        const edit=document.createElement('button');edit.type='button';edit.className='text-button';edit.textContent='Modifier';
        if(meal.preparedAt){edit.disabled=true;edit.title='Annule la préparation depuis le calendrier avant de modifier ce repas.';}
        edit.addEventListener('click',()=>openMealEditor(meal.mealDate,meal.slot,meal));mealHead.append(note,edit);mealCard.append(mealHead);
        const roster=people.filter(person=>meal.attendees.some(att=>att.id===person.id));
        if(!roster.length){mealCard.append(emptyMessage('Aucune personne associée.'));}
        for(const person of roster){
          const info=mealNutritionForPerson(meal,person.id);
          const row=document.createElement('div');row.className='dashboard-person-meal';
          const personName=document.createElement('strong');personName.textContent=person.displayName;
          const recipeText=document.createElement('span');recipeText.textContent=info.items.map(item=>`${item.name} × ${formatQty(item.quantity)} ${item.unit}`).join(' · ')||'Recette à préciser';
          const nutrition=document.createElement('small');nutrition.textContent=meal.isOccasion?`${format(info.kcal)} kcal estimées · hors quotas, épargne utilisée`:`${format(info.kcal)} kcal · ${format(info.protein)} g protéines${info.missing?' · calcul incomplet':''}`;
          row.append(personName,recipeText,nutrition);mealCard.append(row);
        }
        section.append(mealCard);
      }
      const add=document.createElement('button');add.type='button';add.className='dashboard-add';add.textContent='+ Ajouter un repas';
      add.addEventListener('click',()=>openMealEditor(today,slot));section.append(add);menu.append(section);
    }
    const sidebar=document.createElement('div');sidebar.className='dashboard-sidebar';
    const profiles=dashboardPanel('Repères personnels');
    if(!people.length)profiles.append(emptyMessage('Ajoute les membres du foyer dans Profils.'));
    for(const person of people){
      const profile=latestProfile(person,today);const weight=person.weightHistory?.[0];
      const dailyMeals=meals.filter(meal=>meal.attendees.some(att=>att.id===person.id));
      const statsForDay=dailyMeals.flatMap(meal=>{const info=mealNutritionForPerson(meal,person.id);return [{meal,info}];});
      const kcal=statsForDay.reduce((sum,row)=>sum+row.info.kcal,0), protein=statsForDay.reduce((sum,row)=>sum+row.info.protein,0);
      const card=document.createElement('article');card.className='dashboard-profile';
      const heading=document.createElement('div');heading.className='dashboard-profile-heading';
      const name=document.createElement('strong');name.textContent=person.displayName;
      const goal=document.createElement('span');goal.textContent=profile?.dailyEnergyKcal?`${format(kcal)} / ${format(profile.dailyEnergyKcal)} kcal`:'Objectif kcal non renseigné';
      heading.append(name,goal);card.append(heading);
      if(profile?.dailyEnergyKcal){const progress=document.createElement('progress');progress.max=profile.dailyEnergyKcal;progress.value=Math.min(kcal,profile.dailyEnergyKcal);progress.setAttribute('aria-label',`Progression calories de ${person.displayName}`);card.append(progress);}
      const details=document.createElement('p');details.textContent=`${format(protein)} g protéines · ${profile?.activityLevel?(activityLabels[profile.activityLevel]??profile.activityLevel):'activité à renseigner'}${weight?` · ${format(weight.weightKg)} kg`:''}`;card.append(details);
      const remaining=profile?.dailyEnergyKcal?profile.dailyEnergyKcal-kcal:null;
      if(remaining!=null){const small=document.createElement('small');small.textContent=remaining>=0?`${format(remaining)} kcal restantes selon le menu prévu`:`${format(Math.abs(remaining))} kcal au-dessus du repère prévu`;card.append(small);}
      profiles.append(card);
    }
    profiles.append(dashboardAction('Gérer les profils','profiles'));sidebar.append(profiles);
    const reservePanel=dashboardPanel('Épargne kcal · 30 jours');
    const adultAccounts=(reserve.accounts??[]);
    if(!adultAccounts.length)reservePanel.append(emptyMessage('Ajoute une date de naissance et un objectif kcal aux profils adultes.'));
    for(const account of adultAccounts){const card=document.createElement('article');card.className='dashboard-profile';const head=document.createElement('div');head.className='dashboard-profile-heading';const name=document.createElement('strong');name.textContent=account.name;const balance=document.createElement('span');balance.textContent=account.balanceKcal>=0?`+${format(account.balanceKcal)} kcal`:`${format(account.balanceKcal)} kcal`;balance.classList.toggle('reserve-negative',account.balanceKcal<0);head.append(name,balance);card.append(head);const note=document.createElement('small');note.textContent=account.incompleteDays?`${account.knownDays} jours calculés · ${account.incompleteDays} jour(s) incomplet(s)`:`Solde prévisionnel glissant · ${account.knownDays} jours calculés`;card.append(note);for(const plan of account.savingsPlans??[]){const planRow=document.createElement('div');planRow.className='reserve-plan-row';const planNote=document.createElement('small');planNote.textContent=`${format(plan.dailyKcal)} kcal/j · ${displayDate(plan.startsOn,{day:'numeric',month:'short'})} au ${displayDate(plan.endsOn,{day:'numeric',month:'short'})}`;const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent='Retirer';remove.addEventListener('click',async()=>{remove.disabled=true;try{await api(`/api/energy-reserve/plans/${plan.id}?householdId=${encodeURIComponent(state.household.id)}`,{method:'DELETE'});await Promise.all([refreshDashboard(),refreshCalendar()]);}catch(error){note.textContent=`Suppression impossible : ${error.body?.error??error.message}`;remove.disabled=false;}});planRow.append(planNote,remove);card.append(planRow);}reservePanel.append(card);}
    reservePanel.append(renderSavingPlanForm(people));sidebar.append(reservePanel);
    const stocks=dashboardPanel('Stocks à surveiller');
    const stockItems=(planning.stock??[]).slice().sort((x,y)=>Number(x.availableQuantity)-Number(y.availableQuantity)).slice(0,5);
    if(!stockItems.length)stocks.append(emptyMessage('Aucun stock suivi pour le moment.'));
    for(const item of stockItems){const row=document.createElement('article');row.className='dashboard-stock';const name=document.createElement('strong');name.textContent=item.name;const detail=document.createElement('span');detail.textContent=`${formatQty(item.availableQuantity)} ${item.unitId} disponibles après réservation des repas`;row.append(name,detail);if(Number(item.availableQuantity)<=0){const tag=document.createElement('b');tag.textContent='À refaire';tag.className='warning-tag';row.append(tag);}stocks.append(row);}
    for(const item of (planning.ingredients??[]).filter(item=>item.alert||!item.complete)){
      const row=document.createElement('article');row.className='dashboard-stock';
      const name=document.createElement('strong');name.textContent=item.name;
      const detail=document.createElement('span');detail.textContent=`Stock : ${formatQty(item.quantityG)} g · minimum : ${formatQty(item.minimumG)} g · besoin sous ${item.leadDays} jours : ${formatQty(item.neededG)} g`;
      const tag=document.createElement('b');tag.className='warning-tag';tag.textContent=item.complete?'À commander : '+formatQty(item.orderG)+' g':'Conversion à compléter';
      row.append(name,tag,detail);stocks.append(row);
    }
    stocks.append(dashboardAction('Voir les courses et stocks','shopping'));sidebar.append(stocks);
    const routines=dashboardPanel('À venir cette semaine');
    const weekEnd=addDays(today,6);const upcoming=(planning.routines??[]).filter(item=>item.nextDate>=today&&item.nextDate<=weekEnd).sort((x,y)=>x.nextDate.localeCompare(y.nextDate));
    if(!upcoming.length)routines.append(emptyMessage('Aucune routine prévue cette semaine.'));
    upcoming.forEach(item=>{const row=document.createElement('p');row.className='dashboard-routine';row.textContent=`${displayDate(item.nextDate,{weekday:'short',day:'numeric',month:'short'})} · ${routineLabels[item.routineId]??item.routineId}`;routines.append(row);});
    routines.append(dashboardAction('Gérer le planning','shopping'));sidebar.append(routines);
    layout.append(menu,sidebar);root.append(layout);
  } catch(error){root.replaceChildren(emptyMessage('Accueil indisponible : '+(error.body?.error??error.message)));}
}

function renderSavingPlanForm(people) {
  const form=document.createElement('form');form.className='reserve-plan-form';
  const heading=document.createElement('h3');heading.textContent='Programmer une épargne supplémentaire';form.append(heading);
  const adults=state.reserveOverview?.accounts??[];
  if(!adults.length){const note=document.createElement('p');note.className='muted';note.textContent='Aucun profil adulte avec objectif kcal disponible.';form.append(note);return form;}
  const personLabel=document.createElement('label');personLabel.textContent='Profil';const person=document.createElement('select');person.name='personId';
  for(const adult of adults)person.add(new Option(adult.name,adult.personId));personLabel.append(person);
  const dates=document.createElement('div');dates.className='yield-row';
  const startLabel=document.createElement('label');startLabel.textContent='Du';const start=document.createElement('input');start.type='date';start.name='startsOn';start.required=true;start.value=localDateValue();start.min=start.value;start.max=addDays(start.value,30);startLabel.append(start);
  const endLabel=document.createElement('label');endLabel.textContent='Au';const end=document.createElement('input');end.type='date';end.name='endsOn';end.required=true;end.value=addDays(start.value,6);end.min=start.value;end.max=addDays(start.value,29);endLabel.append(end);dates.append(startLabel,endLabel);
  start.addEventListener('change',()=>{end.min=start.value;end.max=addDays(start.value,29);if(end.value<start.value)end.value=start.value;if(end.value>end.max)end.value=end.max;});
  const amountLabel=document.createElement('label');amountLabel.textContent='Épargne visée par jour (kcal)';const amount=document.createElement('input');amount.name='dailyKcal';amount.type='number';amount.min='1';amount.max='1000';amount.step='1';amount.value='100';amount.required=true;amountLabel.append(amount);
  const note=document.createElement('p');note.className='hint';note.textContent='Jusqu’à 30 jours. Les prochaines portions proposées utiliseront ce budget réduit. Pour un repas déjà planifié, le calendrier proposera un rééquilibrage avec aperçu avant application.';
  const message=document.createElement('p');message.className='form-message';message.setAttribute('role','status');const button=document.createElement('button');button.type='submit';button.className='secondary';button.textContent='Enregistrer la période d’épargne';
  form.append(personLabel,dates,amountLabel,note,button,message);
  form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;button.disabled=true;message.textContent='Enregistrement…';try{await api('/api/energy-reserve/plans',{method:'POST',body:JSON.stringify({householdId:state.household.id,personId:person.value,startsOn:start.value,endsOn:end.value,dailyKcal:Number(amount.value)})});await Promise.all([refreshDashboard(),refreshCalendar()]);}catch(error){message.textContent=`Épargne non enregistrée : ${error.body?.error??error.message}`;}finally{button.disabled=false;}});
  return form;
}

const routineLabels = {
  bulk_shopping: 'Grosses courses',
  fresh_shopping: 'Courses de frais',
  whey_flour_order: 'Achats en ligne',
  pasta_pastry_production: 'Pâtes et pâtisseries',
  bread_production: 'Pain',
  batch_cooking: 'Batch cooking',
};
const routineOrder = ['bulk_shopping','fresh_shopping','whey_flour_order','pasta_pastry_production','bread_production','batch_cooking'];
const groupLabels = { bulk: 'Grosses courses', fresh: 'Frais', whey_flour: 'Achats en ligne', other: 'Autres' };
function renderRoutines(routines) {
  state.routines = routines;
  const root = $('#routine-list');
  root.replaceChildren(...routineOrder.map((id) => {
    const routine = routines.find((entry) => entry.routineId === id);
    if (!routine) return document.createElement('span');
    const row = document.createElement('div'); row.className = 'routine-row'; row.dataset.routineId = id;
    const name = document.createElement('strong'); name.textContent = routineLabels[id];
    const frequency = document.createElement('select'); frequency.setAttribute('aria-label', 'Fréquence : ' + routineLabels[id]);
    frequency.innerHTML = '<option value="weekly">Chaque semaine</option><option value="biweekly">Tous les 15 jours</option><option value="monthly">Une fois par mois</option>';
    frequency.value = routine.frequency;
    const next = document.createElement('input'); next.type = 'date'; next.required = true; next.value = routine.nextDate; next.setAttribute('aria-label', 'Prochaine date : ' + routineLabels[id]);
    const done = document.createElement('button'); done.type = 'button'; done.className = 'secondary'; done.textContent = 'Fait';
    done.addEventListener('click', async () => {
      try { await api('/api/household-planning/routines/complete', { method:'POST', body:JSON.stringify({householdId:state.household.id,routineId:id}) }); await refreshShopping(); }
      catch(error) { showMessage($('#routines-message'), 'Mise à jour impossible : '+(error.body?.error ?? error.message)); }
    });
    row.append(name,frequency,next,done); return row;
  }));
}
function formatQty(value) { return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value); }
async function refreshShopping() {
  if (!state.household) return;
  const routineMessage = $('#routines-message'); if (routineMessage) routineMessage.textContent = '';
  try {
    const [planning, recipesResult] = await Promise.all([
      api('/api/household-planning?householdId='+encodeURIComponent(state.household.id)),
      api('/api/recipes?householdId='+encodeURIComponent(state.household.id)),
    ]);
    state.recipes = recipesResult.recipes;
    renderRoutines(planning.routines);
    state.ingredients = planning.ingredients ?? [];
    renderIngredientStock(state.ingredients);
    renderProductionOptions();
    const stockRoot = $('#stock-list');
    stockRoot.replaceChildren(...(planning.stock.length ? planning.stock.map((item) => {
      const card=document.createElement('article'); card.className='stock-row';
      const title=document.createElement('strong'); title.textContent=item.name;
      const details=document.createElement('p'); details.textContent=`Produit : ${formatQty(item.producedQuantity)} ${item.unitId} · réservé aux repas planifiés : ${formatQty(item.plannedQuantity)} · disponible : ${formatQty(item.availableQuantity)} ${item.unitId}`;
      const status=document.createElement('span'); status.className='stock-status'; status.textContent=Number(item.availableQuantity)<=0?'À produire':'En stock';
      card.append(title,details,status);
      for(const lot of item.lots??[]){
        const row=document.createElement('div');row.className='production-lot';
        const label=document.createElement('span');label.textContent=`Lot du ${displayDate(lot.producedOn)} · ${formatQty(lot.quantity)} ${item.unitId}${lot.note?' · '+lot.note:''}`;
        const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent=lot.parentLotId?'Annuler le batch complet':'Annuler le lot';
        cancel.addEventListener('click',async()=>{
          if(!confirm((lot.parentLotId?'Les deux parties de ce batch seront annulées ensemble. ' : '')+`Annuler cette saisie de ${formatQty(lot.quantity)} ${item.unitId} de « ${item.name} » ? Le lot sera retiré du stock et les ingrédients qui avaient été déduits seront remis en réserve.`))return;
          cancel.disabled=true;
          try{
            const result=await api(`/api/household-planning/production/${lot.id}?householdId=${encodeURIComponent(state.household.id)}`,{method:'DELETE'});
            const restored=(result.restored??[]).map(row=>`${row.name} : +${formatQty(row.quantityG)} g`).join(' · ');
            showMessage($('#production-message'),'Lot retiré du stock.'+(restored?' Ingrédients remis : '+restored:''),true);
            await refreshShopping();await refreshDashboard();
          }catch(error){showMessage($('#production-message'),error.body?.error==='production-already-used'
            ?'Ce batch a déjà été utilisé par un repas marqué « Préparé ». Annule d’abord cette préparation dans le calendrier.'
            :'Annulation impossible : '+(error.body?.error??error.message));}
          finally{cancel.disabled=false;}
        });
        row.append(label,cancel);card.append(row);
      }
      return card;
    }) : [emptyMessage('Aucun stock suivi. Ajoute un type de production à une recette, puis enregistre une production.')]));
  } catch(error) {
    $('#routine-list').replaceChildren(emptyMessage('Planning indisponible : '+(error.body?.error ?? error.message)));
    $('#stock-list').replaceChildren(emptyMessage('Stock indisponible.'));
  }
  await refreshOrderLinks();
  await refreshFoodStores();
  await refreshShoppingList();
}
async function refreshOrderLinks() {
  const root=$('#order-links');if(!root||!state.household)return;
  try{
    const {links}=await api(`/api/household-order-links?householdId=${encodeURIComponent(state.household.id)}`);
    state.orderLinks=links;
    const choice=$('#food-store-form').elements.orderLinkId,previous=choice.value;
    choice.replaceChildren(new Option('Choisir un magasin…',''),new Option('Sans magasin (retirer l’affectation)','none'),...links.map(link=>new Option(link.label,link.id)));
    choice.value=previous;
    updateStoreSelection();
    if(!links.length){root.replaceChildren(emptyMessage('Aucun magasin enregistré.'));return;}
    root.replaceChildren(...links.map(item=>{
      const row=document.createElement('div');row.className='order-link-row';
      const label=item.url?document.createElement('a'):document.createElement('strong');label.textContent=item.label;
      if(item.url){label.href=item.url;label.target='_blank';label.rel='noopener noreferrer';}
      const host=document.createElement('small');host.textContent=item.url?new URL(item.url).hostname:'Magasin physique';
      const config=document.createElement('details');config.className='store-ha-config';
      const summary=document.createElement('summary');summary.textContent='Home Assistant';
      const field=document.createElement('input');field.placeholder='todo.grand_frais';field.value=item.homeAssistantEntityId??'';
      field.setAttribute('aria-label',`Liste Home Assistant de ${item.label}`);
      const hint=document.createElement('small');hint.textContent='Créer une liste Local to-do par magasin dans Home Assistant. URL et jeton se configurent côté serveur.';
      const saveConfig=document.createElement('button');saveConfig.type='button';saveConfig.className='secondary';saveConfig.textContent='Enregistrer';
      saveConfig.addEventListener('click',async()=>{
        saveConfig.disabled=true;
        try{await api('/api/household-order-links',{method:'POST',body:JSON.stringify({householdId:state.household.id,id:item.id,label:item.label,url:item.url,homeAssistantEntityId:field.value})});showMessage($('#order-link-message'),`Liste Home Assistant de ${item.label} enregistrée.`,true);await refreshOrderLinks();}
        catch(error){showMessage($('#order-link-message'),'Liste non enregistrée : '+(error.body?.error??error.message));saveConfig.disabled=false;}
      });
      config.append(summary,hint,field,saveConfig);
      const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Modifier';edit.setAttribute('aria-label',`Modifier le magasin ${item.label}`);
      edit.addEventListener('click',()=>{
        const form=$('#order-link-form');state.editingOrderLinkId=item.id;form.elements.label.value=item.label;form.elements.url.value=item.url??'';
        form.querySelector('button[type="submit"]').textContent='Enregistrer les modifications';$('#cancel-order-link-edit').classList.remove('hidden');
        showMessage($('#order-link-message'),`Modification du magasin « ${item.label} ».`);form.scrollIntoView({behavior:'smooth',block:'center'});
      });
      const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Supprimer';remove.setAttribute('aria-label',`Supprimer le lien ${item.label}`);
      remove.addEventListener('click',async()=>{
        const count=(state.foodStores??[]).filter(assignment=>assignment.orderLinkId===item.id).length;
        if(count&&!confirm(`Supprimer la boutique « ${item.label} » et retirer l’affectation de ${count} aliment(s) ? Ces aliments resteront dans les courses, sans boutique.`))return;
        remove.disabled=true;try{await api(`/api/household-order-links/${item.id}?householdId=${encodeURIComponent(state.household.id)}`,{method:'DELETE'});await refreshOrderLinks();await refreshFoodStores();await refreshShoppingList();}catch(error){showMessage($('#order-link-message'),'Suppression impossible : '+(error.body?.error??error.message));remove.disabled=false;}
      });
      const actions=document.createElement('div');actions.className='order-link-actions';actions.append(edit,remove);
      row.append(label,host,config,actions);return row;
    }));
  }catch(error){root.replaceChildren(emptyMessage('Liens indisponibles : '+(error.body?.error??error.message)));}
}
function foodStoreSelect(value,name) {
  const select=document.createElement('select');select.setAttribute('aria-label',`Boutique pour ${name}`);
  select.add(new Option('Sans magasin',''));
  for(const link of state.orderLinks??[])select.add(new Option(link.label,link.id));
  select.value=value;return select;
}
function updateStoreSelection() {
  const selected=[...selectedStoreFoods.values()];
  $('#food-store-selection').textContent=selected.length?`${selected.length} aliment(s) sélectionné(s) : ${selected.map(food=>food.name).join(', ')}`:'Aucun aliment sélectionné.';
  $('#food-store-form button[type="submit"]').disabled=!selected.length || !$('#food-store-form').elements.orderLinkId.value;
  $('#select-store-results').disabled=!visibleStoreFoods.length;
}
function renderStoreSearchResults(total=visibleStoreFoods.length) {
  const root=$('#food-store-results');
  root.replaceChildren(...visibleStoreFoods.map(food=>{
    const label=document.createElement('label');label.className='food-store-result';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=food.id;checkbox.checked=selectedStoreFoods.has(food.id);
    checkbox.addEventListener('change',()=>{
      if(checkbox.checked&&selectedStoreFoods.size>=200){checkbox.checked=false;showMessage($('#food-store-message'),'Sélectionne au maximum 200 aliments à la fois.');return;}
      if(checkbox.checked)selectedStoreFoods.set(food.id,food);else selectedStoreFoods.delete(food.id);updateStoreSelection();
    });
    label.append(checkbox,document.createTextNode(food.name));return label;
  }));
  if(!visibleStoreFoods.length)root.append(emptyMessage('Aucun aliment trouvé.'));
  if(total>visibleStoreFoods.length){const hint=document.createElement('p');hint.className='hint';hint.textContent=`${visibleStoreFoods.length} premiers résultats sur ${total}. Affine la recherche pour trouver les autres aliments.`;root.append(hint);}
  updateStoreSelection();
}
async function refreshFoodStores() {
  const root=$('#food-store-assignments');if(!state.household)return;
  if(state.foodStoreHousehold!==state.household.id){state.foodStoreHousehold=state.household.id;selectedStoreFoods.clear();visibleStoreFoods=[];$('#food-store-search').value='';$('#food-store-results').replaceChildren(emptyMessage('Saisis au moins deux caractères.'));storeSearchSequence++;updateStoreSelection();}
  try {
    const {assignments}=await api(`/api/household-food-stores?householdId=${encodeURIComponent(state.household.id)}`);state.foodStores=assignments;
    root.replaceChildren(...assignments.map(item=>{
      const row=document.createElement('div');row.className='food-store-assignment';
      const name=document.createElement('span');name.textContent=item.name;
      const select=foodStoreSelect(item.orderLinkId,item.name);
      select.addEventListener('change',async()=>{
        select.disabled=true;
        try{await saveFoodStoreSelection([item.foodId],select.value||null);await refreshFoodStores();await refreshShoppingList();}
        catch(error){showMessage($('#food-store-message'),'Affectation non enregistrée : '+(error.body?.error??error.message));select.value=item.orderLinkId;select.disabled=false;}
      });row.append(name,select);return row;
    }));
    if(!assignments.length)root.append(emptyMessage('Aucun aliment associé. Les courses sans boutique restent disponibles.'));
  }catch(error){root.replaceChildren(emptyMessage('Affectations indisponibles : '+(error.body?.error??error.message)));}
}
async function saveFoodStoreSelection(foodIds,orderLinkId) {
  return api('/api/household-food-stores',{method:'PUT',body:JSON.stringify({householdId:state.household.id,foodIds,orderLinkId})});
}
$('#food-store-search').addEventListener('input',event=>{
  clearTimeout(storeSearchTimer);const query=event.currentTarget.value.trim(),sequence=++storeSearchSequence;
  visibleStoreFoods=[];updateStoreSelection();
  $('#food-store-results').replaceChildren(emptyMessage(query.length<2?'Saisis au moins deux caractères.':'Recherche…'));
  if(query.length<2)return;
  storeSearchTimer=setTimeout(async()=>{
    try{const result=await api('/api/foods?q='+encodeURIComponent(query)+'&limit=50');if(sequence!==storeSearchSequence)return;visibleStoreFoods=result.foods;renderStoreSearchResults(result.total);}
    catch{if(sequence===storeSearchSequence)$('#food-store-results').replaceChildren(emptyMessage('Recherche indisponible.'));}
  },250);
});
$('#select-store-results').addEventListener('click',()=>{
  for(const food of visibleStoreFoods)if(selectedStoreFoods.size<200 || selectedStoreFoods.has(food.id))selectedStoreFoods.set(food.id,food);
  renderStoreSearchResults();
});
$('#clear-store-selection').addEventListener('click',()=>{selectedStoreFoods.clear();renderStoreSearchResults();});
$('#food-store-form').elements.orderLinkId.addEventListener('change',updateStoreSelection);
$('#food-store-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,message=$('#food-store-message');
  if(!state.household||!selectedStoreFoods.size||!form.reportValidity())return;
  const foodIds=[...selectedStoreFoods.keys()],orderLinkId=form.elements.orderLinkId.value;
  $('button[type="submit"]',form).disabled=true;
  try{
    await saveFoodStoreSelection(foodIds,orderLinkId==='none'?null:orderLinkId);
    selectedStoreFoods.clear();renderStoreSearchResults();await refreshFoodStores();await refreshShoppingList();
    showMessage(message,`${foodIds.length} aliment(s) ${orderLinkId==='none'?'sans boutique':'associé(s) à la boutique'}. Les listes de courses ont été actualisées.`,true);
  }catch(error){showMessage(message,'Affectation non enregistrée : '+(error.body?.error??error.message));}
  finally{updateStoreSelection();}
});
function renderProductionOptions() {
  const select=$('#production-form').elements.recipeId;
  const extra=$('#extra-production-recipe');
  const previous=select.value;
  const available=state.recipes.filter(recipe=>recipe.productionType&&recipe.productionType!=='none'&&!recipe.parentRecipeId);
  const plannedIds=new Set(state.preparations.filter(item=>item.toMakeQuantity>0&&item.productionType!=='none')
    .map(item=>item.parentRecipeId??item.recipeId));
  select.replaceChildren(new Option('Choisir une préparation des menus…',''));
  for(const recipe of available.filter(item=>plannedIds.has(item.id)))select.add(new Option(`${recipe.name} · ${formatQty(recipe.yield.amount)} ${recipe.yield.unitId}`,recipe.id));
  if(previous&&[...select.options].some(option=>option.value===previous))select.value=previous;
  extra.replaceChildren(new Option('Choisir une autre préparation…',''),...available.map(recipe=>new Option(recipe.name,recipe.id)));
}
function preparationRow(group,productionDate) {
  const recipe=state.recipes.find(entry=>entry.id===group.recipeId),parts=group.parts;
  const first=parts[0],covered=parts.every(item=>item.toMakeQuantity<=0.00001);
  const row=document.createElement('article');row.className='preparation-row'+(covered?' is-covered':'');
  const title=document.createElement('strong');title.textContent=recipe?.name??first.name;
  const nutritionBadge=recipe && !recipe.nutrition?.complete?document.createElement('span'):null;
  if(nutritionBadge){nutritionBadge.className='incomplete-tag preparation-incomplete-tag';nutritionBadge.textContent='Données incomplètes';nutritionBadge.setAttribute('aria-label','Données nutritionnelles incomplètes');}
  const dates=document.createElement('small');dates.textContent=`${Math.max(...parts.map(item=>item.mealCount))} repas · ${displayDate(first.firstDate)}${first.lastDate!==first.firstDate?' au '+displayDate(first.lastDate):''}`;
  const amount=document.createElement('span');amount.className='preparation-amount';
  const suggested=suggestedProductionQuantity(group,recipe);
  amount.textContent=covered?'Couvert par le stock':recipe?`${formatQty(suggested)} ${cookingYield(recipe).unitId} à produire`:'À produire';
  row.append(title);if(nutritionBadge)row.append(nutritionBadge);row.append(dates,amount);
  if(first.minimumProductionQuantity>0){const minimum=document.createElement('small');minimum.className='preparation-minimum';minimum.textContent=`Lot minimum : ${formatQty(first.minimumProductionAmount)} ${productionUnitLabels[first.minimumProductionUnitId]??first.minimumProductionUnitId}`;row.append(minimum);}
  const details=document.createElement('ul');details.className='preparation-parts';
  for(const part of parts){const line=document.createElement('li');line.textContent=`${part.parentRecipeId?part.name.split(' — ').at(-1):'Recette entière'} : ${part.toMakeQuantity<=0.00001?'couvert':`${formatQty(part.toMakeQuantity)} ${part.unitId} à produire`} · prévu ${formatQty(part.plannedQuantity)} ${part.unitId} · stock couvrant ${formatQty(part.coveredQuantity)} ${part.unitId}`;details.append(line);}
  row.append(details);
  if(recipe){
    const link=document.createElement('button');link.type='button';link.className='secondary';link.textContent='Voir la recette';link.addEventListener('click',()=>showRecipeCard(recipe.id));row.append(link);
    const cook=document.createElement('button');cook.type='button';cook.className='secondary';cook.textContent='Cuisiner';cook.addEventListener('click',()=>openCookingSheet(recipe.id,suggested,productionDate,group));row.append(cook);
  }
  const calendar=document.createElement('button');calendar.type='button';calendar.className='secondary';calendar.textContent='Voir le repas dans le calendrier';
  calendar.addEventListener('click',()=>{state.calendarWeekStart=mondayOf(first.firstDate);setView('calendar');});row.append(calendar);
  return row;
}
function preparationGroup(label,key,items,openKeys,emptyText,productionDate) {
  const group=document.createElement('details');group.className='preparation-group';group.dataset.key=key;group.open=openKeys.has(key);
  const grouped=groupPreparations(items);
  const summary=document.createElement('summary');summary.textContent=`${label} · ${grouped.length} recette${grouped.length>1?'s':''}`;
  const body=document.createElement('div');body.className='preparation-group-body';
  body.replaceChildren(...(grouped.length?grouped.map(item=>preparationRow(item,productionDate)):[emptyMessage(emptyText)]));
  group.append(summary,body);return group;
}
async function refreshPreparations(start,end) {
  const root=$('#preparations-list'),count=$('#preparations-count');
  const request=++preparationsRequest;
  const openKeys=new Set([...root.querySelectorAll('details[open]')].map(group=>group.dataset.key));
  root.replaceChildren(emptyMessage('Calcul des préparations…'));
  try {
    await refreshProductionTypes();
    const path=(from,to)=>`/api/household-planning/preparations?householdId=${encodeURIComponent(state.household.id)}&startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`;
    const {preparations}=await api(path(start,end));
    if(request!==preparationsRequest)return;
    const weeks=preparationWeeks(start,end);
    const batchWeeks=preparations.some(item=>item.productionType==='batch_cooking')
      ?await Promise.all(weeks.map(async week=>({...week,items:(await api(path(week.start,week.end))).preparations.filter(item=>item.productionType==='batch_cooking')})))
      :weeks.map(week=>({...week,items:[]}));
    if(request!==preparationsRequest)return;
    state.preparations=preparations;
    renderProductionOptions();
    const batchType=productionTypeLabel('batch_cooking');
    const typedGroups=state.productionTypes.filter(type=>type.id!=='batch_cooking').map(type=>({type,items:preparations.filter(item=>item.productionType===type.id)}));
    const tasks=[...typedGroups.flatMap(group=>groupPreparations(group.items)),...batchWeeks.flatMap(week=>groupPreparations(week.items))];
    count.textContent=`${tasks.filter(group=>group.parts.some(item=>item.toMakeQuantity>0.00001)).length} à faire · ${tasks.length} suivies`;
    const batch=document.createElement('details');batch.className='preparation-group';batch.dataset.key='batch';batch.open=openKeys.has('batch');
    const batchSummary=document.createElement('summary');batchSummary.textContent=`${batchType} · ${batchWeeks.length} semaine${batchWeeks.length>1?'s':''}`;
    const batchBody=document.createElement('div');batchBody.className='preparation-group-body';
    batchBody.replaceChildren(...batchWeeks.map((week,index)=>{
      const label=`Semaine ${index+1} · du ${displayDate(week.start)} au ${displayDate(week.end)}`;
      const group=preparationGroup(label,`week-${week.monday}`,week.items,openKeys,'Aucune préparation pour cette semaine.',week.monday);
      const hint=document.createElement('p');hint.className='hint preparation-week-hint';hint.textContent=`Production prévue le lundi ${displayDate(week.monday)}, après les courses de frais.`;
      group.querySelector('.preparation-group-body').prepend(hint);
      group.classList.add('preparation-week');return group;
    }));batch.append(batchSummary,batchBody);
    root.replaceChildren(...typedGroups.map(({type,items})=>preparationGroup(type.label,type.id,items,openKeys,`Aucune production « ${type.label} » sur cette période.`)),batch);
  }catch(error){if(request===preparationsRequest){root.replaceChildren(emptyMessage('Préparations indisponibles : '+(error.body?.error??error.message)));count.textContent='';}}
}
async function refreshShoppingList() {
  const start=$('#shopping-start').value, end=$('#shopping-end').value, root=$('#shopping-list');
  if (!state.household || !start || !end) return;
  void refreshPreparations(start,end);
  const openDetails=new Set([...root.querySelectorAll('.shopping-item-options[open]')].map(detail=>detail.closest('.shopping-item')?.dataset.key));
  root.replaceChildren(emptyMessage('Calcul de la liste…'));
  try {
    const [{items},preferences]=await Promise.all([
      api(`/api/shopping-list?householdId=${encodeURIComponent(state.household.id)}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`),
      api('/api/shopping-preferences?householdId='+encodeURIComponent(state.household.id))]);
    const preferenceActions={startDate:start,endDate:end,
      searchFoods:async query=>(await api('/api/foods?q='+encodeURIComponent(query)+'&limit=30')).foods,
      save:async preference=>{await api('/api/shopping-preferences',{method:'PUT',body:JSON.stringify({householdId:state.household.id,...preference})});
        const y=window.scrollY;await refreshShopping();window.scrollTo(0,y);await refreshDashboard();}};
    const preferencesPanel=shoppingPreferencesPanel(preferences,preferenceActions);
    if(!items.length){root.replaceChildren(preferencesPanel,emptyMessage('Aucun achat nécessaire sur cette période.'));return;}
    const buckets=new Map();
    for(const item of items){const id=item.store?.id??'none';if(!buckets.has(id))buckets.set(id,{store:item.store,items:[]});buckets.get(id).items.push(item);}
    const filter=$('#shopping-store-filter'),previous=filter.value;
    const sorted=[...buckets.entries()].sort((a,b)=>a[1].store&&b[1].store?a[1].store.label.localeCompare(b[1].store.label):a[1].store?-1:1);
    filter.replaceChildren(new Option('Tous les magasins','all'),...sorted.map(([id,bucket])=>new Option(bucket.store?.label??'Sans magasin',id)));
    filter.value=[...buckets.keys(),'all'].includes(previous)?previous:'all';
    const render=()=>{
      root.replaceChildren(preferencesPanel,...sorted.filter(([id])=>filter.value==='all'||filter.value===id).map(([id,bucket])=>{
        const section=document.createElement('section');section.className='shopping-store-card';
        const header=document.createElement('div');header.className='shopping-store-header';
        const heading=document.createElement('button');heading.type='button';heading.className='shopping-store-toggle';
        const remaining=bucket.items.filter(item=>!item.checked).length;
        heading.textContent=`${bucket.store?.label??'Sans magasin'} · ${remaining} produit${remaining>1?'s':''} à acheter`;
        const storeOpen=state.openShoppingStores.has(id);heading.setAttribute('aria-expanded',String(storeOpen));
        const itemsRoot=document.createElement('div');itemsRoot.className='shopping-store-items';itemsRoot.hidden=!storeOpen;
        heading.addEventListener('click',()=>{itemsRoot.hidden=!itemsRoot.hidden;heading.setAttribute('aria-expanded',String(!itemsRoot.hidden));
          if(itemsRoot.hidden)state.openShoppingStores.delete(id);else state.openShoppingStores.add(id);});
        const actions=document.createElement('div');actions.className='shopping-store-actions';
        if(bucket.store?.url){const link=document.createElement('a');link.href=bucket.store.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Site ↗';actions.append(link);}
        const lines=bucket.items.filter(item=>!item.checked).map(item=>`${item.name} — ${item.purchase.text}${item.purchase.detail?` (${item.purchase.detail})`:''}`);
        const copy=document.createElement('button');copy.type='button';copy.className='secondary';copy.textContent='Copier';copy.addEventListener('click',async()=>{
          try{await navigator.clipboard.writeText([bucket.store?.label??'Sans magasin',...lines].join('\n'));showMessage($('#shopping-export-message'),`Liste « ${bucket.store?.label??'Sans magasin'} » copiée.`,true);}
          catch{showMessage($('#shopping-export-message'),'Copie impossible ; utilise le téléchargement.');}
        });actions.append(copy);
        const download=document.createElement('button');download.type='button';download.className='secondary';download.textContent='Télécharger';download.addEventListener('click',()=>{
          const blob=new Blob([[bucket.store?.label??'Sans magasin',...lines].join('\n')],{type:'text/plain;charset=utf-8'});
          const anchor=document.createElement('a');anchor.href=URL.createObjectURL(blob);anchor.download=`courses-${(bucket.store?.label??'sans-magasin').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${start}-${end}.txt`;
          anchor.click();setTimeout(()=>URL.revokeObjectURL(anchor.href),1000);
        });actions.append(download);
        if(bucket.store?.homeAssistantEntityId){const ha=document.createElement('button');ha.type='button';ha.className='secondary';ha.textContent='Envoyer à Home Assistant';ha.addEventListener('click',async()=>{
          ha.disabled=true;
          try{const result=await api('/api/shopping-list/export/home-assistant',{method:'POST',body:JSON.stringify({householdId:state.household.id,storeId:id,startDate:start,endDate:end})});showMessage($('#shopping-export-message'),`${bucket.store.label} : ${result.added} ajouté(s), ${result.removed} retiré(s), ${result.skipped} déjà présent(s).`,true);}
          catch(error){const code=error.body?.error??error.message;showMessage($('#shopping-export-message'),code==='home-assistant-not-configured'?'Home Assistant doit être configuré côté serveur avant l’export.':`Export impossible : ${code}`);}finally{ha.disabled=false;}
        });actions.append(ha);}
        header.append(heading,actions);section.append(header,itemsRoot);
        for(const item of bucket.items){
          const row=document.createElement('div');row.className='shopping-item'+(item.checked?' checked':'');row.dataset.key=`${item.foodId}:${item.unitId}`;
          const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.checked;checkbox.setAttribute('aria-label','Masquer sans ajouter au stock : '+item.name);
          const main=document.createElement('div');main.className='shopping-item-main';
          const title=document.createElement('strong');title.className='shopping-item-title';title.textContent=item.name;
          const qty=document.createElement('span');qty.className='shopping-quantity';qty.textContent=item.purchase.text;
          const detail=document.createElement('small');detail.textContent=item.purchase.detail;
          const existing=state.ingredients.find(entry=>entry.foodId===item.foodId);
          const entry=item.entry??{kind:'native',label:item.unitId,quantity:item.quantity,multiplier:1,unitId:item.unitId,step:'any',gramsPerEntry:null,detail:''};
          const stockCount=entry.gramsPerEntry>0?(existing?.quantityG??0)/entry.gramsPerEntry:null;
          const stock=document.createElement('span');stock.className='shopping-stock-quantity';stock.textContent=stockCount!=null&&entry.label!=='g'?`Stock : ${formatQty(stockCount)} ${entry.label} (${formatQty(existing?.quantityG??0)} g)`:`Stock : ${formatQty(existing?.quantityG??0)} g`;
          const itemHeader=document.createElement('div');itemHeader.className='shopping-item-head';
          const itemToggle=document.createElement('button');itemToggle.type='button';itemToggle.className='shopping-item-toggle';
          detail.className='shopping-item-inline-need';itemToggle.append(title,detail);itemToggle.setAttribute('aria-label',`Détails et besoin pour ${item.name}`);
          const itemOpen=state.openShoppingProducts.has(row.dataset.key);main.hidden=!itemOpen;row.classList.toggle('is-open',itemOpen);
          itemToggle.setAttribute('aria-expanded',String(itemOpen));
          itemToggle.addEventListener('click',()=>{main.hidden=!main.hidden;row.classList.toggle('is-open',!main.hidden);
            itemToggle.setAttribute('aria-expanded',String(!main.hidden));
            if(main.hidden)state.openShoppingProducts.delete(row.dataset.key);else state.openShoppingProducts.add(row.dataset.key);});
          itemHeader.append(checkbox,itemToggle,qty,stock);
          const foodConfig=document.createElement('button');foodConfig.type='button';foodConfig.className='secondary shopping-food-config';foodConfig.textContent='Mesures';
          foodConfig.title='Configurer les équivalences en grammes de cet aliment';foodConfig.setAttribute('aria-label',`Configurer les conversions en grammes de ${item.name}`);
          foodConfig.addEventListener('click',()=>openFoodEditor(item.foodId,{fromShopping:true}));itemHeader.append(foodConfig);
          if(item.recipes?.length){
            const recipeDetails=document.createElement('details');recipeDetails.className='shopping-recipes';
            const recipeSummary=document.createElement('summary');recipeSummary.textContent=`Dans ${item.recipes.length} recette${item.recipes.length===1?'':'s'}`;
            const recipeLinks=document.createElement('div');recipeLinks.className='shopping-recipe-links';
            for(const recipe of item.recipes){
              const link=document.createElement('button');link.type='button';link.className='text-link';link.textContent=recipe.name;
              link.setAttribute('aria-label',`Ouvrir la fiche de recette ${recipe.name}`);
              link.addEventListener('click',()=>showRecipeCard(recipe.id));recipeLinks.append(link);
            }
            recipeDetails.append(recipeSummary,recipeLinks);main.append(recipeDetails);
          }
          if(item.purchaseSources?.some(source=>source.foodId!==item.foodId)){
            const sources=document.createElement('details');sources.append(Object.assign(document.createElement('summary'),{textContent:'Aliments regroupés'}));
            for(const source of item.purchaseSources){const line=document.createElement('p');line.textContent=source.name+' : '+formatQty(source.quantity)+' '+source.unitId;sources.append(line);}main.append(sources);
          }
          const inventoryActions=document.createElement('div');inventoryActions.className='shopping-inventory-actions';
          const countStock=document.createElement('details');countStock.className='shopping-count-stock';
          const countSummary=document.createElement('summary');countSummary.textContent='Saisir le stock déjà présent';countStock.append(countSummary);
          const countForm=document.createElement('form');countForm.className='shopping-receipt-form';
          const countLabel=document.createElement('label');countLabel.textContent=`Quantité totale présente (${entry.label})`;
          const countQuantity=document.createElement('input');countQuantity.type='number';countQuantity.min='0';countQuantity.step='any';countQuantity.required=true;countQuantity.placeholder='Ex. 3';countLabel.append(countQuantity);
          const countButton=document.createElement('button');countButton.type='submit';countButton.className='secondary';countButton.textContent='Enregistrer le stock compté';
          const countHint=document.createElement('small');
          countHint.textContent=`Cette quantité remplace le stock actuel${existing?` (${stockCount!=null?formatQty(stockCount)+' '+entry.label:formatQty(existing.quantityG)+' g'})`:''}. ${entry.detail||'Conversion en grammes selon la fiche aliment.'}`;
          countForm.append(countLabel,countButton);countStock.append(countForm,countHint);
          countForm.addEventListener('submit',async event=>{
            event.preventDefault();if(!countForm.reportValidity()||!state.household)return;countButton.disabled=true;const countedQuantity=Number(countQuantity.value);
            try{const result=await api('/api/household-planning/ingredients/count',{method:'PUT',body:JSON.stringify({householdId:state.household.id,foodId:item.foodId,
              quantity:countedQuantity*entry.multiplier,unitId:entry.unitId,version:existing?.version??0})});
              const y=window.scrollY;await refreshShopping();window.scrollTo(0,y);await refreshDashboard();
              showMessage($('#shopping-export-message'),`${item.name} : stock compté à ${formatQty(countedQuantity)} ${entry.label} (${formatQty(result.quantityG)} g).`,true);
            }catch(error){const code=error.body?.error??error.message;
              showMessage($('#shopping-export-message'),code==='ingredient-conversion-missing'
                ?`Conversion en grammes manquante pour ${item.name}. Complète la fiche de l’aliment.`:code==='ingredient-stock-changed'
                  ?'Le stock a changé depuis l’ouverture de cette liste. Actualise-la avant de ressaisir la quantité.':shoppingPreferenceError(error));countButton.disabled=false;}
          });inventoryActions.append(countStock);
          const receipt=document.createElement('form');receipt.className='shopping-receipt-form';
          const receiptLabel=document.createElement('label');receiptLabel.textContent=`Quantité réellement achetée (${entry.label})`;
          const receiptQuantity=document.createElement('input');receiptQuantity.type='number';receiptQuantity.min=entry.step==='1'?'1':'0.00001';receiptQuantity.step=entry.step;receiptQuantity.required=true;
          receiptQuantity.value=String(entry.quantity);
          receiptLabel.append(receiptQuantity);
          const receiptButton=document.createElement('button');receiptButton.type='submit';receiptButton.className='primary';receiptButton.textContent='Valider l’achat et ajouter au stock';
          const receiptHint=document.createElement('small');receiptHint.textContent=entry.detail;
          receipt.append(receiptLabel,receiptButton,receiptHint);let receiptRequestId=null;
          receipt.addEventListener('submit',async event=>{
            event.preventDefault();if(!receipt.reportValidity()||!state.household)return;
            const enteredQuantity=Number(receiptQuantity.value),quantity=enteredQuantity*entry.multiplier;receiptRequestId??=newProductionRequestId();receiptButton.disabled=true;
            try{
              const result=await api('/api/household-planning/purchases',{method:'POST',body:JSON.stringify({householdId:state.household.id,foodId:item.foodId,quantity,unitId:entry.unitId,requestId:receiptRequestId})});
              receiptRequestId=null;const y=window.scrollY;await refreshShopping();window.scrollTo(0,y);await refreshDashboard();
              showMessage($('#shopping-export-message'),`${item.name} : +${formatQty(enteredQuantity)} ${entry.label} ajoutés au stock (${formatQty(result.quantityG)} g).`,true);
            }catch(error){const code=error.body?.error??error.message;
              showMessage($('#shopping-export-message'),code==='ingredient-conversion-missing'
                ?`Conversion en grammes manquante pour ${item.name}. Complète la fiche de l’aliment avant de valider cet achat.`:shoppingPreferenceError(error));
              receiptButton.disabled=false;
            }
          });inventoryActions.append(receipt);main.append(inventoryActions);
          const options=document.createElement('details');options.className='shopping-item-options';
          options.open=openDetails.has(row.dataset.key);
          const summary=document.createElement('summary');summary.textContent='Détails et réglages';options.append(summary);
          if(item.warning){const warning=document.createElement('p');warning.textContent=item.warning;options.append(warning);}
          const packLabel=document.createElement('label');packLabel.textContent=`Format de paquet existant (${item.unitId}, prioritaire)`;
          const pack=document.createElement('input');pack.type='number';pack.min='0.001';pack.step='any';pack.value=item.packageQuantity??'';pack.placeholder=`Ex. 500 ${item.unitId}`;pack.setAttribute('aria-label',`Format d’achat pour ${item.name}`);packLabel.append(pack);
          const groupLabel=document.createElement('label');groupLabel.textContent='Catégorie';
          const group=document.createElement('select');group.setAttribute('aria-label','Catégorie de '+item.name);
          for(const [key,label] of Object.entries(groupLabels))group.add(new Option(label,key));group.value=item.baseGroupId;
          groupLabel.append(group);
          const storeLabel=document.createElement('label');storeLabel.textContent='Magasin';
          const storeChoice=foodStoreSelect(item.store?.id??'',item.name);storeLabel.append(storeChoice);
          const purchaseForm=document.createElement('form');purchaseForm.className='shopping-purchase-form';
          const purchaseTitle=document.createElement('strong');purchaseTitle.textContent='Unité d’achat personnalisée';
          const purchaseHint=document.createElement('small');purchaseHint.textContent='Ex. 1 sachet couvre 500 g : une recette en cuillères sera convertie grâce au poids par cuillère renseigné dans la fiche aliment. Tu peux aussi définir l’unité habituelle dans Aliments → Modifier. Le besoin reste affiché en détail. Un format de paquet renseigné ici est prioritaire.';
          const rule=item.purchaseRule??item.purchaseRuleSuggestion??{};
          const singularLabel=document.createElement('label');singularLabel.textContent='Une unité achetée';
          const singular=document.createElement('input');singular.name='singularLabel';singular.maxLength=60;singular.required=true;singular.placeholder='Ex. tête d’ail';singular.value=rule.singularLabel??'';singularLabel.append(singular);
          const pluralLabel=document.createElement('label');pluralLabel.textContent='Plusieurs unités achetées';
          const plural=document.createElement('input');plural.name='pluralLabel';plural.maxLength=60;plural.required=true;plural.placeholder='Ex. têtes d’ail';plural.value=rule.pluralLabel??'';pluralLabel.append(plural);
          const coveredLabel=document.createElement('label');coveredLabel.textContent='Quantité couverte par une unité';
          const covered=document.createElement('input');covered.name='coveredQuantity';covered.type='number';covered.min='0.00001';covered.step='any';covered.required=true;covered.placeholder='Ex. 9';covered.value=rule.coveredQuantity??'';coveredLabel.append(covered);
          const unitLabel=document.createElement('label');unitLabel.textContent='Unité de cette quantité';
          const coveredUnit=document.createElement('select');coveredUnit.name='coveredUnitId';
          for(const [value,label] of [['g','g'],['kg','kg'],['ml','ml'],['l','l'],['piece','pièce'],['tsp','cuillère à café'],['tbsp','cuillère à soupe'],['cup','tasse']])coveredUnit.add(new Option(label,value));
          coveredUnit.value=rule.coveredUnitId??item.unitId;unitLabel.append(coveredUnit);
          const noteLabel=document.createElement('label');noteLabel.textContent='Précision facultative';
          const note=document.createElement('input');note.name='estimateNote';note.maxLength=160;note.placeholder='Ex. une racine pèse 50 à 80 g';note.value=rule.estimateNote??'';noteLabel.append(note);
          const purchaseActions=document.createElement('div');purchaseActions.className='shopping-purchase-actions';
          const saveRule=document.createElement('button');saveRule.type='submit';saveRule.className='secondary';saveRule.textContent='Enregistrer l’unité';purchaseActions.append(saveRule);
          if(item.purchaseRule){const removeRule=document.createElement('button');removeRule.type='button';removeRule.className='secondary';removeRule.textContent='Revenir à l’estimation par défaut';removeRule.addEventListener('click',async()=>{
            removeRule.disabled=true;
            try{await api(`/api/household-purchase-units?householdId=${encodeURIComponent(state.household.id)}&foodId=${encodeURIComponent(item.foodId)}`,{method:'DELETE'});const y=window.scrollY;await refreshShoppingList();window.scrollTo(0,y);showMessage($('#shopping-export-message'),'Unité d’achat personnalisée retirée.',true);}
            catch(error){showMessage($('#shopping-export-message'),'Réglage non retiré : '+(error.body?.error??error.message));removeRule.disabled=false;}
          });purchaseActions.append(removeRule);}
          purchaseForm.append(purchaseTitle,purchaseHint,singularLabel,pluralLabel,coveredLabel,unitLabel,noteLabel,purchaseActions);
          purchaseForm.addEventListener('submit',async event=>{
            event.preventDefault();if(!purchaseForm.reportValidity())return;saveRule.disabled=true;
            try{await api('/api/household-purchase-units',{method:'PUT',body:JSON.stringify({householdId:state.household.id,foodId:item.foodId,singularLabel:singular.value,pluralLabel:plural.value,coveredQuantity:Number(covered.value),coveredUnitId:coveredUnit.value,estimateNote:note.value})});const y=window.scrollY;await refreshShoppingList();window.scrollTo(0,y);showMessage($('#shopping-export-message'),`Unité d’achat enregistrée pour ${item.name}.`,true);}
            catch(error){showMessage($('#shopping-export-message'),'Réglage non enregistré : '+(error.body?.error??error.message));saveRule.disabled=false;}
          });
          options.append(shoppingPreferenceControls(item,preferences,preferenceActions),packLabel,purchaseForm,groupLabel,storeLabel);
          const save=async()=>{
            try{await api('/api/shopping-list/state',{method:'POST',body:JSON.stringify({householdId:state.household.id,foodId:item.foodId,unitId:item.unitId,startDate:start,endDate:end,groupId:group.value,checked:checkbox.checked,packageQuantity:pack.value===''?null:Number(pack.value)})});row.classList.toggle('checked',checkbox.checked);return true;}
            catch(error){showMessage($('#shopping-export-message'),'Liste non enregistrée : '+(error.body?.error??error.message));return false;}
          };
          const saveAndRefresh=async()=>{if(await save()){const y=window.scrollY;await refreshShoppingList();window.scrollTo(0,y);}};
          checkbox.addEventListener('change',saveAndRefresh);
          pack.addEventListener('change',saveAndRefresh);
          group.addEventListener('change',saveAndRefresh);
          storeChoice.addEventListener('change',async()=>{
            storeChoice.disabled=true;
            try{await saveFoodStoreSelection([item.foodId],storeChoice.value||null);await refreshFoodStores();await refreshShoppingList();}
            catch(error){showMessage($('#shopping-export-message'),'Magasin non enregistré : '+(error.body?.error??error.message));storeChoice.value=item.store?.id??'';storeChoice.disabled=false;}
          });
          main.append(options);row.append(itemHeader,main);itemsRoot.append(row);
        }
        return section;
      }));
    };
    filter.onchange=render;render();
  } catch(error) { root.replaceChildren(emptyMessage('Liste indisponible : '+(error.body?.error ?? error.message))); }
}
$('#routines-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const routines=$$('#routine-list .routine-row').map(row=>({routineId:row.dataset.routineId,frequency:$('select',row).value,nextDate:$('input',row).value}));
  try{await api('/api/household-planning/routines',{method:'PUT',body:JSON.stringify({householdId:state.household.id,routines})});await refreshShopping();showMessage($('#routines-message'),'Planning enregistré.',true);}
  catch(error){showMessage($('#routines-message'),'Enregistrement impossible : '+(error.body?.error??error.message));}
});
let pendingProduction = null;
$('#production-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=$('button[type="submit"]',form) ?? $('button.primary',form);
  if (button.disabled || !state.household) return;
  const payload={householdId:state.household.id,recipeId:form.elements.recipeId.value,producedOn:form.elements.producedOn.value,quantity:Number(form.elements.quantity.value),storage:form.elements.storage.value,note:form.elements.note.value};
  const fingerprint=JSON.stringify(payload);
  if(pendingProduction?.fingerprint!==fingerprint) pendingProduction={fingerprint,requestId:newProductionRequestId()};
  button.disabled=true;
  try{
    const {lot}=await api('/api/household-planning/production',{method:'POST',body:JSON.stringify({...payload,requestId:pendingProduction.requestId})});
    pendingProduction=null;form.reset();form.elements.producedOn.value=localDateValue();
    const deductions=(lot.deductions??[]).map(item=>`${item.name} : −${formatQty(item.usedG)} g`).join(' · ');
    showMessage($('#production-message'),'Production ajoutée au stock.'+(deductions?' Ingrédients déduits : '+deductions:''),true);
    await refreshShopping();await refreshDashboard();
  } catch(error){
    const body=error.body??{};
    const messages={
      'prepared-component-insufficient':'Prépare d’abord '+body.name+' : '+formatQty(body.requiredQuantity)+' '+body.unitId+' nécessaires, '+formatQty(body.availableQuantity)+' disponibles.',
      'ingredient-stock-insufficient':`Stock insuffisant pour ${body.name} : ${formatQty(body.requiredG)} g nécessaires, ${formatQty(body.availableG)} g disponibles. Vérifie ton inventaire.`,
      'ingredient-conversion-missing':`Conversion en grammes manquante pour ${body.name}. Complète la fiche de l’aliment.`,
      'production-request-conflict':'Cette tentative a déjà été enregistrée avec d’autres valeurs. Actualise les stocks avant de réessayer.',
      'production-request-cancelled':'Ce lot a été annulé. Actualise la page avant de saisir une nouvelle production.',
    };
    showMessage($('#production-message'),messages[body.error]??'Production non enregistrée : '+(body.error??error.message));
  } finally {button.disabled=false;}
});
$('#refresh-shopping').addEventListener('click',refreshShoppingList);
function resetOrderLinkForm(){
  const form=$('#order-link-form');state.editingOrderLinkId=null;form.reset();form.querySelector('button[type="submit"]').textContent='Ajouter le magasin';$('#cancel-order-link-edit').classList.add('hidden');
}
$('#cancel-order-link-edit').addEventListener('click',()=>{resetOrderLinkForm();$('#order-link-message').textContent='';});
$('#order-link-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');button.disabled=true;
  const editing=state.editingOrderLinkId,existing=(state.orderLinks??[]).find(item=>item.id===editing);
  const payload={householdId:state.household.id,label:form.elements.label.value,url:form.elements.url.value,...(editing?{id:editing,homeAssistantEntityId:existing?.homeAssistantEntityId??null}:{})};
  try{await api('/api/household-order-links',{method:'POST',body:JSON.stringify(payload)});resetOrderLinkForm();showMessage($('#order-link-message'),editing?'Magasin modifié.':'Magasin ajouté.',true);await refreshOrderLinks();await refreshFoodStores();await refreshShoppingList();}
  catch(error){showMessage($('#order-link-message'),`${editing?'Modification':'Ajout'} impossible : `+(error.body?.error??error.message));}
  finally{button.disabled=false;}
});
$('#production-form').elements.recipeId.addEventListener('change', event => { const recipe=state.recipes.find(item=>item.id===event.target.value); if(recipe) $('#production-form').elements.quantity.value=recipe.yield.amount; });
$('#extra-production-recipe').addEventListener('change',event=>{
  const recipe=state.recipes.find(item=>item.id===event.target.value);
  if(!recipe)return;
  const select=$('#production-form').elements.recipeId;
  if(![...select.options].some(option=>option.value===recipe.id))select.add(new Option(recipe.name,recipe.id));
  select.value=recipe.id;select.dispatchEvent(new Event('change'));
});


function newProductionRequestId() {
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function renderIngredientStock(items) {
  const root=$('#ingredient-stock-list');
  root.replaceChildren(...(items.length?items.map(item=>{
    const card=document.createElement('article');card.className='stock-row';
    const name=document.createElement('strong');name.textContent=item.name;
    const tag=document.createElement('span');tag.className=item.alert?'warning-tag':'stock-status';
    tag.textContent=item.alert?'À commander':'Stock suivi';
    const detail=document.createElement('p');detail.textContent=`Stock : ${formatQty(item.quantityG)} g · minimum : ${formatQty(item.minimumG)} g · cible : ${formatQty(item.targetG)} g`;
    const forecast=document.createElement('p');forecast.textContent=`Besoins prévus sous ${item.leadDays} jours : ${formatQty(item.neededG)} g · restant estimé : ${formatQty(item.projectedG)} g`;
    if(!item.complete)forecast.textContent+=' · conversion manquante, estimation incomplète';
    if(item.orderG>0){const order=document.createElement('b');order.className='warning-tag';order.textContent=`Commande suggérée : ${formatQty(item.orderG)} g`;forecast.append(' · ',order);}
    const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Corriger l’inventaire / les seuils';
    edit.addEventListener('click',()=>{
      const form=$('#ingredient-stock-form');form.elements.foodId.replaceChildren(new Option(item.name,item.foodId,true,true));
      $('#ingredient-search').value=item.name;
      for(const field of ['quantityG','minimumG','targetG','leadDays'])form.elements[field].value=item[field];
      form.dataset.version=String(item.version);showMessage($('#ingredient-message'),'');form.scrollIntoView({behavior:'smooth',block:'center'});
    });
    card.append(name,' · ',tag,detail,forecast,edit);
    if(item.movements?.length){const history=document.createElement('details');history.className='stock-movement-history';
      const summary=document.createElement('summary');summary.textContent='Derniers mouvements';history.append(summary);
      const reasons={inventory:'Inventaire corrigé',purchase:'Achat validé',production:'Production enregistrée',
        'production-cancelled':'Production annulée','meal-preparation':'Repas préparé','meal-preparation-cancelled':'Préparation annulée'};
      for(const movement of item.movements){const line=document.createElement('p');
        const source=movement.sourceQuantity!=null?` · ${formatQty(movement.sourceQuantity)} ${movement.sourceUnitId}`:'';
        line.textContent=`${reasons[movement.reason]??movement.reason} : ${movement.deltaG>=0?'+':''}${formatQty(movement.deltaG)} g${source}`;
        history.append(line);
      }card.append(history);
    }return card;
  }):[emptyMessage('Ajoute les produits déjà présents, ou valide un achat depuis la liste de courses.')]));
}
let ingredientSearchSequence=0;
$('#ingredient-search').addEventListener('input',async event=>{
  const query=event.currentTarget.value.trim(),sequence=++ingredientSearchSequence;
  const select=$('#ingredient-stock-form').elements.foodId;
  select.replaceChildren(new Option('Rechercher puis choisir un aliment…',''));
  $('#ingredient-stock-form').dataset.version='0';
  if(query.length<2)return;
  try{
    const {foods}=await api('/api/foods?q='+encodeURIComponent(query)+'&limit=30');
    if(sequence!==ingredientSearchSequence)return;
    select.replaceChildren(new Option(foods.length?'Choisir un aliment…':'Aucun aliment trouvé',''),...foods.map(food=>new Option(food.name,food.id)));
  }catch{if(sequence===ingredientSearchSequence)showMessage($('#ingredient-message'),'Recherche indisponible.');}
});
$('#ingredient-stock-form').elements.foodId.addEventListener('change',event=>{
  const form=$('#ingredient-stock-form'),item=state.ingredients.find(row=>row.foodId===event.currentTarget.value);
  form.dataset.version=String(item?.version??0);
  for(const field of ['quantityG','minimumG','targetG','leadDays'])form.elements[field].value=item?.[field]??(field==='quantityG'?'':0);
});
$('#cancel-ingredient-edit').addEventListener('click',()=>{
  const form=$('#ingredient-stock-form');form.reset();form.dataset.version='0';ingredientSearchSequence++;
  form.elements.foodId.replaceChildren(new Option('Rechercher puis choisir un aliment…',''));showMessage($('#ingredient-message'),'');
});
$('#ingredient-stock-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;
  if(!state.household)return;
  const button=$('button[type="submit"]',form);if(button.disabled)return;
  const payload={householdId:state.household.id,foodId:form.elements.foodId.value,version:Number(form.dataset.version??0)};
  for(const field of ['quantityG','minimumG','targetG','leadDays'])payload[field]=Number(form.elements[field].value);
  if(payload.targetG<payload.minimumG){showMessage($('#ingredient-message'),'Le stock cible doit être au moins égal au minimum.');return;}
  button.disabled=true;
  try{
    await api('/api/household-planning/ingredients',{method:'PUT',body:JSON.stringify(payload)});
    await refreshShopping();
    const updated=state.ingredients.find(item=>item.foodId===payload.foodId);
    form.dataset.version=String(updated?.version??payload.version+1);
    showMessage($('#ingredient-message'),'Stock enregistré. La liste de courses a été recalculée.',true);await refreshDashboard();
  }catch(error){showMessage($('#ingredient-message'),error.body?.error==='ingredient-stock-changed'?'Le stock a changé depuis son ouverture. Réouvre son inventaire pour conserver les déductions récentes.':shoppingPreferenceError(error));}
  finally{button.disabled=false;}
});

function localDateValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

async function refreshPeople() {
  const list = $('#people-list');
  if (!state.household) { list.replaceChildren(emptyMessage('Crée d’abord un foyer.')); return; }
  list.replaceChildren(emptyMessage('Chargement des profils…'));
  try {
    const { people } = await api(`/api/people?householdId=${encodeURIComponent(state.household.id)}`);
    state.people = people;
    list.replaceChildren(...(people.length ? people.map(profileCard) : [emptyMessage('Aucun profil pour le moment. Ajoute les personnes à planifier.')]));
  } catch (error) {
    list.replaceChildren(emptyMessage(`Profils indisponibles : ${error.body?.error ?? error.message}`));
  }
}

function profileCard(person) {
  const card = document.createElement('details'); card.className = 'profile-card';
  const heading = document.createElement('summary'); heading.className = 'profile-card-heading';
  const title = document.createElement('h3'); title.textContent = person.displayName;
  const current=person.profileHistory.find(entry=>entry.effectiveFrom<=localDateValue());
  const overview=document.createElement('span');overview.className='muted';
  overview.textContent=[current?.dailyEnergyKcal ? `${format(current.dailyEnergyKcal)} kcal/j` : 'Besoin à renseigner',current?.heightCm ? `${format(current.heightCm)} cm` : null,person.weightHistory[0]?.weightKg ? `${format(person.weightHistory[0].weightKg)} kg` : null].filter(Boolean).join(' · ');
  heading.append(title,overview);card.append(heading);
  const birth = document.createElement('p'); birth.className = 'muted'; birth.textContent = person.birthDate ? `Né(e) le ${displayDate(person.birthDate.slice(0,10))}` : 'Date de naissance non renseignée';card.append(birth);
  const forms = document.createElement('div'); forms.className = 'profile-forms';
  const weightForm = document.createElement('form'); weightForm.className = 'profile-entry';
  weightForm.innerHTML = '<h4>Relevé de poids</h4><label>Date<input name="measuredOn" type="date" required></label><label>Poids (kg)<input name="weightKg" type="number" min="0.1" max="500" step="0.1" required></label><button class="secondary" type="submit">Enregistrer le relevé</button>';
  weightForm.elements.measuredOn.value = localDateValue();
  weightForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(weightForm));
    try {
      await api(`/api/people/${person.id}/weights`, { method: 'POST', body: JSON.stringify({ householdId: state.household.id, ...data }) });
      showMessage($('#people-message'), 'Relevé ajouté à l’historique.', true); await refreshPeople();
    } catch (error) { showMessage($('#people-message'), error.body?.error === 'weight-entry-already-exists-for-date' ? 'Un relevé existe déjà pour cette date.' : 'Impossible d’enregistrer ce relevé.'); }
  });
  const profileForm = document.createElement('form'); profileForm.className = 'profile-entry profile-context';
  profileForm.innerHTML = '<h4>Profil à partir d’une date</h4><label>Valable à partir du<input name="effectiveFrom" type="date" required></label><label>Taille (cm)<input name="heightCm" type="number" min="50" max="260" step="0.1" placeholder="Facultatif"></label><label>Activité<select name="activityLevel"><option value="">Non renseignée</option><option value="sedentary">Sédentaire</option><option value="light">Légère</option><option value="moderate">Modérée</option><option value="active">Importante</option><option value="very_active">Très importante</option></select></label><label>Besoin quotidien (kcal)<input name="dailyEnergyKcal" type="number" min="500" max="10000" step="1" placeholder="Facultatif"></label><label>Origine du besoin<select name="dailyEnergyOrigin"><option value="">—</option><option value="manual">Saisi par le foyer</option><option value="clinician">Validé par un professionnel</option><option value="estimate">Estimation documentée</option></select></label><label>Méthode ou note<input name="dailyEnergyMethod" maxlength="500" placeholder="Facultatif"></label><button class="secondary" type="submit">Enregistrer le profil</button>';
  profileForm.elements.effectiveFrom.value = localDateValue();
  const latestProfile = person.profileHistory[0];
  if (latestProfile) {
    profileForm.elements.heightCm.value = latestProfile.heightCm ?? '';
    profileForm.elements.activityLevel.value = latestProfile.activityLevel ?? '';
    profileForm.elements.dailyEnergyKcal.value = latestProfile.dailyEnergyKcal ?? '';
    profileForm.elements.dailyEnergyOrigin.value = latestProfile.dailyEnergyOrigin ?? '';
    profileForm.elements.dailyEnergyMethod.value = latestProfile.dailyEnergyMethod ?? '';
  }
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(profileForm));
    try {
      await api(`/api/people/${person.id}/profile-history`, { method: 'POST', body: JSON.stringify({ householdId: state.household.id, ...data }) });
      showMessage($('#people-message'), 'Profil enregistré pour cette date.', true); await refreshPeople();
    } catch (error) { showMessage($('#people-message'), error.body?.error === 'person-not-found' ? 'Ce profil n’existe plus.' : `Impossible d’enregistrer ce profil : ${error.body?.error ?? error.message}`); }
  });
  forms.append(weightForm, profileForm); card.append(forms);
  const histories = document.createElement('div'); histories.className = 'profile-histories';
  const weights = document.createElement('section'); const weightTitle = document.createElement('h4'); weightTitle.textContent = 'Historique du poids'; weights.append(weightTitle);
  if (!person.weightHistory.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'Aucun relevé saisi.'; weights.append(empty); }
  else {
    const list = document.createElement('ul');
    for (const item of person.weightHistory.slice(0, 12)) { const row = document.createElement('li'); row.textContent = `${item.measuredOn} · ${format(item.weightKg)} kg`; list.append(row); }
    weights.append(list);
  }
  const history = document.createElement('section'); const historyTitle = document.createElement('h4'); historyTitle.textContent = 'Historique du profil'; history.append(historyTitle);
  if (!person.profileHistory.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'Taille, activité et besoin quotidien encore non renseignés.'; history.append(empty); }
  else {
    const list = document.createElement('ul');
    for (const item of person.profileHistory.slice(0, 12)) {
      const details = [item.heightCm == null ? null : `${format(item.heightCm)} cm`, item.activityLevel, item.dailyEnergyKcal == null ? null : `${format(item.dailyEnergyKcal)} kcal/j (${item.dailyEnergyOrigin})`, item.dailyEnergyMethod].filter(Boolean).join(' · ');
      const row = document.createElement('li'); row.textContent = `${item.effectiveFrom} · ${details || 'Aucune donnée saisie'}`; list.append(row);
    }
    history.append(list);
  }
  histories.append(weights, history); card.append(histories); return card;
}

let foodsRequest=0,currentFoodPageIds=[],bulkDeleteIds=[],bulkDeleteDeletableIds=[],bulkDeleteProtectedCount=0;
function updateFoodSelectionUi(){
  const count=state.selectedFoodIds.size,pageIds=currentFoodPageIds.map(id=>id.toLowerCase()),selectedOnPage=pageIds.filter(id=>state.selectedFoodIds.has(id)).length;
  $('#food-selection-count').textContent=count?`${count.toLocaleString('fr-FR')} aliment${count===1?'':'s'} sélectionné${count===1?'':'s'}`:'Aucun aliment sélectionné';
  $('#clear-food-selection').disabled=!count;$('#bulk-delete-foods').disabled=!count;
  const page=$('#select-food-page');page.checked=pageIds.length>0&&selectedOnPage===pageIds.length;page.indeterminate=selectedOnPage>0&&selectedOnPage<pageIds.length;
}
async function refreshFoods() {
  const request=++foodsRequest;
  const params = new URLSearchParams({ limit: String(state.limit), offset: String(state.offset) });
  if (state.query) params.set('q', state.query);
  if (state.onlyIncomplete) params.set('incomplete', 'true');
  $('#food-rows').innerHTML = '<tr><td colspan="6" class="empty">Chargement…</td></tr>';
  try {
    const { foods, total } = await api(`/api/foods?${params}`);
    if(request!==foodsRequest)return;
    const validOffset=clampFoodPageOffset(total,state.limit,state.offset);
    if(validOffset!==state.offset){state.offset=validOffset;return refreshFoods();}
    state.total = total;
    $('#food-count').textContent = `${total.toLocaleString('fr-FR')} aliment${total > 1 ? 's' : ''}`;
    const pageLabel=total?`${state.offset+1}–${Math.min(state.offset+foods.length,total)} sur ${total}`:'Aucun résultat';
    for(const selector of ['#page-label','#page-label-top'])$(selector).textContent=pageLabel;
    for(const selector of ['#previous-page','#previous-page-top'])$(selector).disabled=state.offset===0;
    for(const selector of ['#next-page','#next-page-top'])$(selector).disabled=state.offset+state.limit>=total;
    if (!foods.length) {
      currentFoodPageIds=[];$('#food-rows').innerHTML = '<tr><td colspan="6" class="empty">Aucun aliment trouvé.</td></tr>';updateFoodSelectionUi();
      return;
    }
    let usage=null;
    if(state.household){
      try {
        const result=await api(`/api/foods/recipe-usage?${new URLSearchParams({householdId:state.household.id,foodIds:foods.map(food=>food.id).join(',')})}`);
        usage=new Map(result.usage.map(entry=>[entry.foodId,entry.recipes]));
      } catch { /* Keep the catalogue usable without presenting an error as zero references. */ }
    }
    if(request!==foodsRequest)return;
    currentFoodPageIds=foods.map(food=>food.id);$('#food-rows').replaceChildren(...foods.map(food=>foodRow(food,usage?.get(food.id) ?? null)));updateFoodSelectionUi();
  } catch {
    if(request!==foodsRequest)return;
    currentFoodPageIds=[];$('#food-rows').innerHTML = '<tr><td colspan="6" class="empty">Catalogue indisponible. Vérifie la connexion à la base.</td></tr>';updateFoodSelectionUi();
  }
}

function foodRow(food, recipes = null) {
  const row = document.createElement('tr');
  const selectCell=document.createElement('td');selectCell.className='food-select-cell';
  const select=document.createElement('input');select.type='checkbox';select.checked=state.selectedFoodIds.has(food.id.toLowerCase());select.setAttribute('aria-label',`Sélectionner ${food.name}`);
  select.addEventListener('change',()=>{const id=food.id.toLowerCase();if(select.checked)state.selectedFoodIds.add(id);else state.selectedFoodIds.delete(id);updateFoodSelectionUi();});selectCell.append(select);
  const name = document.createElement('td');
  name.className='food-name-cell';
  const strong = document.createElement('strong'); strong.textContent = food.name;
  strong.title=food.name;
  const small = document.createElement('small'); small.textContent = food.brand ?? '';
  const requiredValues = ['energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fibre_g'];
  const hasMissingNutrition = requiredValues.some((key) => food.nutrients_per_100g?.[key] == null);
  if (hasMissingNutrition) small.textContent += `${small.textContent ? ' · ' : ''}À compléter`;
  name.append(strong);if(small.textContent)name.append(small);
  const recipeUsage=document.createElement('td');recipeUsage.className='food-recipe-usage-cell';
  if(recipes){
    const usage=document.createElement('details');usage.className='food-recipe-usage';
    const summary=document.createElement('summary');summary.textContent=`Dans ${recipes.length} recette${recipes.length>1?'s':''}`;
    const links=document.createElement('div');links.className='food-recipe-links';
    for(const recipe of recipes){
      const link=document.createElement('button');link.type='button';link.className='text-button';link.textContent=recipe.name;
      link.addEventListener('click',()=>showRecipeCard(recipe.id,recipe.name));links.append(link);
    }
    if(!recipes.length){const empty=document.createElement('small');empty.textContent='Cet aliment n’apparaît dans aucune recette du foyer.';links.append(empty);}
    usage.append(summary,links);recipeUsage.append(usage);
  } else {
    const status=document.createElement('small');status.textContent=state.household?'Indisponible':'Foyer requis';recipeUsage.append(status);
  }
  const source = document.createElement('td'); source.textContent = food.source === 'ciqual' ? 'Ciqual' : food.source === 'manual' ? 'Saisie manuelle' : food.source;source.title=food.source==='ciqual'?`Ciqual ${food.source_reference??''}`:source.textContent;
  const values = document.createElement('td'); values.className = 'food-nutrients';
  values.textContent = nutrientLabels.map(([key, unit]) => `${format(food.nutrients_per_100g?.[key === 'energyKcal' ? 'energy_kcal' : key === 'proteinG' ? 'protein_g' : key === 'carbohydrateG' ? 'carbohydrate_g' : 'fat_g'])} ${unit}`).join(' · ');
  const action = document.createElement('td');
  const actionButtons=document.createElement('div');actionButtons.className='food-actions';
  const duplicate = document.createElement('button'); duplicate.type = 'button'; duplicate.className = 'secondary'; duplicate.textContent = 'Dupliquer';
  duplicate.setAttribute('aria-label', `Dupliquer ${food.name}`);
  duplicate.addEventListener('click', () => openFoodEditor(food.id, { duplicate: true })); actionButtons.append(duplicate);
  const button = document.createElement('button'); button.className = 'secondary'; button.textContent = 'Modifier'; button.addEventListener('click', () => openFoodEditor(food.id)); actionButtons.append(button);
  if (hasMissingNutrition) {
    const complete = document.createElement('button'); complete.className = 'primary'; complete.textContent = 'Compléter';
    complete.setAttribute('aria-label', `Rechercher des valeurs nutritionnelles manquantes pour ${food.name}`);
    complete.addEventListener('click', () => openFoodEditor(food.id, { searchExternal: true })); actionButtons.append(complete);
  }
  const remove = document.createElement('button'); remove.type='button'; remove.className='secondary danger-button'; remove.textContent='Supprimer';
  remove.setAttribute('aria-label',`Supprimer ${food.name}`);
  remove.addEventListener('click',async()=>{
    if(!confirm(`Supprimer « ${food.name} » du catalogue ? Cette action est définitive. Une fiche utilisée dans une recette ou un stock ne pourra pas être supprimée.`))return;
    remove.disabled=true;
    try{await api(`/api/foods/${food.id}`,{method:'DELETE'});showMessage($('#food-list-message'),`« ${food.name} » a été supprimé du catalogue.`,true);await refreshFoods();}
    catch(error){const body=error.body??{};const refs=[...(body.recipes??[])];const details=refs.length?` Recettes concernées : ${refs.join(', ')}.`:'';const stocks=body.stockCount?` Fiche suivie dans ${body.stockCount} stock(s).`:'';showMessage($('#food-list-message'),body.error==='food-in-use'?`Suppression impossible : cet aliment est encore utilisé.${details}${stocks}`:`Suppression impossible : ${body.error??error.message}`);remove.disabled=false;}
  });actionButtons.append(remove);action.append(actionButtons);
  row.append(selectCell,name,recipeUsage,source,values,action); return row;
}

$('#select-food-page').addEventListener('change',event=>{
  for(const id of currentFoodPageIds){const key=id.toLowerCase();if(event.target.checked)state.selectedFoodIds.add(key);else state.selectedFoodIds.delete(key);}
  refreshFoods();
});
$('#select-food-results').addEventListener('click',async event=>{
  const button=event.currentTarget,query=state.query,onlyIncomplete=state.onlyIncomplete,total=state.total;
  if(!total)return;button.disabled=true;const original=button.textContent;let ids=[];
  try{
    for(let offset=0;offset<total;offset+=100){
      if(state.query!==query||state.onlyIncomplete!==onlyIncomplete)throw new Error('Le filtre a changé pendant la sélection. Recommence avec les résultats affichés.');
      const params=new URLSearchParams({limit:'100',offset:String(offset)});if(query)params.set('q',query);if(onlyIncomplete)params.set('incomplete','true');
      const page=await api(`/api/foods?${params}`);ids.push(...page.foods.map(food=>food.id.toLowerCase()));button.textContent=`Sélection… ${Math.min(offset+100,total).toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')}`;
    }
    for(const id of ids)state.selectedFoodIds.add(id);
    updateFoodSelectionUi();showMessage($('#food-list-message'),`${ids.length.toLocaleString('fr-FR')} aliment${ids.length===1?'':'s'} correspondant${ids.length===1?'':'s'} au filtre ajouté${ids.length===1?'':'s'} à la sélection.`,true);
  }catch(error){showMessage($('#food-list-message'),error.body?.error??error.message);}
  finally{button.textContent=original;button.disabled=false;}
});
$('#clear-food-selection').addEventListener('click',()=>{state.selectedFoodIds.clear();refreshFoods();});

function renderBulkDeletePreview(result){
  const root=$('#bulk-food-delete-preview');root.replaceChildren();bulkDeleteDeletableIds=result.deletable.map(food=>food.id);bulkDeleteProtectedCount=result.dueToUsage.length;
  const summary=document.createElement('p');summary.textContent=`${bulkDeleteIds.length.toLocaleString('fr-FR')} sélectionné${bulkDeleteIds.length===1?'':'s'} · ${result.deletable.length.toLocaleString('fr-FR')} supprimable${result.deletable.length===1?'':'s'} · ${result.dueToUsage.length.toLocaleString('fr-FR')} protégé${result.dueToUsage.length===1?'':'s'}${result.missingCount?` · ${result.missingCount} déjà absent${result.missingCount===1?'':'s'}`:''}.`;root.append(summary);
  if(result.deletable.length){const heading=document.createElement('h3');heading.textContent='Aliments qui seront supprimés';root.append(heading);const list=document.createElement('ul');for(const food of result.deletable.slice(0,30)){const item=document.createElement('li');item.textContent=food.name;list.append(item);}if(result.deletable.length>30){const item=document.createElement('li');item.textContent=`… et ${result.deletable.length-30} autres`;list.append(item);}root.append(list);}
  if(result.dueToUsage.length){const heading=document.createElement('h3');heading.textContent='Aliments conservés car encore utilisés';root.append(heading);const list=document.createElement('ul');list.className='bulk-blocked-list';for(const food of result.dueToUsage.slice(0,30)){const reasons=[];if(food.recipes.length)reasons.push(`recette${food.recipes.length>1?'s':''} : ${food.recipes.slice(0,3).join(', ')}`);if(food.stockCount)reasons.push(`${food.stockCount} stock(s)`);if(food.purchaseRuleCount)reasons.push(`${food.purchaseRuleCount} regroupement(s) d’achat`);if(food.yieldConversionCount)reasons.push(`${food.yieldConversionCount} conversion(s) alimentaire(s)`);const item=document.createElement('li');item.textContent=`${food.name} — ${reasons.join(' · ')}`;list.append(item);}if(result.dueToUsage.length>30){const item=document.createElement('li');item.textContent=`… et ${result.dueToUsage.length-30} autres`;list.append(item);}root.append(list);}
  const confirm=$('#confirm-bulk-food-delete');confirm.textContent=`Supprimer ${result.deletable.length.toLocaleString('fr-FR')} aliment${result.deletable.length===1?'':'s'} inutilisé${result.deletable.length===1?'':'s'}`;confirm.disabled=result.deletable.length===0;
}
$('#bulk-delete-foods').addEventListener('click',async()=>{
  bulkDeleteIds=[...state.selectedFoodIds];bulkDeleteDeletableIds=[];$('#bulk-food-delete-preview').replaceChildren(emptyMessage('Vérification des aliments sélectionnés…'));$('#bulk-food-delete-message').textContent='';$('#confirm-bulk-food-delete').disabled=true;$('#bulk-food-delete-dialog').showModal();
  try{const result=await api('/api/foods/bulk-delete',{method:'POST',body:JSON.stringify({foodIds:bulkDeleteIds,dryRun:true})});renderBulkDeletePreview(result);}
  catch(error){$('#bulk-food-delete-preview').replaceChildren(emptyMessage(`Aperçu indisponible : ${error.body?.error??error.message}`));}
});
const closeBulkFoodDialog=()=>$('#bulk-food-delete-dialog').close();
$('#close-bulk-food-delete').addEventListener('click',closeBulkFoodDialog);$('#cancel-bulk-food-delete').addEventListener('click',closeBulkFoodDialog);
$('#confirm-bulk-food-delete').addEventListener('click',async event=>{
  const button=event.currentTarget;if(!bulkDeleteDeletableIds.length)return;button.disabled=true;button.textContent='Suppression…';
  try{
    const result=await api('/api/foods/bulk-delete',{method:'POST',body:JSON.stringify({foodIds:bulkDeleteDeletableIds})});
    for(const id of bulkDeleteIds)state.selectedFoodIds.delete(id.toLowerCase());
    closeBulkFoodDialog();await refreshFoods();updateFoodSelectionUi();
    const retained=bulkDeleteProtectedCount+result.dueToUsage.length;showMessage($('#food-list-message'),`${result.deleted.length.toLocaleString('fr-FR')} aliment${result.deleted.length===1?'':'s'} supprimé${result.deleted.length===1?'':'s'}${retained?` · ${retained} conservé${retained===1?'':'s'} car encore utilisé${retained===1?'':'s'}`:''}.`,true);
  }catch(error){$('#bulk-food-delete-message').textContent=`Suppression impossible : ${error.body?.error??error.message}`;button.disabled=false;button.textContent='Réessayer la suppression';}
});

function format(value) { return value == null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Number(value)); }

async function openFoodEditor(id = null, { searchExternal = false, fromRecipe = false, fromShopping = false, duplicate = false } = {}) {
  state.editingFoodFromRecipe = fromRecipe;
  state.editingFoodFromShopping = fromShopping;
  const form = $('#food-form'); form.reset(); form.elements.id.value = '';
  form.dataset.purchaseUnitReady = String(Boolean(state.household));
  form.dataset.purchaseUnitExists = 'false';
  const purchaseSettings = $('#food-purchase-unit-settings');
  purchaseSettings.classList.toggle('hidden', !state.household);
  purchaseSettings.disabled = !state.household;
  $('#food-purchase-unit-status').textContent = state.household ? 'Réglage propre au foyer ; les unités des recettes restent inchangées.' : 'Crée un foyer pour définir une unité d’achat.';
  delete form.dataset.duplicateSource;
  delete form.dataset.duplicateSourceNote;
  delete form.dataset.duplicateNutrientSourceNote;
  $('#food-message').textContent = '';
  $('#food-dialog-title').textContent = duplicate ? 'Dupliquer cet aliment' : id ? 'Modifier cet aliment' : 'Nouvel aliment';
  if (id) {
    try {
      const { food } = await api(`/api/foods/${id}`);
      form.elements.id.value = duplicate ? '' : food.id;
      form.elements.name.value = duplicate ? `${food.name} (copie)` : food.name;
      form.elements.brand.value = food.brand ?? '';
      form.elements.aliases.value = duplicate ? '' : (food.aliases ?? []).filter((alias) => alias !== food.name).join(', ');
      for (const key of ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fibreG']) form.elements[key].value = food.nutrientsPer100g?.[key] ?? '';
      form.elements.gramsPerMillilitre.value = food.gramsPerMillilitre ?? '';
      form.elements.tspGrams.value = food.gramsPerUnit?.tsp ?? '';
      form.elements.tbspGrams.value = food.gramsPerUnit?.tbsp ?? '';
      form.elements.pinchGrams.value = food.gramsPerUnit?.pinch ?? '';
      form.elements.scoopGrams.value = food.gramsPerUnit?.scoop ?? '';
      form.elements.pieceGrams.value = food.gramsPerUnit?.piece ?? '';
      $('#nutrition-completion').classList.remove('hidden');
      $('#nutrition-matches').replaceChildren();
      $('#nutrition-matches').dataset.foodId = food.id;
      if (duplicate) {
        const reference = food.source_reference ? `, référence ${food.source_reference}` : '';
        const provenance = `${food.source ?? 'source inconnue'}${reference}`;
        form.dataset.duplicateSource = food.name;
        form.dataset.duplicateSourceNote = `Fiche créée par duplication de « ${food.name} » (${provenance}). Vérifier les valeurs pour cette variante.`;
        form.dataset.duplicateNutrientSourceNote = `Valeurs copiées de « ${food.name} » (${provenance}) ; à vérifier pour cette variante.`;
        showMessage($('#food-message'), 'Les valeurs nutritionnelles et conversions sont préremplies. Modifie le nom, puis vérifie les données propres à cette variante.', true);
      }
    } catch { showMessage($('#food-message'), 'Impossible de charger cette fiche.'); return; }
  } else {
    $('#nutrition-completion').classList.add('hidden');
    $('#nutrition-matches').replaceChildren();
  }
  if (state.household && id && !duplicate) {
    try {
      const { units } = await api(`/api/household-purchase-units?householdId=${encodeURIComponent(state.household.id)}`);
      const rule = units.find(item => item.foodId === id);
      if (rule) {
        form.dataset.purchaseUnitExists = 'true';
        form.elements.purchaseSingularLabel.value = rule.singularLabel;
        form.elements.purchasePluralLabel.value = rule.pluralLabel;
        form.elements.purchaseCoveredQuantity.value = rule.coveredQuantity;
        form.elements.purchaseCoveredUnitId.value = rule.coveredUnitId;
        form.elements.purchaseEstimateNote.value = rule.estimateNote ?? '';
        $('#food-purchase-unit-status').textContent = `Actuel : ${rule.singularLabel} · 1 unité couvre ${format(rule.coveredQuantity)} ${rule.coveredUnitId}.`;
      }
    } catch {
      form.dataset.purchaseUnitReady = 'false';
      purchaseSettings.disabled = true;
      $('#food-purchase-unit-status').textContent = 'Réglage d’achat indisponible. Les autres champs de la fiche restent modifiables.';
    }
  }
  $('#food-dialog').showModal();
  if (id && searchExternal) $('#find-external-nutrition').click();
}

$('#food-search').addEventListener('input', (event) => {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(() => { state.query = event.target.value.trim(); state.offset = 0; refreshFoods(); }, 180);
});
$('#food-incomplete').addEventListener('change', (event) => { state.onlyIncomplete = event.target.checked; state.offset = 0; refreshFoods(); });
function moveFoodPage(direction){state.offset=Math.max(0,state.offset+direction*state.limit);refreshFoods();}
for(const selector of ['#previous-page','#previous-page-top'])$(selector).addEventListener('click',()=>moveFoodPage(-1));
for(const selector of ['#next-page','#next-page-top'])$(selector).addEventListener('click',()=>moveFoodPage(1));
$('#food-page-size').addEventListener('change',event=>{state.limit=Math.min(250,Math.max(1,Number(event.target.value)||50));state.offset=0;refreshFoods();});
$('#add-food').addEventListener('click', () => openFoodEditor());
$('#find-external-nutrition').addEventListener('click', async () => {
  const matches = $('#nutrition-matches');
  const foodId = matches.dataset.foodId;
  matches.textContent = 'Recherche dans Open Food Facts…';
  try {
    const { products } = await api(`/api/foods/${foodId}/nutrition-suggestions`);
    matches.replaceChildren();
    if (!products.length) { matches.textContent = 'Aucun produit avec des valeurs nutritionnelles trouvé dans Open Food Facts.'; return; }
    for (const candidate of products) matches.append(externalNutritionCandidate(candidate, foodId));
  } catch (error) { matches.textContent = `Recherche externe impossible : ${error.body?.error ?? error.message}`; }
});

function externalNutritionCandidate(candidate, targetFoodId) {
  const card = document.createElement('article'); card.className = 'nutrition-candidate';
  const title = document.createElement('strong'); title.textContent = candidate.name;
  const reference = document.createElement('small'); reference.textContent = ['Open Food Facts', candidate.brand, candidate.quantity, `code-barres ${candidate.barcode}`].filter(Boolean).join(' · ');
  const sourceLink = document.createElement('a'); sourceLink.href = candidate.url; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer'; sourceLink.textContent = 'Voir la fiche source';
  const values = document.createElement('p');
  const nutrientKeys = [['energyKcal', 'kcal'], ['proteinG', 'g protéines'], ['carbohydrateG', 'g glucides'], ['fatG', 'g lipides'], ['fibreG', 'g fibres']];
  values.textContent = nutrientKeys.map(([key, unit]) => `${format(candidate.nutrientsPer100g?.[key])} ${unit}`).join(' · ');
  const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'secondary'; apply.textContent = 'Appliquer les valeurs manquantes';
  apply.addEventListener('click', async () => {
    apply.disabled = true;
    try {
      const result = await api(`/api/foods/${targetFoodId}/complete-nutrition`, { method: 'POST', body: JSON.stringify({ source: 'open-food-facts', sourceReference: candidate.barcode }) });
      for (const key of ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fibreG']) {
        if ($('#food-form').elements[key].value === '' && result.food.nutrientsPer100g[key] != null) $('#food-form').elements[key].value = result.food.nutrientsPer100g[key];
      }
      const labels = { energy_kcal: 'énergie', protein_g: 'protéines', carbohydrate_g: 'glucides', fat_g: 'lipides', fibre_g: 'fibres' };
      showMessage($('#food-message'), result.filledNutrients.length
        ? `Valeurs ajoutées : ${result.filledNutrients.map((key) => labels[key] ?? key).join(', ')}. Enregistre la fiche pour valider les autres modifications.`
        : 'Aucune valeur manquante disponible dans cette correspondance.', true);
      await refreshFoods();
    } catch (error) {
      showMessage($('#food-message'), `Complétion impossible : ${error.body?.error ?? error.message}`);
      apply.disabled = false;
    }
  });
  card.append(title, reference, sourceLink, values, apply); return card;
}

$$('.nav-button').forEach((button) => button.addEventListener('click', () => {
  setView(button.dataset.view);
  const menu=button.closest('.mobile-nav details');if(menu)menu.open=false;
}));

$('#food-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const numeric = (name) => form.elements[name].value === '' ? null : Number(form.elements[name].value);
  const purchaseFields = ['purchaseSingularLabel', 'purchasePluralLabel', 'purchaseCoveredQuantity'];
  const hasPurchaseUnit = purchaseFields.some(name => form.elements[name].value.trim() !== '');
  if (form.dataset.purchaseUnitReady === 'true' && hasPurchaseUnit && purchaseFields.some(name => !form.elements[name].value.trim())) {
    $('#food-purchase-unit-status').textContent = 'Renseigne le nom au singulier, le pluriel et la quantité couverte, ou vide ces trois champs pour retirer le réglage.';
    return;
  }
  const payload = {
    name: form.elements.name.value,
    brand: form.elements.brand.value || null,
    aliases: form.elements.aliases.value.split(',').map((value) => value.trim()).filter(Boolean),
    nutrientsPer100g: Object.fromEntries(['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fibreG'].map((key) => [key, numeric(key)])),
    gramsPerMillilitre: numeric('gramsPerMillilitre'),
    gramsPerUnit: Object.fromEntries([['tsp', numeric('tspGrams')], ['tbsp', numeric('tbspGrams')], ['pinch', numeric('pinchGrams')], ['scoop', numeric('scoopGrams')], ['piece', numeric('pieceGrams')]].filter(([, grams]) => grams !== null)),
  };
  if (form.dataset.duplicateSource) {
    payload.sourceNote = form.dataset.duplicateSourceNote;
    payload.nutrientSourceNote = form.dataset.duplicateNutrientSourceNote;
  }
  const id = form.elements.id.value;
  let savedFood = false;
  try {
    const result = await api(id ? `/api/foods/${id}` : '/api/foods', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    savedFood = true;
    form.elements.id.value = result.food.id;
    if (state.household && form.dataset.purchaseUnitReady === 'true') {
      if (hasPurchaseUnit) {
        await api('/api/household-purchase-units', { method: 'PUT', body: JSON.stringify({
          householdId: state.household.id, foodId: result.food.id,
          singularLabel: form.elements.purchaseSingularLabel.value,
          pluralLabel: form.elements.purchasePluralLabel.value,
          coveredQuantity: numeric('purchaseCoveredQuantity'),
          coveredUnitId: form.elements.purchaseCoveredUnitId.value,
          estimateNote: form.elements.purchaseEstimateNote.value,
        }) });
        form.dataset.purchaseUnitExists = 'true';
      } else if (form.dataset.purchaseUnitExists === 'true') {
        await api(`/api/household-purchase-units?householdId=${encodeURIComponent(state.household.id)}&foodId=${encodeURIComponent(result.food.id)}`, { method: 'DELETE' });
        form.dataset.purchaseUnitExists = 'false';
      }
    }
    $('#food-dialog').close();
    await refreshFoods();
    if (state.editingFoodFromShopping) { state.editingFoodFromShopping = false; await refreshShoppingList(); }
    if (state.editingFoodFromRecipe) showMessage($('#recipe-message'), 'Fiche mise à jour. Les valeurs seront recalculées à l’enregistrement de la recette.', true);
  } catch (error) {
    if (savedFood) {
      showMessage($('#food-message'), `Fiche enregistrée, mais réglage d’unité d’achat non enregistré : ${error.body?.error ?? error.message}`);
      return;
    }
    const duplicates = error.body?.matches?.map((food) => food.name).join(', ');
    showMessage($('#food-message'), error.body?.error === 'possible-duplicate' ? `Cette fiche ressemble à un aliment déjà présent : ${duplicates}.` : `Enregistrement impossible : ${error.body?.error ?? error.message}`);
  }
});

async function loadHouseholds() {
  try {
    const { households } = await api('/api/households');
    if (households.length) {
      state.household = households[0];
      $('#household-box').textContent = `Foyer : ${state.household.name}`;
    } else {
      $('#household-box').innerHTML = '<form id="household-form"><label for="household-name">Créer le foyer</label><input id="household-name" required maxlength="120" placeholder="Nom du foyer"><button class="primary">Créer</button></form>';
      $('#household-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        try { await api('/api/households', { method: 'POST', body: JSON.stringify({ name: $('#household-name').value }) }); await loadHouseholds(); await refreshFoods(); }
        catch { $('#household-box').insertAdjacentText('beforeend', ' — création impossible'); }
      });
    }
  } catch { $('#household-box').textContent = 'Base de données indisponible'; }
}

function addRecipeLine(initial = null) {
  if(initial?.recipeId)return addRecipeIngredientLine(initial);
  const row = document.createElement('div'); row.className = 'recipe-line';
  const foodBox = document.createElement('div'); foodBox.className = 'food-choice';
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Rechercher un aliment'; search.autocomplete = 'off';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Aliment lié'); select.innerHTML = '<option value="">Choisir un aliment</option>';
  const changeMatch = document.createElement('button'); changeMatch.type = 'button'; changeMatch.className = 'text-button change-match hidden'; changeMatch.textContent = 'Changer l’aliment';
  const editFood = document.createElement('button'); editFood.type = 'button'; editFood.className = 'text-button edit-food hidden'; editFood.textContent = 'Modifier les valeurs nutritionnelles';
  const incompleteTag = document.createElement('span'); incompleteTag.className = 'incomplete-tag hidden'; incompleteTag.textContent = 'Incomplet';
  incompleteTag.setAttribute('aria-label', 'Données nutritionnelles ou conversion à compléter');
  if (initial?.incomplete) incompleteTag.classList.remove('hidden');
  editFood.addEventListener('click', () => { if (select.value) openFoodEditor(select.value, { fromRecipe: true }); });
  changeMatch.addEventListener('click', () => { select.value = ''; search.value = ''; search.classList.remove('hidden'); row.classList.remove('has-match'); changeMatch.classList.add('hidden'); editFood.classList.add('hidden'); incompleteTag.classList.add('hidden'); search.focus(); });
  const hint = document.createElement('div'); hint.className = 'food-hint'; hint.setAttribute('aria-live', 'polite');
  if (initial?.foodId) { select.add(new Option(initial.foodName ?? 'Aliment sélectionné', initial.foodId, true, true)); search.classList.add('hidden'); row.classList.add('has-match'); changeMatch.classList.remove('hidden'); editFood.classList.remove('hidden'); }
  else if (initial?.foodName) search.value = initial.foodName;
  let timeout;
  search.addEventListener('input', () => {
    select.value = '';
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      if (search.value.trim().length < 2) return;
      try {
        const { foods } = await api(`/api/foods?q=${encodeURIComponent(search.value.trim())}&limit=20&unit=${encodeURIComponent(unit.value)}`);
        select.replaceChildren(new Option(foods.length ? 'Choisir un aliment' : 'Aucun aliment correspondant', ''), ...foods.map((food) => new Option(`${food.name}${food.brand ? ` · ${food.brand}` : ''}`, food.id)));
        hint.replaceChildren(document.createTextNode(foods.length
          ? 'Aucune suggestion ne convient ? Tu peux créer cette fiche sans inventer ses valeurs nutritionnelles. ' : 'Aucun résultat. Tu peux créer cette fiche sans inventer ses valeurs nutritionnelles. '));
          const create = document.createElement('button'); create.type = 'button'; create.className = 'text-button'; create.textContent = `Créer « ${search.value.trim()} »`;
          create.addEventListener('click', async () => {
            const name = search.value.trim();
            create.disabled = true;
            try {
              const { food } = await api('/api/foods', { method: 'POST', body: JSON.stringify({
                name, brand: null, aliases: [],
                nutrientsPer100g: { energyKcal: null, proteinG: null, carbohydrateG: null, fatG: null, fibreG: null },
                gramsPerMillilitre: null, gramsPerUnit: {},
              }) });
              select.replaceChildren(new Option(food.name, food.id, true, true));
              search.classList.add('hidden'); row.classList.add('has-match'); changeMatch.classList.remove('hidden'); editFood.classList.remove('hidden');
              search.value = '';
              hint.textContent = 'Fiche créée. Les nutriments restent à compléter dans le catalogue.';
              await refreshFoods();
            } catch (error) {
              const matches = error.body?.matches ?? [];
              if (matches.length) {
                select.replaceChildren(new Option('Choisir une fiche existante', ''), ...matches.map((food) => new Option(food.name, food.id)));
                hint.textContent = 'Une fiche similaire existe déjà : sélectionne-la dans la liste.';
              } else {
                hint.textContent = `Création impossible : ${error.body?.error ?? error.message}`;
                create.disabled = false;
              }
            }
          });
        hint.append(create);
      } catch { select.replaceChildren(new Option('Catalogue indisponible', '')); hint.textContent = ''; }
    }, 180);
  });
  select.addEventListener('change', () => {
    incompleteTag.classList.add('hidden');
    if (select.value) { search.value = ''; search.classList.add('hidden'); row.classList.add('has-match'); changeMatch.classList.remove('hidden'); editFood.classList.remove('hidden'); hint.replaceChildren(); }
    else { search.classList.remove('hidden'); row.classList.remove('has-match'); changeMatch.classList.add('hidden'); editFood.classList.add('hidden'); }
  });
  const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '0.01'; quantity.step = 'any';
  quantity.value = initial && Object.hasOwn(initial, 'quantity') ? String(initial.quantity ?? '') : '100';
  quantity.placeholder = quantity.value ? '' : 'À préciser'; quantity.required = true; quantity.setAttribute('aria-label', 'Quantité');
  const unit = document.createElement('select'); unit.setAttribute('aria-label', 'Unité');
  for (const [id, label] of [['g','g'],['kg','kg'],['ml','ml'],['l','l'],['tsp','c. à café'],['tbsp','c. à soupe'],['cup','tasse'],['pinch','pincée'],['scoop','scoop'],['piece','pièce']]) unit.add(new Option(label, id));
  if (initial?.unitId) unit.value = initial.unitId;
  if (initial?.unknownUnit) { unit.add(new Option('Unité à préciser', ''), 0); unit.value = ''; unit.required = true; }
  unit.addEventListener('change', () => { if (search.value.trim().length >= 2) search.dispatchEvent(new Event('input')); });
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-line'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Supprimer cet ingrédient'); remove.addEventListener('click', () => row.remove());
  const serving = document.createElement('select'); serving.name = 'servingPart'; serving.className = 'serving-part-choice'; serving.setAttribute('aria-label','Partie servie');
  serving.add(new Option('Viande, légumes, sauce','main')); serving.add(new Option('Féculents','starch')); serving.add(new Option('Légumes','vegetables')); serving.value = initial?.servingPart ?? 'main';
  const servingMode=$('#recipe-form').elements.servingMode.value;
  serving.hidden = servingMode === 'original';
  if(servingMode === 'whole') {
    serving.options[0].textContent='Autre ingrédient du plat';serving.options[1].textContent='Féculent intégré au plat';
    if(Number(initial?.cookingFactor)>1)serving.value='starch';
  }
  serving.options[2].hidden = $('#recipe-form').elements.servingMode.value !== 'three';
  serving.options[2].disabled = serving.options[2].hidden;
  if(!serving.options[2].hidden) serving.options[0].textContent='Viande / protéines et sauce';
  serving.addEventListener('change',updateServingConfiguration);
  const cooking = document.createElement('select'); cooking.name='cookingFactor'; cooking.className='ingredient-cooking-choice'; cooking.setAttribute('aria-label','Coefficient de cuisson de cet ingrédient');
  fillCookingFactorOptions(cooking,initial?.cookingFactor??1,document,state.foodYieldConversions.filter(item=>item.sourceFoodId===initial?.foodId));
  select.addEventListener('change',()=>{const value=Number(cooking.value||initial?.cookingFactor||1);cooking.replaceChildren();fillCookingFactorOptions(cooking,value,document,state.foodYieldConversions.filter(item=>item.sourceFoodId===select.value));});
  const controls=document.createElement('div');controls.className='recipe-line-controls';
  const field=(text,input,className)=>{const label=document.createElement('label');label.className=className;label.append(document.createTextNode(text),input);return label;};
  const quantityField=field('Quantité',quantity,'ingredient-quantity-field'),unitField=field('Unité',unit,'ingredient-unit-field');
  const servingField=field(servingMode === 'whole'?'Type d’ingrédient':'Partie servie',serving,'ingredient-serving-field'),cookingField=field('Coefficient de cuisson',cooking,'ingredient-cooking-field');
  servingField.hidden=serving.hidden;
  cooking.hidden=false;cookingField.hidden=false;
  controls.append(quantityField,unitField,servingField,cookingField,remove);
  const actions=document.createElement('div');actions.className='ingredient-actions';actions.append(changeMatch,editFood);
  foodBox.append(search,select,incompleteTag);row.append(foodBox,controls,hint,actions);$('#recipe-lines').append(row);
  if (initial?.foodId) changeMatch.classList.remove('hidden');
  // Imported ingredient names are already a useful search query. Trigger the
  // same lookup as typing so the dropdown is populated during recipe review.
  if (initial?.foodName && !initial?.foodId) search.dispatchEvent(new Event('input'));
}

function componentUnitOptions(recipe) {
  const units=new Set([recipe.yield.unitId,...Object.keys(recipe.outputUnits??{}),'g']);
  if(units.has('g'))units.add('kg');
  if(units.has('ml'))units.add('l');
  return [...units].map(id=>[id,({piece:'pièce',slice:'tranche',portion:'portion'})[id]??id]);
}
function addRecipeIngredientLine(initial=null) {
  const row=document.createElement('div');row.className='recipe-line recipe-ingredient-line';
  const box=document.createElement('div');box.className='food-choice';
  const caption=document.createElement('span');caption.textContent='Préparation maison';
  const select=document.createElement('select');select.setAttribute('aria-label','Recette liée');select.required=true;
  select.add(new Option('Choisir une préparation…',''));
  for(const recipe of state.recipes.filter(r=>r.id!==state.editingRecipeId).sort((a,b)=>a.name.localeCompare(b.name,'fr')))select.add(new Option(recipe.name,recipe.id));
  select.value=initial?.recipeId??'';
  const quantity=document.createElement('input');quantity.type='number';quantity.min='0.001';quantity.max='100000';quantity.step='any';quantity.required=true;quantity.value=String(initial?.quantity??1);quantity.setAttribute('aria-label','Quantité');
  const unit=document.createElement('select');unit.setAttribute('aria-label','Unité');unit.required=true;
  const hint=document.createElement('p');hint.className='hint';
  const link=document.createElement('button');link.type='button';link.className='text-button';link.textContent='Voir la préparation';
  link.addEventListener('click',()=>{if(select.value)showRecipeCard(select.value);});
  const refresh=()=>{const recipe=state.recipes.find(r=>r.id===select.value);unit.replaceChildren();link.hidden=!recipe;
    if(!recipe){hint.textContent='Ajoute d’abord ta recette de pain, sauce ou accompagnement dans les recettes.';return;}
    for(const [id,label] of componentUnitOptions(recipe))unit.add(new Option(label,id));
    unit.value=initial?.recipeId===recipe.id?initial.unitId:recipe.yield.unitId;
    hint.textContent='Base : '+formatQty(recipe.yield.amount)+' '+recipe.yield.unitId+'. '+Object.entries(recipe.outputUnits??{}).map(([key,value])=>formatQty(value)+' '+key).join(' · ')+'. Les préparations suivies en stock doivent être fabriquées avant le plat.';
  };
  select.addEventListener('change',refresh);refresh();
  const serving=document.createElement('select');serving.name='servingPart';serving.className='serving-part-choice';
  for(const [id,label] of [['main','Viande, légumes, sauce'],['starch','Féculents'],['vegetables','Légumes']])serving.add(new Option(label,id));
  serving.value=initial?.servingPart??'main';
  const factor=document.createElement('select');factor.name='cookingFactor';factor.className='component-cooking-factor';factor.add(new Option('Déjà préparé — ×1','1'));
  const controls=document.createElement('div');controls.className='recipe-line-controls';
  const field=(text,input)=>{const label=document.createElement('label');label.className=input===quantity?'ingredient-quantity-field':input===unit?'ingredient-unit-field':'ingredient-serving-field';label.append(document.createTextNode(text),input);return label;};
  const remove=document.createElement('button');remove.type='button';remove.className='remove-line';remove.textContent='×';remove.setAttribute('aria-label','Supprimer cette préparation');remove.addEventListener('click',()=>row.remove());
  controls.append(field('Quantité',quantity),field('Unité',unit),field('Partie servie',serving),remove);
  box.append(caption,select);row.append(box,controls,hint,link,factor);factor.hidden=true;$('#recipe-lines').append(row);updateServingConfiguration();
}
function recipeLineInput(row) {
  const component=$('select[aria-label="Recette liée"]',row);
  return {...(component?{recipeId:component.value}:{foodId:$('select[aria-label="Aliment lié"]',row).value}),
    quantity:Number($('input[aria-label="Quantité"]',row).value),unitId:$('select[aria-label="Unité"]',row).value};
}
$('#add-recipe-line').addEventListener('click',()=>addRecipeIngredientLine());

$('#add-line').addEventListener('click', addRecipeLine);
function updateServingConfiguration() {
  const form = $('#recipe-form'); const mode = form.elements.servingMode.value;

  const split = ['separate','three'].includes(mode);

  $('#recipe-lines').classList.toggle('serving-parts-active',split);
  $$('.serving-part-choice').forEach(select => {
    select.hidden = mode === 'original';
    select.closest('label').hidden=select.hidden;
    select.closest('label').firstChild.textContent=mode === 'whole'?'Type d’ingrédient':'Partie servie';
    select.options[0].textContent = mode === 'whole' ? 'Autre ingrédient du plat' : mode === 'three' ? 'Viande / protéines et sauce' : 'Viande, légumes, sauce';
    select.options[1].textContent = mode === 'whole' ? 'Féculent intégré au plat' : 'Féculents';
    select.options[2].hidden = mode !== 'three';
    select.options[2].disabled = mode !== 'three';
    if(mode !== 'three' && select.value === 'vegetables') select.value = 'main';
  });
  $$('.ingredient-cooking-choice').forEach(select=>{
    select.hidden=false;
    select.closest('label').hidden=select.hidden;
  });
  const status=$('#serving-assignment-status');
  status.classList.toggle('hidden',!split);
  const starchLines=$$('.serving-part-choice').filter(select=>select.value==='starch').length;
  status.textContent=starchLines ? `${starchLines} ingrédient(s) affecté(s) aux féculents. Les autres restent dans le plat.` : 'Choisis « Féculents » sur la ligne du riz, des pâtes ou des autres féculents dans les ingrédients ci-dessous. Cette affectation est nécessaire pour enregistrer deux parties.';
  if(mode === 'three') status.textContent='Affecte chaque ingrédient à « Viande / protéines et sauce », « Légumes » ou « Féculents ». Les trois parties auront des quantités indépendantes dans le calendrier. Chaque ingrédient possède son propre coefficient de cuisson, indépendant de son affectation.';
}
$('#recipe-form').elements.servingMode.addEventListener('change',updateServingConfiguration);
$('#recipe-form').elements.recipeType.addEventListener('change', () => {
  const form = $('#recipe-form');
  if (!['dish','salad'].includes(form.elements.recipeType.value) && ['separate','three'].includes(form.elements.servingMode.value)) form.elements.servingMode.value = 'whole';
  if (['dessert','beverage','sauce'].includes(form.elements.recipeType.value)) form.elements.servingMode.value = 'original';
  updateServingConfiguration();
});
$('#new-recipe').addEventListener('click', () => openRecipeEditor());
$('#cancel-recipe').addEventListener('click', () => { $('#recipe-form').classList.add('hidden'); $('#recipe-result').classList.add('hidden'); });
$('#delete-current-recipe')?.addEventListener('click',event=>{
  if(state.editingRecipeForDeletion)requestRecipeDeletion(state.editingRecipeForDeletion,event.currentTarget,$('#recipe-delete-message'));
});
$('#ignore-import-draft').addEventListener('click', async (event) => {
  const draftId = state.importingDraftId;
  if (!draftId || !state.household) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await api(`/api/recipe-imports/${draftId}/discarded`, { method: 'POST', body: JSON.stringify({ householdId: state.household.id }) });
    state.importingDraftId = null;
    state.generateImportedImage = false;
    button.classList.add('hidden');
    $('#recipe-form').classList.add('hidden');
    $('#recipe-result').classList.add('hidden');
    $('#recipe-import-source')?.remove();
    await setView('import');
    showMessage($('#recipe-import-message'), 'Brouillon ignoré.', true);
  } catch {
    showMessage($('#recipe-message'), 'Impossible d’ignorer ce brouillon.');
  } finally {
    button.disabled = false;
  }
});
$('#recipe-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#recipe-message'); message.textContent = '';
  if (!state.household) { showMessage(message, 'Crée d’abord un foyer en haut de la page.'); return; }
  const lines = $$('.recipe-line').map(recipeLineInput);
  if(lines.some(line=>!line.foodId&&!line.recipeId)){
    showMessage(message,'Associe chaque ligne à un aliment ou à une préparation maison.');return;
  }
  const form = event.currentTarget;
  const servingMode = form.elements.servingMode.value;
  const servingOptions = { servingMode, separateStarch: servingMode !== 'original', cookingFactors: { main:1, starch:1, vegetables:1 } };
  $$('.recipe-line').forEach((row,index) => { lines[index].servingPart = ['separate','three'].includes(servingMode) ? $('select[name="servingPart"]',row).value : 'main'; const factor=$('select[name="cookingFactor"]',row).value; lines[index].cookingFactor=factor === '' ? null : Number(factor); });
  if (['separate','three'].includes(servingMode) && !lines.some(line=>line.servingPart === 'starch')) {
    showMessage(message,'Affecte le riz ou les autres féculents à « Féculents » sur leurs lignes d’ingrédients avant d’enregistrer. Le service séparé est conservé dans le formulaire.');
    message.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  if (servingMode === 'three' && !lines.some(line=>line.servingPart === 'vegetables')) {
    showMessage($('#recipe-message'),'Affecte au moins un ingrédient à « Légumes » avant d’enregistrer les trois parties.');return;
  }
  try {
    const path = state.editingRecipeId ? `/api/recipes/${state.editingRecipeId}` : '/api/recipes';
    const method = state.editingRecipeId ? 'PUT' : 'POST';
    const { recipe } = await api(path, { method, body: JSON.stringify({ name: form.elements.name.value, description: form.elements.description.value, productionType: form.elements.productionType.value, minimumProductionAmount:Number(form.elements.minimumProductionAmount.value||0),minimumProductionUnitId:form.elements.minimumProductionUnitId.value, recipeType: form.elements.recipeType.value, mealMoments: [...form.querySelectorAll('input[name="mealMoments"]:checked')].map((input) => input.value), instructions: form.elements.instructions.value, sourceUrl: form.elements.sourceUrl.value || null, householdId: state.household.id, yield: { amount: Number(form.elements.yieldAmount.value), unitId: form.elements.yieldUnit.value }, outputUnits:Object.fromEntries(['piece','slice','portion','g','ml'].flatMap(unit=>{const value=form.elements['output_'+unit]?.value;return value?[ [unit,Number(value)] ]:[];})), ...servingOptions, lines }) });
    const generateImage=state.generateImportedImage;state.generateImportedImage=false;
    if (state.importingDraftId) {
      await api(`/api/recipe-imports/${state.importingDraftId}/converted`, { method: 'POST', body: JSON.stringify({ householdId: state.household.id }) });
      state.importingDraftId = null;
      $('#ignore-import-draft')?.classList.add('hidden');
    }
    renderRecipe(recipe); showMessage(message, 'Recette enregistrée. Les valeurs affichées sont calculées depuis le catalogue.', true);
    state.editingRecipeId = null;
    state.editingRecipeForDeletion=null;$('#delete-current-recipe')?.classList.add('hidden');
    $('#recipe-form-title').textContent = 'Nouvelle recette';
    $('#recipe-form').classList.add('hidden');
    if(generateImage&&recipeImageConfig.enabled){
      showMessage(message,'Recette enregistrée. Création de son illustration…',true);
      try{await api(`/api/recipes/${recipe.id}/image/ai`,{method:'POST',body:JSON.stringify({householdId:state.household.id}),signal:AbortSignal.timeout(100_000)});showMessage(message,'Recette enregistrée et illustration créée. Tu peux la remplacer par une photo personnelle.',true);}
      catch(error){showMessage(message,`Recette enregistrée. ${recipeImageErrorMessage(error)} Tu peux réessayer depuis le bouton Photo.`,false);}
    }
    await refreshRecipes();
  } catch (error) {
    const servingErrors={
      'recipe-output-in-use':'Cette préparation a déjà été utilisée dans une autre production. Garde son unité et ses parties de service pour préserver l’historique ; duplique-la pour créer un autre format.',
      'recipe-ingredient-cycle':'Une préparation ne peut pas contenir elle-même, même via une autre recette.',
      'recipe-ingredient-not-found':'Une préparation liée est indisponible dans ce foyer. Choisis une recette existante.',
      'recipe-ingredient-unit-missing':'Cette unité n’est pas définie pour la préparation choisie. Renseigne son équivalence dans la recette source (par exemple 20 tranches pour un pain).',
      'invalid-output-units':'Vérifie les équivalences : valeurs positives, et même quantité que le rendement pour son unité.',
      'invalid-production-minimum':'Le lot minimum doit être un nombre positif ou nul, dans une unité reconnue.',
      'production-minimum-requires-tracking':'Choisis un type dans « Production à suivre » avant de définir un lot minimum.',
      'production-minimum-unit-missing':'Renseigne l’équivalence de cette unité dans « Utiliser cette recette à la pièce, à la tranche… » avant de définir le lot minimum.',

      'starch-ingredients-required':'Affecte au moins un ingrédient à la partie « Féculents » avant d’enregistrer le service séparé.',
      'vegetable-ingredients-required':'Affecte au moins un ingrédient à la partie « Légumes » avant d’enregistrer les trois parties.',
      'serving-weight-conversion-required':'Pour estimer les grammes, complète la conversion en grammes des ingrédients exprimés en ml, cuillères ou pièces dans leurs fiches aliments.',
      'invalid-serving-parts':'La séparation des féculents est réservée aux plats. Garde au moins un ingrédient dans la partie principale.',
      'invalid-cooking-factor':'Le coefficient de cuisson doit être un nombre positif, au maximum 10.',
      'serving-parts-cannot-be-disabled':'Le retour aux proportions de la recette est prévu pour « Préparation servie ensemble ». Les modes avec plusieurs parties ne peuvent pas être regroupés automatiquement.',
      'serving-part-removal-not-supported':'Une partie déjà utilisée ne peut pas être supprimée implicitement. Conserve les parties existantes pour protéger le planning et le stock.',
      'recipe-used-in-prepared-meal':'Cette recette est liée à un repas déjà marqué préparé. Annule d’abord la préparation de ce repas pour modifier ses ingrédients.',
    };
    showMessage(message,servingErrors[error.body?.error] ?? `Enregistrement impossible : ${error.body?.error ?? error.message}`);
  }
});

async function openRecipeEditor(id = null, duplicate = false) {
  await refreshProductionTypes();
  const form = $('#recipe-form');
  $('#recipe-import-source')?.remove();
  form.reset();
  populateProductionTypeSelect(form.elements.productionType,'none');
  $('#recipe-lines').replaceChildren();
  $('#recipe-message').textContent = '';
  $('#recipe-result').classList.add('hidden');
  state.editingRecipeId = duplicate ? null : id;
  state.editingRecipeForDeletion=null;
  const remove=$('#delete-current-recipe');if(remove){remove.classList.add('hidden');remove.disabled=true;}
  const deleteMessage=$('#recipe-delete-message');if(deleteMessage)deleteMessage.textContent='';
  state.importingDraftId = null;
  $('#ignore-import-draft')?.classList.add('hidden');
  state.generateImportedImage=false;
  $('#recipe-form-title').textContent = duplicate ? 'Dupliquer une recette' : id ? 'Modifier la recette' : 'Nouvelle recette';
  if (id) {
    try {
      const { recipe } = await api(`/api/recipes/${id}`);
      if(!duplicate){state.editingRecipeForDeletion=recipe;if(remove){remove.classList.remove('hidden');remove.disabled=false;}}
      form.elements.name.value = duplicate ? `${recipe.name.slice(0,190)} (variante)` : recipe.name;
      form.elements.description.value = recipe.description ?? '';
      if(recipe.recipeType && form.elements.recipeType.options && ![...form.elements.recipeType.options].some(option=>option.value===recipe.recipeType))form.elements.recipeType.add(new Option(state.mealAdditions.find(item=>item.recipeType===recipe.recipeType)?.label??recipe.recipeType,recipe.recipeType));
      form.elements.recipeType.value = recipe.recipeType ?? 'dish';
      for (const checkbox of form.querySelectorAll('input[name="mealMoments"]')) checkbox.checked = (recipe.mealMoments ?? []).includes(checkbox.value);
      populateProductionTypeSelect(form.elements.productionType,recipe.productionType ?? 'none');
      form.elements.sourceUrl.value = recipe.sourceUrl ?? '';
      form.elements.instructions.value = recipe.instructions ?? '';
      form.elements.yieldAmount.value = recipe.yield.amount;
      form.elements.yieldUnit.value = recipe.yield.unitId;
      form.elements.minimumProductionAmount.value=recipe.minimumProductionAmount??0;
      form.elements.minimumProductionUnitId.value=recipe.minimumProductionUnitId??recipe.yield.unitId;
      for(const unit of ['piece','slice','portion','g','ml'])if(form.elements['output_'+unit])form.elements['output_'+unit].value=recipe.outputUnits?.[unit]??'';
      if (form.elements.servingMode) {
        form.elements.servingMode.value = recipe.separateStarch ? (recipe.servingParts?.some(part=>part.servingPart==='vegetables') ? 'three' : recipe.servingParts?.some(part=>part.servingPart==='starch') ? 'separate' : 'whole') : 'original';
      }
      const incompleteLines = new Set((recipe.nutrition.lineIssues ?? []).map((issue) => issue.lineIndex));
      recipe.lines.forEach((line, index) => addRecipeLine({ ...line, cookingFactor:ingredientCookingFactor(recipe,line), incomplete: incompleteLines.has(index) }));
    } catch (error) {
      showMessage($('#recipe-message'), `Impossible de charger cette recette : ${error.body?.error ?? error.message}`);
      form.classList.remove('hidden');
      return;
    }
  } else { form.elements.minimumProductionAmount.value=0;form.elements.minimumProductionUnitId.value=['piece','slice','portion','g','ml'].includes(form.elements.yieldUnit.value)?form.elements.yieldUnit.value:'portion';form.elements.servingMode && (form.elements.servingMode.value = 'whole'); addRecipeLine(); }
  if (form.elements.servingMode) updateServingConfiguration();
  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const recipeFilterChoices={
  type:[['','Tous'],['dish','Plat'],['salad','Salade'],['sauce','Sauce'],['beverage','Boisson'],['accompaniment','Accompagnement'],['dessert','Dessert']],
  moment:[['','Tous'],['breakfast','Petit-déjeuner'],['lunch','Déjeuner'],['snack','Collation'],['dinner','Dîner'],['untagged','Sans tag']],
};
const recipeFilters={type:'',moment:'',service:'',query:'',missing:'',page:1};
let recipeDisplay=recipeDisplayPreferences();
async function showRecipeCard(recipeId,recipeName=null){
  const recipe=recipeCardForSource(state.recipes,recipeId) ?? (recipeName?{id:recipeId,name:recipeName}:null);
  if(!recipe)return;
  recipeFilters.type='';recipeFilters.moment='';recipeFilters.service='';recipeFilters.missing='';recipeFilters.query=recipe.name;recipeFilters.page=1;
  $('#recipe-search').value=recipe.name;
  $('#recipe-missing-filter').value='';
  await setView('recipes');
  $('#recipe-list [data-recipe-id="'+recipe.id+'"]')?.scrollIntoView({block:'center'});
}
let cookingRecipeId=null,cookingRequest=null,cookingPartInputs=[],cookingState=null;
let stopCookingInstagram=()=>{};
function renderCookingIngredients(){
  const recipe=state.recipes.find(item=>item.id===cookingRecipeId),form=$('#cook-form');if(!recipe)return;
  const free=cookingState?.mode==='free';
  const servingQuantities=!free&&cookingPartInputs.length?cookingPartInputs.map(({part,input})=>({recipeId:part.recipeId,quantity:Number(input.value)})):undefined;
  if(servingQuantities)form.elements.quantity.value=String(servingQuantities.reduce((sum,part)=>sum+part.quantity,0));
  const quantity=Number(form.elements.quantity.value),root=$('#cook-ingredients');root.replaceChildren();
  if(cookingState){
    if(free)cookingState.freeQuantity=form.elements.quantity.value;
    else{cookingState.menuQuantity=form.elements.quantity.value;if(servingQuantities)cookingState.menuParts=servingQuantities;}
  }
  const equivalent=$('#cook-equivalent');equivalent.hidden=!free||!recipe.servingParts?.length;
  equivalent.textContent=free&&Number.isFinite(quantity)&&quantity>0&&recipe.servingParts?.length
    ?`Poids total estimé : ${formatQty(cookingYield(recipe).amount*quantity/recipe.yield.amount)} g pour ${formatQty(quantity)} ${recipe.yield.unitId}.` : '';
  if(!Number.isFinite(quantity)||quantity<=0)return;
  const names={main:recipe.servingParts?.length>2?'Viande et protéines':'Préparation principale',vegetables:'Légumes',starch:'Féculents'};
  const lines=(free?scaledSourceIngredients(recipe,quantity):scaledIngredients(recipe,quantity,servingQuantities)).filter(line=>line.scaledQuantity>0),parts=[...new Set(lines.map(line=>line.servingPart??'main'))];
  for(const part of parts){
    const section=document.createElement('section');section.className='cook-part';
    if(parts.length>1){const heading=document.createElement('h4');heading.textContent=names[part]??part;section.append(heading);}
    const list=document.createElement('ul');
    for(const line of lines.filter(item=>(item.servingPart??'main')===part)){
      const entry=document.createElement('li'),label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';
      label.append(check,document.createTextNode(` ${formatQty(line.scaledQuantity)} ${line.unitId} · ${line.foodName??'Aliment à vérifier'}`));entry.append(label);
      if(line.recipeId){const link=document.createElement('button');link.type='button';link.className='text-button';link.textContent='Voir la préparation';link.addEventListener('click',()=>{$('#cook-dialog').close();showRecipeCard(line.recipeId);});entry.append(link);}
      list.append(entry);
    }
    section.append(list);root.append(section);
  }
}
function configureCookingMode(){
  const recipe=state.recipes.find(item=>item.id===cookingRecipeId);if(!recipe||!cookingState)return;
  cookingState.mode=$('#cook-mode').value==='free'?'free':'menus';
  const free=cookingState.mode==='free',planned=cookingState.planned,form=$('#cook-form');
  const target=free?recipe.yield:cookingYield(recipe);
  form.elements.quantity.value=free?cookingState.freeQuantity:cookingState.menuQuantity;
  form.elements.quantity.step=free?'0.001':'any';
  cookingPartInputs=[];
  const split=!free&&recipe.servingParts?.length>1,partFields=$('#cook-part-quantities');partFields.replaceChildren();partFields.hidden=!split;
  $('#cook-total-quantity').hidden=split;form.elements.quantity.required=!split;form.elements.quantity.disabled=split;
  $('#cook-quantity-label').textContent=free&&recipe.yield.unitId==='portion'?'Nombre de portions à préparer':free&&recipe.yield.unitId==='piece'?'Nombre de pièces à préparer':'Quantité à fabriquer';
  if(split){
    const names={main:recipe.servingParts.length>2?'Viande et protéines':'Viande et légumes',vegetables:'Légumes',starch:'Féculents'};
    for(const part of recipe.servingParts.map(part=>({recipeId:part.id,servingPart:part.servingPart,quantity:cookingState.menuParts.find(item=>item.recipeId===part.id)?.quantity??0}))){
      const label=document.createElement('label'),input=document.createElement('input');
      input.type='number';input.min='0';input.max='100000';input.step='0.001';input.required=true;input.value=String(part.quantity);
      input.setAttribute('aria-label',`${names[part.servingPart]??part.servingPart} à fabriquer (g)`);
      input.addEventListener('input',renderCookingIngredients);
      label.append(document.createTextNode(`${names[part.servingPart]??part.servingPart} à fabriquer (g)`),input);partFields.append(label);cookingPartInputs.push({part,input});
    }
  }
  $('#cook-unit').textContent=target.unitId;$('#cook-base-yield').textContent=split?'Chaque partie est calculée séparément depuis les menus. Ses ingrédients suivent sa propre quantité à fabriquer.':`Recette de base : ${formatQty(recipe.yield.amount)} ${recipe.yield.unitId}${!free&&productionRecipe(recipe)!==recipe?`, soit ${formatQty(target.amount)} ${target.unitId} estimés`:''}. Les ingrédients ci-dessous suivent la quantité choisie.`;
  const plan=$('#cook-planned');
  plan.hidden=false;plan.textContent=free?'Préparation hors menus : les proportions de la recette sont conservées, sans ajustement aux objectifs nutritionnels des profils. Les menus ne sont pas modifiés.':planned?.parts.length?`Besoins des menus, toutes les personnes et dates de cette période réunies : ${planned.parts.map(part=>`${part.parentRecipeId?part.name?.split(' — ').at(-1)+' : ':''}${formatQty(part.plannedQuantity)} ${part.unitId} prévus − ${formatQty(part.coveredQuantity)} ${part.unitId} couverts par le stock = ${formatQty(part.toMakeQuantity)} ${part.unitId} à fabriquer`).join(' ; ')}. Quantités modifiables.`:'Aucun besoin de menu sur cette période : aucune quantité de recette complète n’est proposée automatiquement.';
  renderCookingIngredients();
}
function openCookingSheet(recipeId,quantity,productionDate,planned,initialMode='menus'){
  const recipe=state.recipes.find(item=>item.id===recipeId);if(!recipe)return;
  cookingRecipeId=recipeId;cookingRequest=null;cookingPartInputs=[];
  const form=$('#cook-form');form.reset();$('#cook-mode').value=initialMode;
  $('#cook-mode').options[0].disabled=Boolean(planned?.unavailable);
  cookingState={mode:'menus',planned,menuQuantity:String(quantity??0),menuParts:suggestedServingQuantities(planned,recipe),freeQuantity:String(recipe.yield.amount)};
  $('#save-cook').disabled=false;
  form.elements.producedOn.value=productionDate||localDateValue();
  $('#cook-title').textContent=recipe.name;$('#cook-description').textContent=recipe.description??'';
  $('#cook-instructions').textContent=recipe.instructions?.trim()||'Aucune instruction renseignée dans la recette.';
  const source=$('#cook-source');source.replaceChildren();if(recipe.sourceUrl){const link=document.createElement('a');link.href=recipe.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Source de la recette';source.append(link);}
  stopCookingInstagram();stopCookingInstagram=mountCookingInstagram($('#cook-video'),recipe.sourceUrl,document);
  const tracked=recipe.productionType&&recipe.productionType!=='none';
  $('#cook-production-fields').classList.toggle('hidden',!tracked);$('#save-cook').classList.toggle('hidden',!tracked);
  form.elements.producedOn.required=Boolean(tracked);
  showMessage($('#cook-message'),tracked?'':'Cette recette n’est pas suivie en stock. Sa fiche reste consultable et les quantités peuvent être ajustées.');
  configureCookingMode();$('#cook-dialog').showModal();
}
$('#cook-dialog')?.addEventListener('close',()=>stopCookingInstagram());
$('#cook-dialog')?.addEventListener('cancel',()=>stopCookingInstagram());
$('#cook-mode')?.addEventListener('change',configureCookingMode);
$('#cook-form')?.elements.quantity.addEventListener('input',renderCookingIngredients);
for(const id of ['close-cook-dialog','cancel-cook'])$('#'+id)?.addEventListener('click',()=>$('#cook-dialog').close());
$('#cook-form')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,recipe=state.recipes.find(item=>item.id===cookingRecipeId),button=$('#save-cook');
  if(!recipe||!recipe.productionType||recipe.productionType==='none'||button.disabled||!form.reportValidity())return;
  const free=cookingState?.mode==='free';
  const servingQuantities=!free&&cookingPartInputs.length?cookingPartInputs.map(({part,input})=>({recipeId:part.recipeId,quantity:Number(input.value)})):null;
  if(servingQuantities && !servingQuantities.some(part=>part.quantity>0)){showMessage($('#cook-message'),'Aucune quantité à fabriquer pour ces menus.');return;}
  const payload={householdId:state.household.id,recipeId:free||servingQuantities?recipe.id:productionRecipe(recipe).id,producedOn:form.elements.producedOn.value,
    ...(servingQuantities?{servingQuantities}:{quantity:Number(form.elements.quantity.value)}),storage:form.elements.storage.value,note:form.elements.note.value};
  const fingerprint=JSON.stringify(payload);if(cookingRequest?.fingerprint!==fingerprint)cookingRequest={fingerprint,requestId:newProductionRequestId()};
  button.disabled=true;let saved=false;
  try{
    await api('/api/household-planning/production',{method:'POST',body:JSON.stringify({...payload,requestId:cookingRequest.requestId})});
    cookingRequest=null;saved=true;showMessage($('#cook-message'),'Production ajoutée au stock. Ferme la fiche pour revenir à la liste.',true);
    await Promise.allSettled([refreshShopping(),refreshDashboard()]);
  }catch(error){const body=error.body??{};
    showMessage($('#cook-message'),body.error==='prepared-component-insufficient'
      ?'Prépare d’abord '+body.name+' : '+formatQty(body.requiredQuantity)+' '+body.unitId+' nécessaires, '+formatQty(body.availableQuantity)+' disponibles.'
      :'Production non enregistrée : '+(body.error??error.message));}
  finally{button.disabled=saved;}
});
try{
  const saved=JSON.parse(localStorage.getItem('lapinou-recipe-filters')??'{}');
  for(const key of ['type','moment'])if(recipeFilterChoices[key].some(([value])=>value===saved[key]))recipeFilters[key]=saved[key];
  if(recipeServiceChoices.some(([value])=>value===saved.service))recipeFilters.service=saved.service;
  recipeDisplay=recipeDisplayPreferences(JSON.parse(localStorage.getItem('lapinou-recipe-display')??'{}'));
}catch{}
function renderFilteredRecipes(){
  const recipes=filterRecipeDirectory(state.recipes,{...recipeFilters,plannedRecipeIds:state.plannedRecipeIds});
  const recipesPerPage=recipeDisplay.perPage;
  const root=$('#recipe-list');root.classList.toggle('recipe-list-view',recipeDisplay.view==='list');
  root.style.setProperty('--recipe-columns',String(recipeDisplay.columns));root.style.setProperty('--recipe-tablet-columns',String(Math.min(2,recipeDisplay.columns)));
  for(const view of ['grid','list'])$('#recipe-view-'+view).setAttribute('aria-pressed',String(recipeDisplay.view===view));
  $('#recipe-columns-label').hidden=recipeDisplay.view==='list';
  $('#recipe-columns').value=String(recipeDisplay.columns);$('#recipe-per-page').value=String(recipeDisplay.perPage);
  $('#recipe-service-filter').value=recipeFilters.service;
  const typeChoices=[...recipeFilterChoices.type];
  for(const addition of state.mealAdditions)if(!typeChoices.some(([type])=>type===addition.recipeType))typeChoices.push([addition.recipeType,addition.label]);
  const recipeTypeSelect=$('#recipe-type-select');
  if(recipeTypeSelect){
    for(const option of [...recipeTypeSelect.options])if(!recipeFilterChoices.type.some(([type])=>type===option.value))option.remove();
    for(const addition of state.mealAdditions){let option=[...recipeTypeSelect.options].find(entry=>entry.value===addition.recipeType);if(!option){option=new Option(addition.label,addition.recipeType);recipeTypeSelect.add(option);}else if(!recipeFilterChoices.type.some(([type])=>type===option.value))option.textContent=addition.label;}
  }
  const pages=Math.max(1,Math.ceil(recipes.length/recipesPerPage));
  recipeFilters.page=Math.min(recipeFilters.page,pages);
  const start=(recipeFilters.page-1)*recipesPerPage;
  $('#recipe-list').replaceChildren(...(recipes.length?recipes.slice(start,start+recipesPerPage).map(recipeCard):[emptyMessage(state.recipes.length?'Aucune recette avec ces filtres.':'Aucune recette enregistrée.')]));
    $('#recipe-filter-count').textContent=recipeFilters.missing==='nutrition-planned'&&state.plannedRecipeLookupError
    ?'Le calendrier ne peut pas être vérifié pour le moment.'
    :`${recipes.length} recette${recipes.length===1?'':'s'} affichée${recipes.length===1?'':'s'} sur ${state.recipes.length}`;
  const pagination=$('#recipe-pagination');pagination.replaceChildren();
  if(pages>1){
    for(const [label,page] of [['← Précédent',recipeFilters.page-1],[`Page ${recipeFilters.page} / ${pages}`,null],['Suivant →',recipeFilters.page+1]]){
      if(page===null){const position=document.createElement('span');position.textContent=label;pagination.append(position);continue;}
      const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;button.disabled=page<1||page>pages;
      button.addEventListener('click',()=>{recipeFilters.page=page;renderFilteredRecipes();$('#recipe-filters-anchor').scrollIntoView({block:'start'});});pagination.append(button);
    }
  }
  for(const key of ['type','moment']){
    const choices=key==='type'?typeChoices:recipeFilterChoices[key];
    const root=$(`#recipe-${key}-filters`);root.replaceChildren(...choices.map(([value,label])=>{
      const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;button.setAttribute('aria-pressed',String(recipeFilters[key]===value));
      button.addEventListener('click',()=>{recipeFilters[key]=value;recipeFilters.page=1;try{localStorage.setItem('lapinou-recipe-filters',JSON.stringify({type:recipeFilters.type,moment:recipeFilters.moment,service:recipeFilters.service}));}catch{}renderFilteredRecipes();});
      return button;
    }));
  }
  $('#recipe-missing-filter').value=recipeFilters.missing;
}
function saveRecipeDisplay(){try{localStorage.setItem('lapinou-recipe-display',JSON.stringify(recipeDisplay));}catch{}renderFilteredRecipes();}
for(const view of ['grid','list'])$('#recipe-view-'+view)?.addEventListener('click',()=>{recipeDisplay.view=view;saveRecipeDisplay();});
$('#recipe-columns')?.addEventListener('change',event=>{recipeDisplay.columns=Number(event.target.value);saveRecipeDisplay();});
$('#recipe-per-page')?.addEventListener('change',event=>{recipeDisplay.perPage=Number(event.target.value);recipeFilters.page=1;saveRecipeDisplay();});
$('#recipe-service-filter')?.addEventListener('change',event=>{recipeFilters.service=event.target.value;recipeFilters.page=1;try{localStorage.setItem('lapinou-recipe-filters',JSON.stringify({type:recipeFilters.type,moment:recipeFilters.moment,service:recipeFilters.service}));}catch{}renderFilteredRecipes();});
$('#recipe-search')?.addEventListener('input',event=>{recipeFilters.query=event.target.value.trim();recipeFilters.page=1;renderFilteredRecipes();});
$('#recipe-missing-filter')?.addEventListener('change',event=>{recipeFilters.missing=event.target.value;recipeFilters.page=1;renderFilteredRecipes();});
$('#open-recipe-import')?.addEventListener('click',()=>setView('import'));
$('#back-to-recipes')?.addEventListener('click',()=>setView('recipes'));
async function refreshRecipes() {
  const list = $('#recipe-list');
  if (!state.household) { list.innerHTML = '<p class="empty">Crée d’abord un foyer pour enregistrer des recettes.</p>'; return; }
  list.innerHTML = '<p class="empty">Chargement des recettes…</p>';
  try {
    await refreshProductionTypes();
    const today=localDateValue(),monthStart=`${today.slice(0,7)}-01`;
    const [{ recipes }, plannedLookup] = await Promise.all([
      api(`/api/recipes?householdId=${encodeURIComponent(state.household.id)}`),
      api(`/api/planning/recipe-ids?householdId=${encodeURIComponent(state.household.id)}&fromDate=${encodeURIComponent(monthStart)}`).then(value=>({value}),error=>({error})),
    ]);
    state.recipes = recipes;
    state.plannedRecipeIds = plannedLookup.value?.recipeIds ?? [];
    state.plannedRecipeLookupError = plannedLookup.error ?? null;
    renderFilteredRecipes();
  } catch (error) {
    const message = document.createElement('p'); message.className = 'empty'; message.textContent = `Liste indisponible : ${error.body?.error ?? error.message}`; list.replaceChildren(message);
  }
}

function emptyMessage(text) { const item = document.createElement('p'); item.className = 'empty'; item.textContent = text; return item; }

async function refreshImportDrafts() {
  const list = $('#recipe-import-list');
  if (!state.household) { list.replaceChildren(emptyMessage('Crée d’abord un foyer.')); return; }
  try {
    const { drafts } = await api(`/api/recipe-imports?householdId=${encodeURIComponent(state.household.id)}`);
    if (!drafts.length) { list.replaceChildren(emptyMessage('Aucun brouillon importé.')); return; }
    list.replaceChildren(...drafts.map((draft) => {
      const row = document.createElement('article'); row.className = 'import-draft';
      const copy = document.createElement('div'); const title = document.createElement('strong'); title.textContent = draft.name || 'Recette importée';
      const details = document.createElement('p'); details.className = 'muted'; details.textContent = `${draft.ingredients.length} ingrédient${draft.ingredients.length === 1 ? '' : 's'} · ${draft.sourcePlatform || draft.sourceKind}${draft.sourceUrl ? ` · ${draft.sourceUrl}` : ''}`; copy.append(title, details);
      const actions = document.createElement('div'); actions.className = 'recipe-card-actions';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = 'Vérifier'; button.addEventListener('click', () => { void openImportDraft(draft); });
      const discard = document.createElement('button'); discard.type = 'button'; discard.className = 'secondary'; discard.textContent = 'Ignorer'; discard.addEventListener('click', async () => {
        try { await api(`/api/recipe-imports/${draft.id}/discarded`, { method: 'POST', body: JSON.stringify({ householdId: state.household.id }) }); await refreshImportDrafts(); }
        catch { showMessage($('#recipe-import-message'), 'Impossible d’ignorer ce brouillon.'); }
      });
      actions.append(button, discard); row.append(copy, actions); return row;
    }));
  } catch { list.replaceChildren(emptyMessage('Impossible de charger les brouillons importés.')); }
}

async function openImportDraft(draft) {
  await setView('recipes');
  const form = $('#recipe-form'); form.reset(); $('#recipe-lines').replaceChildren();
  state.editingRecipeId = null; state.importingDraftId = draft.id;
  state.editingRecipeForDeletion=null;$('#delete-current-recipe')?.classList.add('hidden');
  if($('#recipe-delete-message'))$('#recipe-delete-message').textContent='';
  $('#ignore-import-draft').classList.remove('hidden');
  $('#recipe-form-title').textContent = 'Vérifier la recette importée';
  form.elements.name.value = draft.name || '';
  form.elements.description.value = draft.description || '';
  form.elements.instructions.value = draft.instructions || '';
  form.elements.yieldAmount.value = draft.extractionMethod === 'openai' && draft.yieldAmount == null ? '' : draft.yieldAmount || 1;
  form.elements.yieldUnit.value = draft.yieldUnitId || 'portion';
  form.elements.sourceUrl.value = draft.sourceUrl || '';
  form.elements.servingMode.value = 'original'; updateServingConfiguration();
  for (const line of draft.ingredients) addRecipeLine({ foodName: line.foodName || line.rawText, quantity: line.quantity, unitId: line.unitId || (draft.extractionMethod === 'openai' ? null : toUnitId(line.rawText)), unknownUnit: draft.extractionMethod === 'openai' && !line.unitId });
  const reviewNotes = [...(draft.warnings ?? [])];
  if (draft.variants?.length) reviewNotes.push('Choisis une variante et ajoute ses ingrédients avant d’enregistrer la recette.');
  showMessage($('#recipe-message'), reviewNotes.length ? `À vérifier : ${reviewNotes.join(' ')}` : 'Vérifie le rendement, les quantités et les aliments associés avant d’enregistrer.', true);
  let source = $('#recipe-import-source');
  if (!source) { source = document.createElement('details'); source.id = 'recipe-import-source'; $('#recipe-message').after(source); }
  source.replaceChildren();
  const summary = document.createElement('summary'); summary.textContent = 'Texte original de la recette';
  const original = document.createElement('pre'); original.style.whiteSpace = 'pre-wrap'; original.textContent = typeof draft.original === 'string' ? draft.original : '';
  source.append(summary, original);
  form.classList.remove('hidden'); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toUnitId(value = '') {
  const unit = value.toLowerCase();
  if (/\bkg\b|kilogramme/.test(unit)) return 'kg';
  if (/\bml\b|millilitre/.test(unit)) return 'ml';
  if (/\bl\b|litre/.test(unit)) return 'l';
  if (/c\.?\s*(à\s*)?café|cuillère.*café/.test(unit)) return 'tsp';
  if (/c\.?\s*(à\s*)?soupe|cuillère.*soupe/.test(unit)) return 'tbsp';
  if (/tasse/.test(unit)) return 'cup';
  if (/pièce|œuf|oeuf|gousse|tranche|muffin/.test(unit)) return 'piece';
  return 'g';
}

$('#recipe-import-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!state.household) { showMessage($('#recipe-import-message'), 'Crée d’abord un foyer.'); return; }
  const useAI = form.elements.useAI.checked;
  if (!form.elements.text.value.trim() && !useAI) { showMessage($('#recipe-import-message'), 'Colle le texte de la recette ou active OpenAI pour importer depuis un lien Instagram.'); return; }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = 'Analyse en cours…';
  const generateImageAfterReview=form.elements.generateImage.checked;
  try {
    const result = await api(useAI ? '/api/recipe-imports/ai' : '/api/recipe-imports/text', { method: 'POST', timeoutMs: useAI ? 90_000 : undefined, body: JSON.stringify({ householdId: state.household.id, text: form.elements.text.value, sourceUrl: form.elements.sourceUrl.value || null }) });
    form.reset(); showMessage($('#recipe-import-message'), 'Recette ajoutée aux brouillons. Associe ses ingrédients aux aliments du catalogue.', true);
    await refreshImportDrafts();
    const { drafts } = await api(`/api/recipe-imports?householdId=${encodeURIComponent(state.household.id)}`);
    const draft = drafts.find((item) => item.id === result.drafts?.[0]?.id);
    if (draft) { state.generateImportedImage=generateImageAfterReview; await openImportDraft(draft); }
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      showMessage($('#recipe-import-message'), 'L’analyse a dépassé le délai d’attente. Ton texte est toujours dans le champ : réessaie, ou importe le texte sans OpenAI.');
      return;
    }
    const messages = {
      'instagram-caption-unavailable': 'Instagram ne permet pas de lire la description complète. Colle la description dans le champ texte, puis relance l’analyse.',
      'invalid-instagram-post-url': 'Pour importer avec un lien seul, indique un lien vers une publication ou un reel Instagram. Pour YouTube, colle aussi le texte.',
      'openai-not-configured': 'OpenAI n’est pas configuré sur le serveur. Tu peux importer le texte sans OpenAI.',
      'openai-access-denied': 'La configuration OpenAI doit être vérifiée (clé ou accès au modèle).',
      'openai-rate-limited': 'OpenAI a atteint une limite d’utilisation. Vérifie les crédits et limites, puis réessaie.',
      'openai-timeout': 'OpenAI n’a pas répondu à temps. Le texte est conservé : tu peux réessayer.',
      'openai-invalid-recipe': 'L’analyse n’a pas produit un brouillon suffisamment fiable. Précise le texte ou utilise l’import sans OpenAI.',
    };
    showMessage($('#recipe-import-message'), messages[error.body?.error] || `Import impossible : ${error.body?.error ?? error.message}`);
  } finally { button.disabled = false; button.textContent = 'Analyser et ajouter aux brouillons'; }
});

async function refreshRecipeAIConfig() {
  const checkbox = $('#recipe-import-form').elements.useAI;
  const imageCheckbox=$('#recipe-import-form').elements.generateImage;
  try {
    const config = await api('/api/recipe-imports/config');
    recipeImageConfig={enabled:Boolean(config.imageGenerationEnabled),storage:config.imageStorage};
    renderRecipeImageStorageStatus(config.imageStorage);
    checkbox.disabled = !config.openaiEnabled;
    imageCheckbox.disabled=!recipeImageConfig.enabled;
    $('#recipe-ai-status').textContent = config.openaiEnabled
      ? 'En activant OpenAI, le texte de la recette est envoyé à ton API pour analyse (utilisation facturée sur ton compte). Vérifie le brouillon avant enregistrement.'
      : 'OpenAI n’est pas configuré. L’import par texte reste disponible.';
    $('#recipe-image-ai-status').textContent=recipeImageConfig.enabled?'La génération d’image est facultative. Elle démarre après validation/enregistrement, et peut entraîner des frais OpenAI.':'La génération d’image IA n’est pas configurée. Les photos personnelles restent disponibles.';
  } catch { recipeImageConfig={enabled:false,storage:null};renderRecipeImageStorageStatus(null);checkbox.disabled = true;imageCheckbox.disabled=true; $('#recipe-ai-status').textContent = 'OpenAI indisponible. L’import par texte reste disponible.';$('#recipe-image-ai-status').textContent='OpenAI indisponible. Les photos personnelles restent disponibles.'; }
}

function renderRecipeImageStorageStatus(storage) {
  const target=$('#recipe-image-storage-status');if(!target)return;
  if(!storage){target.textContent='Configuration du stockage indisponible.';return;}
  if(storage.mode==='database'){target.textContent='Stockage actuel : base PostgreSQL. Aucun dossier RECIPE_IMAGE_DIR n’est configuré.';return;}
  const directory=storage.directory||'/images';
  if(storage.mounted===false){target.textContent=`Attention : ${directory} n’est pas un volume monté dans le conteneur ; les images risquent de disparaître lors de son remplacement.`;return;}
  if(storage.writable===false){target.textContent=`Attention : ${directory} est configuré, mais le serveur ne peut pas y écrire. Vérifie les droits du dossier monté.`;return;}
  target.textContent=`Stockage configuré : ${directory} dans le conteneur${storage.mounted===true?` (volume monté sur ${storage.mountPoint})`:''}${storage.writable===true?' ; écriture autorisée.':'.'}`;
}

function refreshRecipeImagePreview() {
  const image=$('#recipe-image-preview'),placeholder=$('#recipe-image-placeholder');
  if(!imageRecipeId){image.classList.add('hidden');placeholder.classList.remove('hidden');return;}
  const recipe=state.recipes.find(item=>item.id===imageRecipeId);
  if(!recipe?.imageAvailable){image.removeAttribute('src');image.classList.add('hidden');placeholder.classList.remove('hidden');return;}
  image.src=`/api/recipes/${imageRecipeId}/image?householdId=${encodeURIComponent(state.household.id)}&v=${Date.now()}`;
  image.classList.remove('hidden');placeholder.classList.add('hidden');
}
function openRecipeImageEditor(recipe){
  imageRecipeId=recipe.id;$('#recipe-image-title').textContent=`Photo · ${recipe.name}`;
  $('#generate-recipe-image').disabled=!recipeImageConfig.enabled;$('#recipe-image-file').value='';
  showMessage($('#recipe-image-message'),recipeImageConfig.enabled?'Choisis une photo, ou demande une illustration IA. Une nouvelle image remplacera l’actuelle.':'Choisis une photo personnelle. La génération IA n’est pas configurée.');
  refreshRecipeImagePreview();$('#recipe-image-dialog').showModal();
}
function recipeImageErrorMessage(error){
  const body=error.body??{},code=String(body.providerCode??'').toLowerCase();
  const detail={
    invalid_api_key:'La clé API OpenAI est invalide ou révoquée. Vérifie la clé OPENAI_API_KEY utilisée par le conteneur.',
    ip_not_authorized:'L’adresse IP du serveur Lapinou Dish n’est pas autorisée pour ce projet OpenAI.',
    organization_verification_required:'OpenAI demande la vérification de l’organisation API pour les modèles image. Vérifie l’organisation sélectionnée dans la plateforme API, pas seulement ton profil personnel.',
    organization_not_verified:'L’organisation API utilisée par cette clé n’est pas vérifiée ou son statut n’a pas encore été actualisé.',
    model_not_found:'Le projet API n’a pas accès au modèle image configuré. Vérifie OPENAI_IMAGE_MODEL et les accès du projet.',
    permission_denied:'La clé ou le projet OpenAI n’a pas la permission d’appeler le modèle image.',
    unsupported_country_region_territory:'L’API OpenAI indique que la région de sortie du serveur n’est pas prise en charge.',
  }[code];
  const fallback=body.providerStatus===401?'OpenAI refuse l’authentification : vérifie la clé API du conteneur et le projet associé.':body.providerStatus===403?'OpenAI refuse l’accès : vérifie l’organisation API, ses autorisations et l’accès au modèle image.':body.error??error.message;
  return `${detail??fallback}${body.providerStatus?` (HTTP ${body.providerStatus}${code?`, ${code}`:''})`:''}${body.requestId?` · Requête OpenAI ${body.requestId}`:''}`;
}
$('#close-recipe-image')?.addEventListener('click',()=>$('#recipe-image-dialog').close());
$('#recipe-image-file')?.addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file||!imageRecipeId)return;
  if(file.size>15*1024*1024){showMessage($('#recipe-image-message'),'Image trop volumineuse. Choisis un fichier de moins de 15 Mo.');return;}
  try{
    const bitmap=await createImageBitmap(file),scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.84));if(!blob)throw new Error('conversion-failed');
    if(blob.size>5*1024*1024)throw new Error('image-too-large');
    const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    showMessage($('#recipe-image-message'),'Enregistrement de la photo…');
    const result=await api(`/api/recipes/${imageRecipeId}/image`,{method:'PUT',body:JSON.stringify({householdId:state.household.id,mediaType:'image/jpeg',imageBase64:btoa(binary)})});
    if(result.storage)renderRecipeImageStorageStatus(result.storage);
    const recipe=state.recipes.find(item=>item.id===imageRecipeId);if(recipe)recipe.imageAvailable=true;renderFilteredRecipes();refreshRecipeImagePreview();showMessage($('#recipe-image-message'),imageSavedMessage('Photo personnelle enregistrée.',result.storage),true);
  }catch(error){showMessage($('#recipe-image-message'),error.message==='image-too-large'?'Photo encore trop volumineuse après redimensionnement.':`Impossible d’enregistrer la photo : ${error.body?.error??error.message}`);}
  finally{event.target.value='';}
});
$('#generate-recipe-image')?.addEventListener('click',async()=>{
  if(!imageRecipeId)return;const button=$('#generate-recipe-image');button.disabled=true;
  showMessage($('#recipe-image-message'),'Création de l’illustration… cela peut prendre un peu de temps.');
  try{const result=await api(`/api/recipes/${imageRecipeId}/image/ai`,{method:'POST',body:JSON.stringify({householdId:state.household.id}),signal:AbortSignal.timeout(100_000)});if(result.storage)renderRecipeImageStorageStatus(result.storage);const recipe=state.recipes.find(item=>item.id===imageRecipeId);if(recipe)recipe.imageAvailable=true;renderFilteredRecipes();refreshRecipeImagePreview();showMessage($('#recipe-image-message'),imageSavedMessage('Illustration créée.',result.storage)+' Tu peux la remplacer quand tu veux.',true);}
  catch(error){showMessage($('#recipe-image-message'),`Illustration non créée : ${recipeImageErrorMessage(error)}`);}
  finally{button.disabled=!recipeImageConfig.enabled;}
});
function imageSavedMessage(label,storage) {
  if(storage?.mode==='database')return `${label} Enregistrée dans PostgreSQL (aucun dossier de fichiers configuré).`;
  if(storage?.mode==='filesystem')return `${label} Enregistrée dans ${storage.directory} dans le conteneur.`;
  return label;
}
$('#delete-recipe-image')?.addEventListener('click',async()=>{
  if(!imageRecipeId)return;
  try{await api(`/api/recipes/${imageRecipeId}/image?householdId=${encodeURIComponent(state.household.id)}`,{method:'DELETE'});const recipe=state.recipes.find(item=>item.id===imageRecipeId);if(recipe)recipe.imageAvailable=false;renderFilteredRecipes();refreshRecipeImagePreview();showMessage($('#recipe-image-message'),'Photo supprimée.',true);}
  catch(error){showMessage($('#recipe-image-message'),`Impossible de supprimer la photo : ${error.body?.error??error.message}`);}
});

$('#recipe-archive-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  if (!state.household) { showMessage($('#recipe-archive-message'), 'Crée d’abord un foyer.'); return; }
  if (file.size > 6_500_000) { showMessage($('#recipe-archive-message'), 'Archive trop volumineuse (limite : 6,5 Mo).'); return; }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const result = await api('/api/recipe-imports/archive', { method: 'POST', body: JSON.stringify({ householdId: state.household.id, archiveBase64: btoa(binary) }) });
    showMessage($('#recipe-archive-message'), `${result.imported} recette(s) importée(s), ${result.duplicates} déjà présente(s), ${result.skipped} fiche(s) sans ingrédient ignorée(s).`, true);
    await refreshImportDrafts();
  } catch (error) { showMessage($('#recipe-archive-message'), `Import impossible : ${error.body?.error ?? error.message}`); }
  finally { event.target.value = ''; }
});

async function requestRecipeDeletion(recipe,button,message){
  if(button.disabled||!state.household)return;
  if(!confirm(`Supprimer définitivement « ${recipe.name} » et ses éventuelles parties de service ? Une recette utilisée dans un menu ou un historique de production sera conservée.`))return;
  button.disabled=true;showMessage(message,'Suppression…');
  try{
    const result=await api(`/api/recipes/${recipe.id}`,{method:'DELETE',body:JSON.stringify({householdId:state.household.id,version:recipe.version})});
    state.recipes=state.recipes.filter(item=>item.id!==recipe.id);
    if(state.editingRecipeId===recipe.id){state.editingRecipeId=null;state.editingRecipeForDeletion=null;$('#recipe-form').classList.add('hidden');$('#recipe-result').classList.add('hidden');}
    renderFilteredRecipes();
    showMessage($('#recipe-list-message'),`« ${recipe.name} » a été supprimée.${result.imageCleanupPending?' Un fichier photo n’a pas pu être nettoyé.':''}`,!result.imageCleanupPending);
    await refreshRecipes();
  }catch(error){
    const body=error.body??{};
    const reason=body.error==='recipe-in-use'
      ?`Cette recette est encore utilisée.${body.meals?' Retire-la ou remplace-la dans les menus concernés.':''}${body.productions?' Son historique de production est conservé.':''}${body.recipes?.length?' Elle est un ingrédient de : '+body.recipes.map(r=>r.name).join(', ')+'.':''}`
      :body.error==='recipe-version-conflict'?'Cette recette a changé depuis son affichage. Actualise la liste avant de la supprimer.'
      :body.error==='recipe-not-found'?'Cette recette n’est plus disponible. Actualise la liste.'
      :'La suppression n’a pas abouti. Réessaie après avoir vérifié la connexion.';
    showMessage(message,`Suppression impossible : ${reason}`);button.disabled=false;
  }
}

function recipeCard(recipe) {
  const card = document.createElement('article'); card.className = 'recipe-card';card.dataset.recipeId=recipe.id;
  const header=document.createElement('div');header.className='recipe-row-header';
  const visual=document.createElement('div');visual.className='recipe-card-visual';
  if(recipe.imageAvailable){const image=document.createElement('img');image.src=`/api/recipes/${recipe.id}/image?householdId=${encodeURIComponent(state.household.id)}&v=${recipe.version}`;image.alt='';image.loading='lazy';visual.append(image);}
  else {const placeholder=document.createElement('span');placeholder.textContent='Photo';visual.append(placeholder);}
  const identity=document.createElement('div');identity.className='recipe-row-identity';
  const title=document.createElement('h3');title.textContent=recipe.name;
  const categoryLabel=typeof state!=='undefined'?state.mealAdditions?.find(item=>item.recipeType===recipe.recipeType)?.label:null;
  const subtitle=document.createElement('p');subtitle.textContent=`${categoryLabel??recipeTypeLabel(recipe.recipeType)} · ${recipe.lines.length} ingrédient${recipe.lines.length===1?'':'s'} · ${format(recipe.yield.amount)} ${recipe.yield.unitId}`;
  const serviceDescription=document.createElement('p');serviceDescription.className='recipe-service-label';serviceDescription.textContent=recipeServiceChoices.find(([value])=>value===recipeServiceMode(recipe))?.[1]??'';
  const heading=document.createElement('div');heading.className='recipe-title-row';
  const rename=document.createElement('button');rename.type='button';rename.className='text-button recipe-rename-button';rename.textContent='Renommer';rename.setAttribute('aria-label',`Renommer ${recipe.name}`);rename.setAttribute('aria-expanded','false');
  heading.append(title,rename);
  const renameEditor=document.createElement('div');renameEditor.className='recipe-rename-editor';renameEditor.hidden=true;
  const nameLabel=document.createElement('label');nameLabel.textContent='Titre de la recette';const nameInput=document.createElement('input');nameInput.type='text';nameInput.required=true;nameInput.maxLength=200;nameInput.value=recipe.name;nameLabel.append(nameInput);
  const renameActions=document.createElement('div');renameActions.className='form-actions';
  const renameSave=document.createElement('button');renameSave.type='button';renameSave.className='secondary';renameSave.textContent='Enregistrer le titre';
  const renameCancel=document.createElement('button');renameCancel.type='button';renameCancel.className='secondary';renameCancel.textContent='Annuler';
  const renameStatus=document.createElement('p');renameStatus.className='form-message';renameStatus.setAttribute('role','status');
  renameActions.append(renameSave,renameCancel);renameEditor.append(nameLabel,renameActions,renameStatus);
  const closeRename=()=>{renameEditor.hidden=true;rename.setAttribute('aria-expanded','false');nameInput.value=recipe.name;renameStatus.textContent='';rename.focus();};
  rename.addEventListener('click',()=>{renameEditor.hidden=false;rename.setAttribute('aria-expanded','true');nameInput.value=recipe.name;nameInput.focus();nameInput.select();});
  renameCancel.addEventListener('click',closeRename);
  const saveName=async()=>{
    if(renameSave.disabled)return;
    const name=nameInput.value.trim();if(!name){nameInput.setCustomValidity('Saisis un titre.');nameInput.reportValidity();return;}nameInput.setCustomValidity('');if(!nameInput.reportValidity())return;
    if(name===recipe.name){closeRename();return;}
    renameSave.disabled=true;renameCancel.disabled=true;nameInput.disabled=true;renameStatus.textContent='Enregistrement…';
    try{
      const result=await api(`/api/recipes/${recipe.id}`,{method:'PATCH',body:JSON.stringify({householdId:state.household.id,version:recipe.version,name})});
      Object.assign(recipe,result.recipe);await refreshRecipes();showMessage($('#recipe-list-message'),`Titre enregistré : « ${recipe.name} ».`,true);
      $('#recipe-list [data-recipe-id="'+recipe.id+'"] .recipe-rename-button')?.focus();
      await Promise.allSettled([refreshShopping(),refreshDashboard()]);
    }catch(error){renameStatus.textContent=error.body?.error==='recipe-version-conflict'?'Recette modifiée ailleurs. Actualise la liste avant de renommer.':`Titre non enregistré : ${error.body?.error??error.message}`;}
    finally{renameSave.disabled=false;renameCancel.disabled=false;nameInput.disabled=false;}
  };
  nameInput.addEventListener('input',()=>nameInput.setCustomValidity(''));
  nameInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();saveName();}if(event.key==='Escape'&&!renameSave.disabled){event.preventDefault();closeRename();}});
  renameSave.addEventListener('click',saveName);
  identity.append(heading,renameEditor,subtitle,serviceDescription);
  const nutrition=document.createElement('p');nutrition.className='recipe-nutrition';
  nutrition.textContent=`${format(recipe.nutrition.perYieldUnit.energyKcal)} kcal · P ${format(recipe.nutrition.perYieldUnit.proteinG)} g / ${recipe.yield.unitId}`;
  const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Modifier';edit.setAttribute('aria-label',`Modifier ${recipe.name}`);edit.addEventListener('click',()=>openRecipeEditor(recipe.id));
  const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='secondary';duplicate.textContent='Dupliquer';duplicate.setAttribute('aria-label',`Dupliquer ${recipe.name}`);duplicate.addEventListener('click',()=>openRecipeEditor(recipe.id,true));
  const photo=document.createElement('button');photo.type='button';photo.className='secondary';photo.textContent='Photo';photo.addEventListener('click',()=>openRecipeImageEditor(recipe));
  const cook=document.createElement('button');cook.type='button';cook.className='secondary';cook.textContent='Cuisiner';cook.setAttribute('aria-label',`Cuisiner ${recipe.name}`);cook.addEventListener('click',async()=>{
    cook.disabled=true;cook.textContent='Cuisiner';
    try{
      const start=$('#shopping-start').value||localDateValue(),end=$('#shopping-end').value||addDays(start,29);
      const {preparations}=await api(`/api/household-planning/preparations?householdId=${encodeURIComponent(state.household.id)}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
      const planned=groupPreparations(preparations).find(group=>group.recipeId===recipe.id)??{parts:[]};
      openCookingSheet(recipe.id,suggestedProductionQuantity(planned,recipe),undefined,planned,planned.parts.length?'menus':'free');
    }catch{
      openCookingSheet(recipe.id,0,undefined,{parts:[],unavailable:true},'free');
      showMessage($('#cook-message'),'Les besoins des menus sont indisponibles. La préparation hors menus reste disponible.');
    }
    finally{cook.disabled=false;}
  });
  const removalMessage=document.createElement('p');removalMessage.className='form-message';removalMessage.setAttribute('role','status');
  const remove=document.createElement('button');remove.type='button';remove.className='secondary danger-button';remove.textContent='Supprimer';remove.setAttribute('aria-label',`Supprimer ${recipe.name}`);
  remove.addEventListener('click',()=>requestRecipeDeletion(recipe,remove,removalMessage));
  const actions=document.createElement('div');actions.className='recipe-card-actions';actions.append(photo,cook,duplicate,edit,remove);
  header.append(visual,identity,nutrition,actions);card.append(header);
  card.append(removalMessage);
  const missing=recipeMissingData(recipe);
  if(missing.length){const badges=document.createElement('p');badges.className='recipe-missing-badges';for(const item of missing){const badge=document.createElement('span');badge.textContent=item.label;badges.append(badge);}card.append(badges);}
  const settings=document.createElement('div');settings.className='recipe-row-settings';
  const production=document.createElement('label');production.textContent='Production à suivre';
  const select=document.createElement('select');select.setAttribute('aria-label',`Production à suivre pour ${recipe.name}`);
  populateProductionTypeSelect(select,recipe.productionType??'none');production.append(select);
  const moments=document.createElement('fieldset');moments.className='recipe-row-moments';
  const legend=document.createElement('legend');legend.textContent='Moments adaptés';moments.append(legend);
  for(const [value,label] of Object.entries({breakfast:'Petit-déjeuner',lunch:'Déjeuner',dinner:'Dîner',snack:'Collation'})){
    const item=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=value;checkbox.checked=(recipe.mealMoments??[]).includes(value);
    item.append(checkbox,document.createTextNode(label));moments.append(item);
  }
  const save=document.createElement('button');save.type='button';save.className='secondary recipe-row-save';save.textContent='Enregistrer';save.disabled=true;
  const status=document.createElement('span');status.className='recipe-row-status';status.setAttribute('role','status');
  const config=document.createElement('fieldset');config.className='recipe-quick-configuration';
  const configLegend=document.createElement('legend');configLegend.textContent='Service et rendement';config.append(configLegend);
  const makeControl=(text,control)=>{const label=document.createElement('label');label.append(document.createTextNode(text),control);config.append(label);return control;};
  const mode=makeControl('Type de service',document.createElement('select'));mode.setAttribute('aria-label',`Service pour ${recipe.name}`);
  for(const [value,label] of recipeServiceChoices){const option=document.createElement('option');option.value=value;option.textContent=label;option.disabled=['separate','three'].includes(value)&&!['dish','salad'].includes(recipe.recipeType);mode.append(option);}
  mode.value=recipeServiceMode(recipe);
  const amount=makeControl('Nombre / quantité de base',document.createElement('input'));amount.type='number';amount.min='0.001';amount.max='100000';amount.step='any';amount.required=true;amount.value=String(recipe.yield.amount);
  const unit=makeControl('Unité du rendement',document.createElement('select'));
  for(const [value,label] of [['portion','portions'],['piece','pièces'],['slice','tranches'],['g','grammes'],['ml','millilitres']]){const option=document.createElement('option');option.value=value;option.textContent=label;unit.append(option);}
  unit.value=recipe.yield.unitId;
  const assignments=document.createElement('details');assignments.className='recipe-quick-assignments';const assignmentTitle=document.createElement('summary');assignmentTitle.textContent='Affectation des ingrédients et cuisson';assignments.append(assignmentTitle);config.append(assignments);
  const factorSelects=[];
  const partSelects=recipe.lines.map(line=>{
    const row=document.createElement('div');row.className='recipe-quick-ingredient';
    const name=document.createElement('strong');name.textContent=line.foodName??'Préparation maison';
    const label=document.createElement('label'),input=document.createElement('select');input.className='recipe-quick-part';label.append(document.createTextNode('Partie servie'),input);
    const factorLabel=document.createElement('label'),factor=document.createElement('select');factor.className='recipe-quick-factor';factor.setAttribute('aria-label',`Coefficient de cuisson de ${name.textContent}`);
    if(line.recipeId){const option=document.createElement('option');option.value='1';option.textContent='Déjà préparé — ×1';factor.append(option);factor.value='1';factor.disabled=true;}
    else fillCookingFactorOptions(factor,ingredientCookingFactor(recipe,line),document,state.foodYieldConversions.filter(item=>item.sourceFoodId===line.foodId));
    factorLabel.append(document.createTextNode('Coefficient de cuisson'),factor);factorSelects.push(factor);
    row.append(name,label,factorLabel);assignments.append(row);return input;
  });
  let previousMode=mode.value;
  const configureParts=()=>{
    const split=['separate','three'].includes(mode.value);assignments.hidden=false;partSelects.forEach(input=>input.parentElement.hidden=!split);
    partSelects.forEach((input,index)=>{const previous=input.value||recipe.lines[index].servingPart||'main';input.replaceChildren();for(const [value,text] of [['main',mode.value==='three'?'Viande / protéines et sauce':'Viande et légumes'],['vegetables','Légumes'],['starch','Féculents']]){if(value==='vegetables'&&mode.value!=='three')continue;const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}input.value=[...input.options].some(option=>option.value===previous)?previous:'main';});
    if(split&&mode.value!==previousMode)assignments.open=true;previousMode=mode.value;
  };configureParts();
  const configuration=()=>({servingMode:mode.value,yield:{amount:Number(amount.value),unitId:unit.value},lineCookingFactors:factorSelects.map(input=>Number(input.value)),lineParts:partSelects.map(input=>['separate','three'].includes(mode.value)?input.value:'main')});
  let savedConfiguration=JSON.stringify(configuration());
  const currentMoments=()=>[...moments.querySelectorAll('input:checked')].map(input=>input.value);
  const isDirty=()=>select.value!==(recipe.productionType??'none')||JSON.stringify(currentMoments().sort())!==JSON.stringify([...(recipe.mealMoments??[])].sort())||JSON.stringify(configuration())!==savedConfiguration;
  const updateDirty=()=>{save.disabled=!isDirty();status.textContent=save.disabled?'':'Modifications non enregistrées';};
  select.addEventListener('change',updateDirty);moments.addEventListener('change',updateDirty);config.addEventListener('input',updateDirty);config.addEventListener('change',updateDirty);mode.addEventListener('change',()=>{configureParts();updateDirty();});
  save.addEventListener('click',async()=>{
    if(!amount.reportValidity())return;
    const changed=JSON.stringify(configuration())!==savedConfiguration;
    const payload={householdId:state.household.id,version:recipe.version,productionType:select.value,mealMoments:currentMoments(),...(changed?{configuration:configuration()}:{})};
    save.disabled=true;select.disabled=true;moments.disabled=true;config.disabled=true;status.textContent='Enregistrement…';
    try{
      const result=await api(`/api/recipes/${recipe.id}`,{method:'PATCH',body:JSON.stringify(payload)});
      Object.assign(recipe,result.recipe);savedConfiguration=JSON.stringify(configuration());status.textContent='Enregistré';
      const index=state.recipes.findIndex(item=>item.id===recipe.id);if(index!==-1)state.recipes[index]=recipe;
      await refreshRecipes();
      showMessage($('#recipe-list-message'),`Réglages de « ${recipe.name} » enregistrés.`,true);
      await Promise.allSettled([refreshShopping(),refreshDashboard()]);
    }catch(error){const code=error.body?.error;status.textContent=({
      'recipe-version-conflict':'Recette modifiée ailleurs. Actualise la liste.',
      'recipe-used-in-prepared-meal':'Repas déjà préparé : change d’abord son état.',
      'recipe-output-in-use':'Unité utilisée dans un historique : crée une variante.',
      'starch-ingredients-required':'Affecte au moins un ingrédient aux féculents.',
      'vegetable-ingredients-required':'Affecte au moins un ingrédient aux légumes.',
      'invalid-serving-parts':'Vérifie l’affectation : chaque partie doit contenir un ingrédient.',
      'serving-parts-cannot-be-disabled':'Cette recette a plusieurs parties : conserve le service séparé ou crée une variante.',
      'serving-part-removal-not-supported':'Une partie existante ne peut pas être retirée : crée une variante.',
      'serving-weight-conversion-required':'Complète les équivalences de poids des ingrédients dans leur fiche.'
    })[code]??`Échec : ${code??error.message}`;}
    finally{select.disabled=false;moments.disabled=false;config.disabled=false;save.disabled=!isDirty();}
  });
  settings.append(production,config,moments,save,status);
  const settingsDetails=document.createElement('details');settingsDetails.className='recipe-card-settings';const settingsSummary=document.createElement('summary');settingsSummary.textContent='Réglages rapides';settingsDetails.append(settingsSummary,settings);card.append(settingsDetails);
  const more=document.createElement('details');more.className='recipe-row-more';
  const summary=document.createElement('summary');summary.textContent=recipe.nutrition.complete?'Détails nutritionnels et portions':`Détails · ${recipe.nutrition.lineIssues?.length??0} point(s) à vérifier`;
  more.append(summary);
  const details=document.createElement('div');details.className='recipe-row-more-content';
  if (recipe.servingParts?.length) {
    const weights=document.createElement('p'); weights.className='muted'; weights.textContent='Poids estimés du batch : '+recipe.servingParts.map(part=>`${part.servingPart==='starch'?'féculents':part.servingPart==='vegetables'?'légumes':recipe.servingParts.length>2?'viande / protéines':recipe.servingParts.length>1?'viande et légumes':'plat entier'} ${formatQty(part.yield.amount)} g`).join(' · '); details.append(weights);
  }
  const macros=document.createElement('p');macros.textContent=`${format(recipe.nutrition.perYieldUnit.energyKcal)} kcal · P ${format(recipe.nutrition.perYieldUnit.proteinG)} g · G ${format(recipe.nutrition.perYieldUnit.carbohydrateG)} g · L ${format(recipe.nutrition.perYieldUnit.fatG)} g / ${recipe.yield.unitId}`;details.append(macros);
  if (recipe.nutrition.unresolvedLineIndexes?.length) {
    const partial = document.createElement('p'); partial.className = 'muted'; partial.textContent = 'Sous-total partiel : les ingrédients sans conversion sont exclus.'; details.append(partial);
  }
  if (!recipe.nutrition.complete) details.append(nutritionIssues(recipe));
  more.append(details);card.append(more);return card;
}

function renderRecipe(recipe) {
  const result = $('#recipe-result'); result.classList.remove('hidden'); result.replaceChildren();
  const title = document.createElement('h3'); title.textContent = `${recipe.name} · ${recipe.yield.amount} ${recipe.yield.unitId}`; result.append(title);
  if (recipe.nutrition.unresolvedLineIndexes?.length) {
    const partial = document.createElement('p'); partial.className = 'warning';
    partial.textContent = `Sous-total partiel : calculé avec ${recipe.nutrition.calculatedLineIndexes?.length ?? 0} ingrédient(s) convertible(s). Les autres sont exclus tant que leur poids n’est pas connu.`;
    result.append(partial);
  }
  const grid = document.createElement('div'); grid.className = 'nutrition-grid';
  const rows = [['Énergie', recipe.nutrition.perYieldUnit.energyKcal, 'kcal'], ['Protéines', recipe.nutrition.perYieldUnit.proteinG, 'g'], ['Glucides', recipe.nutrition.perYieldUnit.carbohydrateG, 'g'], ['Lipides', recipe.nutrition.perYieldUnit.fatG, 'g'], ['Fibres', recipe.nutrition.perYieldUnit.fibreG, 'g']];
  for (const [label, value, unit] of rows) { const cell = document.createElement('div'); const caption = document.createElement('span'); caption.textContent = `${label} par ${recipe.yield.unitId}`; const amount = document.createElement('strong'); amount.textContent = value == null ? 'Inconnu' : `${format(value)} ${unit}`; cell.append(caption, amount); grid.append(cell); }
  result.append(grid);
  if (!recipe.nutrition.complete) {
    const warning = document.createElement('p'); warning.className = 'warning'; warning.textContent = 'Calcul incomplet : les données nutritionnelles inconnues ne sont pas remplacées par zéro.'; result.append(warning);
    result.append(nutritionIssues(recipe));
  }
  const batch = document.createElement('p'); batch.className = 'muted'; batch.textContent = `${recipe.nutrition.unresolvedLineIndexes?.length ? 'Sous-total calculable' : 'Total de la recette'} : ${format(recipe.nutrition.batch.energyKcal)} kcal`; result.append(batch);
}

function nutritionIssues(recipe) {
  const list = document.createElement('ul'); list.className = 'nutrition-issues';
  const nutrientNames = { energyKcal: 'énergie', proteinG: 'protéines', carbohydrateG: 'glucides', fatG: 'lipides', fibreG: 'fibres' };
  for (const issue of recipe.nutrition.lineIssues ?? []) {
    const line = recipe.lines[issue.lineIndex];
    const item = document.createElement('li');
    const name = line?.recipeName || line?.foodName || `Ingrédient ${issue.lineIndex + 1}`;
    if(issue.reason==='component-data-missing')item.textContent=name+' : données incomplètes dans la préparation liée.';
    else if (issue.reason === 'unit-conversion-missing') item.textContent = `${name} (${format(line.quantity)} ${line.unitId}) : conversion en grammes inconnue pour cet aliment.`;
    else if (issue.reason === 'food-not-linked') item.textContent = `${name} : aucun aliment du catalogue associé.`;
    else item.textContent = `${name} : valeur${issue.missingNutrients.length > 1 ? 's' : ''} manquante${issue.missingNutrients.length > 1 ? 's' : ''} pour ${issue.missingNutrients.map((key) => nutrientNames[key] ?? key).join(', ')}.`;
    list.append(item);
  }
  if (!list.childElementCount) { const item = document.createElement('li'); item.textContent = 'Vérifie les conversions et les valeurs nutritionnelles des aliments.'; list.append(item); }
  return list;
}

function mealRatiosFromForm() {
  const form=$('#meal-ratios-form');
  return Object.fromEntries(MEAL_ORDER.map(slot=>[slot,form.elements[slot].value === '' ? NaN : Number(form.elements[slot].value)/100]));
}
function updateMealRatiosPreview() {
  const ratios=mealRatiosFromForm(),total=MEAL_ORDER.reduce((sum,slot)=>sum+ratios[slot],0)*100;
  $('#meal-ratios-total').textContent=Number.isFinite(total)?`Total : ${format(total)} %${validMealRatios(ratios)?' ✓':' — ajuste les valeurs pour atteindre 100 %'}`:'Renseigne les cinq pourcentages.';
  $('#meal-ratios-form button[type="submit"]').disabled=!validMealRatios(ratios);
  const root=$('#meal-ratios-preview');root.replaceChildren();
  if(!validMealRatios(ratios))return;
  const heading=document.createElement('h3');heading.textContent='Objectifs par personne';root.append(heading);
  for(const person of state.people){
    const daily=latestProfile(person,localDateValue())?.dailyEnergyKcal;
    const line=document.createElement('p');
    line.textContent=daily?`${person.displayName} · ${format(daily)} kcal/j : `+MEAL_ORDER.map(slot=>`${MEAL_LABELS[slot]} ${format(daily*ratios[slot])} kcal`).join(' · '):`${person.displayName} : besoin quotidien à renseigner dans le profil.`;
    root.append(line);
  }
}
function resetFoodYieldForm(){const form=$('#food-yield-form');form.reset();form.elements.id.value='';form.elements.sourceFoodId.value='';form.elements.targetFoodId.value='';$('button[type="submit"]',form).textContent='Ajouter la conversion';$('#cancel-food-yield-edit').classList.add('hidden');}
function selectYieldFood(form,key,id,name){form.elements[`${key}FoodId`].value=id;form.elements[`${key}FoodName`].value=name;}
async function searchYieldFoods(key){
  const form=$('#food-yield-form'),input=form.elements[`${key}FoodName`],idField=form.elements[`${key}FoodId`],list=$(`#yield-${key}-options`),query=input.value.trim();
  idField.value='';if(query.length<2){list.replaceChildren();return;}
  try{const result=await api(`/api/foods?q=${encodeURIComponent(query)}&limit=20`);if(input.value.trim()!==query)return;list.replaceChildren(...result.foods.map(food=>{const option=document.createElement('option');option.value=food.name;option.dataset.id=food.id;return option;}));
    const match=[...list.options].find(option=>option.value===query);if(match)idField.value=match.dataset.id;
  }catch{/* Search suggestions are optional; the form reports a missing selection on save. */}
}
for(const key of ['source','target'])$('#food-yield-form').elements[`${key}FoodName`].addEventListener('input',()=>{const form=$('#food-yield-form');form.elements[`${key}FoodId`].value='';clearTimeout(form.dataset[`${key}SearchTimer`]);form.dataset[`${key}SearchTimer`]=setTimeout(()=>searchYieldFoods(key),250);});
function renderFoodYieldConversions(){
  const root=$('#food-yield-conversions');root.replaceChildren();if(!state.foodYieldConversions.length){root.append(emptyMessage('Aucune conversion de rendement définie pour ce foyer.'));return;}
  for(const conversion of state.foodYieldConversions){
    const row=document.createElement('article');row.className='food-yield-conversion';const info=document.createElement('div'),title=document.createElement('strong'),factor=document.createElement('span');
    title.textContent=`${conversion.sourceFoodName} → ${conversion.targetFoodName}`;factor.className='muted';factor.textContent=`1 g → ${format(conversion.factor)} g`;info.append(title,factor);
    const actions=document.createElement('div'),edit=document.createElement('button');actions.className='food-yield-conversion-actions';edit.type='button';edit.className='secondary';edit.textContent='Modifier';edit.addEventListener('click',()=>{const form=$('#food-yield-form');form.elements.id.value=conversion.id;form.elements.factor.value=String(conversion.factor);selectYieldFood(form,'source',conversion.sourceFoodId,conversion.sourceFoodName);selectYieldFood(form,'target',conversion.targetFoodId,conversion.targetFoodName);$('button[type="submit"]',form).textContent='Enregistrer la conversion';$('#cancel-food-yield-edit').classList.remove('hidden');form.elements.factor.focus();});
    const remove=document.createElement('button');remove.type='button';remove.className='secondary danger-button';remove.textContent='Supprimer';remove.addEventListener('click',async()=>{if(!confirm(`Supprimer la conversion « ${conversion.sourceFoodName} → ${conversion.targetFoodName} » ?`))return;remove.disabled=true;try{await api(`/api/household-food-yields?householdId=${encodeURIComponent(state.household.id)}&id=${encodeURIComponent(conversion.id)}`,{method:'DELETE'});await refreshFoodYieldConversions();await refreshRecipes();showMessage($('#food-yield-message'),'Conversion supprimée.',true);}catch(error){showMessage($('#food-yield-message'),`Suppression impossible : ${error.body?.error??error.message}`);remove.disabled=false;}});
    actions.append(edit,remove);row.append(info,actions);root.append(row);
  }
}
async function refreshFoodYieldConversions(){
  const form=$('#food-yield-form'),root=$('#food-yield-conversions');if(!state.household){state.foodYieldConversions=[];form.querySelectorAll('input,button').forEach(control=>control.disabled=true);root.replaceChildren(emptyMessage('Crée un foyer pour gérer ses conversions alimentaires.'));return;}
  form.querySelectorAll('input,button').forEach(control=>control.disabled=false);
  try{const result=await api(`/api/household-food-yields?householdId=${encodeURIComponent(state.household.id)}`);state.foodYieldConversions=result.conversions;renderFoodYieldConversions();}catch(error){root.replaceChildren(emptyMessage(`Conversions indisponibles : ${error.body?.error??error.message}`));}
}
$('#cancel-food-yield-edit').addEventListener('click',resetFoodYieldForm);
$('#food-yield-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,message=$('#food-yield-message');if(!state.household||!form.reportValidity())return;
  for(const key of ['source','target'])if(!form.elements[`${key}FoodId`].value)await searchYieldFoods(key);
  if(!form.elements.sourceFoodId.value||!form.elements.targetFoodId.value){showMessage(message,'Choisis chaque aliment parmi les suggestions de recherche.');return;}
  const save=$('button[type="submit"]',form);save.disabled=true;
  try{await api('/api/household-food-yields',{method:'PUT',body:JSON.stringify({householdId:state.household.id,id:form.elements.id.value||undefined,sourceFoodId:form.elements.sourceFoodId.value,targetFoodId:form.elements.targetFoodId.value,factor:Number(form.elements.factor.value)})});resetFoodYieldForm();await refreshFoodYieldConversions();await refreshRecipes();showMessage(message,'Conversion enregistrée. Les recettes déjà enregistrées gardent leurs coefficients actuels.',true);}
  catch(error){showMessage(message,error.body?.error==='food-yield-already-defined'?'Une conversion existe déjà pour cet aliment de départ.':`Enregistrement impossible : ${error.body?.error??error.message}`);}finally{save.disabled=false;}
});
const ADDITION_RECIPE_TYPES=[['accompaniment','Accompagnement'],['salad','Salade'],['beverage','Boisson'],['sauce','Sauce'],['dessert','Dessert']];
const ADDITION_ROLE_LABELS={main:'Plat principal',accompaniment:'Accompagnement',beverage:'Boisson',dessert:'Dessert',sauce:'Sauce'};
function roleForRecipeType(type){return type==='salad'?'accompaniment':type;}
function mealAdditionById(id){return state.mealAdditions.find(item=>item.id===id)??null;}
function mealAdditionRole(id){return mealAdditionById(id)?.role??roleForRecipeType(mealAdditionById(id)?.recipeType??id);}
function mealAdditionLabel(id){return mealAdditionById(id)?.label??ADDITION_ROLE_LABELS[id]??id;}
function renderMealAdditionCategories(additions=state.mealAdditions){
  const root=$('#meal-addition-categories');root.replaceChildren();
  for(const addition of additions){
    const row=document.createElement('fieldset');row.className='meal-addition-row';row.dataset.id=addition.id;
    const legend=document.createElement('legend');legend.textContent=addition.label;row.append(legend);
    const head=document.createElement('div');head.className='meal-addition-fields';
    const label=document.createElement('label');label.textContent='Nom de la catégorie';const name=document.createElement('input');name.required=true;name.maxLength=60;name.value=addition.label;name.dataset.categoryName='true';label.append(name);
    const typeLabel=document.createElement('label');typeLabel.textContent='Type de recettes';const type=document.createElement('select');type.dataset.recipeType='true';for(const [value,text] of ADDITION_RECIPE_TYPES)type.add(new Option(text,value));if(!ADDITION_RECIPE_TYPES.some(([value])=>value===addition.recipeType))type.add(new Option(addition.label,addition.recipeType));type.value=addition.recipeType;typeLabel.append(type);
    const roleLabel=document.createElement('label');roleLabel.textContent='Rôle dans le repas';const role=document.createElement('select');role.dataset.categoryRole='true';for(const [value,text] of Object.entries(ADDITION_ROLE_LABELS).filter(([value])=>value!=='main'))role.add(new Option(text,value));role.value=addition.role??roleForRecipeType(addition.recipeType);roleLabel.append(role);
    const remove=document.createElement('button');remove.type='button';remove.className='secondary danger-button';remove.textContent='Supprimer';remove.addEventListener('click',()=>row.remove());
    head.append(label,typeLabel,roleLabel,remove);row.append(head);
    const slots=document.createElement('div');slots.className='meal-addition-slots';const caption=document.createElement('strong');caption.textContent='Créneaux proposés';slots.append(caption);
    for(const slot of MEAL_ORDER){const choice=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.value=slot;check.checked=addition.slots.includes(slot);choice.append(check,document.createTextNode(MEAL_LABELS[slot]));slots.append(choice);}
    row.append(slots);name.addEventListener('input',()=>{legend.textContent=name.value.trim()||'Nouvelle catégorie';});root.append(row);
  }
}
function mealAdditionsFromForm(){return $$('.meal-addition-row',$('#meal-addition-categories')).map(row=>({
  id:row.dataset.id,label:$('[data-category-name]',row).value.trim(),recipeType:$('[data-recipe-type]',row).value,role:$('[data-category-role]',row).value,
  slots:$$('input[type="checkbox"]',row).filter(input=>input.checked).map(input=>input.value),
}));}
function renderPlannedAdditionActions(){
  const root=$('#planned-addition-actions');if(!root)return;root.replaceChildren();
  const slot=$('#meal-form').elements.slot.value;
  for(const category of state.mealAdditions.filter(item=>item.slots.includes(slot))){
    const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=`+ ${category.label}`;button.dataset.categoryId=category.id;
    button.addEventListener('click',()=>{const items=currentFormAmounts();items[Math.max(-1,...Object.keys(items).map(Number))+1]={recipeId:'',role:mealAdditionRole(category.id),categoryId:category.id,assignments:{}};renderPlannedItems(items);});root.append(button);
  }
}
async function refreshMealAdditions(){
  try{const result=await api(`/api/meal-additions?householdId=${encodeURIComponent(state.household.id)}`);state.mealAdditions=result.additions??[];renderMealAdditionCategories();renderPlannedAdditionActions();renderFilteredRecipes();}
  catch(error){showMessage($('#meal-additions-message'),`Catégories indisponibles : ${error.body?.error??error.message}`);}
}
$('#add-meal-category').addEventListener('click',()=>{
  const existing=mealAdditionsFromForm();let index=1;while(existing.some(item=>item.id===`custom-${index}`))index++;
  renderMealAdditionCategories([...existing,{id:`custom-${index}`,label:'Nouvelle catégorie',recipeType:`custom-${index}`,role:'dessert',slots:MEAL_ORDER}]);
  $('#meal-addition-categories .meal-addition-row:last-child [data-category-name]')?.focus();
});
$('#meal-additions-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,message=$('#meal-additions-message');
  if(!form.reportValidity()||!state.household)return;
  const additions=mealAdditionsFromForm();
  if(additions.some(item=>!item.slots.length)){showMessage(message,'Choisis au moins un créneau pour chaque catégorie.');return;}
  const button=$('button[type="submit"]',form);button.disabled=true;
  try{const result=await api('/api/meal-additions',{method:'PUT',body:JSON.stringify({householdId:state.household.id,additions})});state.mealAdditions=result.additions;renderMealAdditionCategories();renderPlannedAdditionActions();renderFilteredRecipes();showMessage(message,'Catégories enregistrées. Les repas déjà planifiés restent inchangés.',true);}
  catch(error){showMessage(message,`Enregistrement impossible : ${error.body?.error??error.message}`);}
  finally{button.disabled=false;}
});
const productionUnitLabels={piece:'pièce(s)',slice:'tranche(s)',portion:'portion(s)',g:'g',ml:'ml'};
function productionTypeLabel(id){return state.productionTypes.find(item=>item.id===id)?.label??({batch_cooking:'Batch cooking',pasta:'Pâtes',pastry:'Pâtisserie',bread:'Pain'}[id]??id);}
function populateProductionTypeSelect(select,value){
  select.replaceChildren(new Option('Aucune','none'),...state.productionTypes.map(item=>new Option(item.label,item.id)));
  if(value&&![...select.options].some(option=>option.value===value))select.add(new Option(value,value));
  select.value=value??'none';
}
function renderProductionTypeRows(types=state.productionTypes){
  const root=$('#production-type-rows');if(!root)return;root.replaceChildren();
  for(const type of types){
    const row=document.createElement('div');row.className='production-type-row';row.dataset.id=type.id;
    const label=document.createElement('label');label.textContent='Nom';const name=document.createElement('input');name.value=type.label;name.required=true;name.maxLength=60;name.dataset.productionName='true';label.append(name);
    row.append(label);
    if(type.id.startsWith('custom-')){const remove=document.createElement('button');remove.type='button';remove.className='secondary danger-button';remove.textContent='Supprimer';remove.addEventListener('click',()=>row.remove());row.append(remove);}
    else {const fixed=document.createElement('span');fixed.className='muted';fixed.textContent='Type intégré';row.append(fixed);}
    root.append(row);
  }
}
function productionTypesFromForm(){return $$('.production-type-row',$('#production-type-rows')).map(row=>({
  id:row.dataset.id,label:$('[data-production-name]',row).value.trim(),minimumAmount:0,minimumUnitId:'portion',
}));}
async function refreshProductionTypes(){
  if(!state.household)return;
  if(state.productionTypesHouseholdId===state.household.id&&state.productionTypes.length)return;
  const result=await api(`/api/production-types?householdId=${encodeURIComponent(state.household.id)}`);
  state.productionTypes=result.productionTypes??[];state.productionTypesHouseholdId=state.household.id;
  renderProductionTypeRows();
}
$('#add-production-type')?.addEventListener('click',()=>{
  const existing=productionTypesFromForm(),base='custom-nouveau-type';let id=base,index=2;while(existing.some(item=>item.id===id))id=`${base}-${index++}`;
  renderProductionTypeRows([...existing,{id,label:'Nouveau type',minimumAmount:0,minimumUnitId:'piece'}]);
  $('#production-type-rows .production-type-row:last-child [data-production-name]')?.focus();
});
$('#production-types-form')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,message=$('#production-types-message');if(!form.reportValidity()||!state.household)return;
  const button=$('button[type="submit"]',form);button.disabled=true;
  try{
    const result=await api('/api/production-types',{method:'PUT',body:JSON.stringify({householdId:state.household.id,productionTypes:productionTypesFromForm()})});
    state.productionTypes=result.productionTypes;state.productionTypesHouseholdId=state.household.id;renderProductionTypeRows();
    showMessage(message,'Types de production enregistrés. Les lots minimums se règlent dans chaque fiche recette.',true);await refreshRecipes();await refreshShopping();
  }catch(error){const code=error.body?.error;showMessage(message,code==='production-type-in-use'?`Ce type est utilisé par ${error.body.recipeCount} recette(s). Réaffecte-les avant de le supprimer.`:code==='production-minimum-unit-missing'?`La recette « ${error.body.recipeName} » doit définir son rendement en ${productionUnitLabels[error.body.unitId]??error.body.unitId} avant d’activer ce minimum.`:`Enregistrement impossible : ${code??error.message}`);}
  finally{button.disabled=false;}
});
async function refreshMealSettings() {
  const form=$('#meal-ratios-form');
  $('button[type="submit"]',form).disabled=true;
  if(!state.household){await refreshFoodYieldConversions();return;}
  try {
    const settings=await api(`/api/meal-settings?householdId=${encodeURIComponent(state.household.id)}`);
    state.mealRatios=settings.ratios;
    for(const slot of MEAL_ORDER)form.elements[slot].value=Number((settings.ratios[slot]*100).toFixed(4));
    await Promise.all([refreshPeople(),refreshProductionTypes(),refreshProteinSettings()]);updateMealRatiosPreview();
    await refreshPlateSettings();await refreshFoodYieldConversions();await refreshMealAdditions();
    showMessage($('#meal-ratios-message'),'');
  }catch(error){showMessage($('#meal-ratios-message'),`Répartition indisponible : ${error.body?.error ?? error.message}`);}
}
$('#meal-ratios-form').addEventListener('input',updateMealRatiosPreview);
$('#meal-ratios-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,ratios=mealRatiosFromForm(),message=$('#meal-ratios-message');
  if(!form.reportValidity() || !validMealRatios(ratios)){showMessage(message,'Le total doit être égal à 100 %.');return;}
  if(!state.household)return;
  const button=$('button[type="submit"]',form);button.disabled=true;
  try {
    const settings=await api('/api/meal-settings',{method:'PUT',body:JSON.stringify({householdId:state.household.id,ratios})});
    state.mealRatios=settings.ratios;
    await Promise.all([refreshCalendar(),refreshDashboard()]);
    showMessage(message,'Répartition enregistrée. Les quantités déjà saisies sont conservées ; utilise « Recalculer les portions » dans les repas à ajuster.',true);
  }catch(error){showMessage(message,`Enregistrement impossible : ${error.body?.error ?? error.message}`);}
  finally{updateMealRatiosPreview();}
});

function proteinTargetsFromForm() {
  return Object.fromEntries($$('#protein-targets-fields input').map((input)=>[input.dataset.personId,input.value===''?null:Number(input.value)]));
}
async function refreshProteinSettings() {
  const root=$('#protein-targets-fields');root.replaceChildren();
  const button=$('#protein-targets-form button[type="submit"]');button.disabled=true;
  if(!state.household)return;
  try {
    const settings=await api(`/api/protein-settings?householdId=${encodeURIComponent(state.household.id)}`);
    state.proteinTargets=settings.targets??{};
    if(!state.people.length){root.append(emptyMessage('Ajoute les personnes du foyer pour régler leurs minima.'));return;}
    for(const person of state.people) {
      const label=document.createElement('label');label.textContent=`${person.displayName} · minimum quotidien (g)`;
      const input=document.createElement('input');input.type='number';input.min='0';input.max='500';input.step='1';input.dataset.personId=person.id;
      const target=dailyProteinTarget(person,state.proteinTargets);input.value=target==null?'':String(target);input.placeholder='Aucun minimum défini';input.setAttribute('aria-label',`Minimum quotidien de protéines pour ${person.displayName} en grammes`);
      label.append(input);root.append(label);
    }
    button.disabled=false;
  }catch(error){root.append(emptyMessage(`Réglages des protéines indisponibles : ${error.body?.error??error.message}`));}
}
$('#protein-targets-form').addEventListener('input',()=>{
  const inputs=$$('#protein-targets-fields input'),button=$('#protein-targets-form button[type="submit"]');
  button.disabled=!inputs.length||inputs.some(input=>input.value!==''&&(!Number.isFinite(Number(input.value))||Number(input.value)<0||Number(input.value)>500));
});
$('#protein-targets-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,message=$('#protein-targets-message'),targets=proteinTargetsFromForm();
  if(!form.reportValidity()||Object.values(targets).some(value=>value!=null&&(!Number.isFinite(value)||value<0||value>500))){showMessage(message,'Les minima doivent être compris entre 0 et 500 g par jour.');return;}
  if(!state.household)return;
  const button=$('button[type="submit"]',form);button.disabled=true;
  try {
    const settings=await api('/api/protein-settings',{method:'PUT',body:JSON.stringify({householdId:state.household.id,targets})});
    state.proteinTargets=settings.targets;
    await refreshCalendar();
    showMessage(message,'Minima quotidiens de protéines enregistrés.',true);
  }catch(error){showMessage(message,`Enregistrement impossible : ${error.body?.error??error.message}`);}
  finally{button.disabled=false;}
});

function plateRatiosFromForm() {
  const form=$('#plate-ratios-form');
  return Object.fromEntries(Object.entries(PLATE_PARTS).map(([mode,parts])=>[mode,Object.fromEntries(parts.map(part=>{
    const value=form.elements[`${mode}-${part}`].value;
    return [part,value===''?NaN:Number(value)/100];
  }))]));
}
function updatePlateRatiosPreview() {
  const ratios=plateRatiosFromForm();
  for(const [mode,parts] of Object.entries(PLATE_PARTS)) {
    const total=parts.reduce((sum,part)=>sum+ratios[mode][part],0)*100;
    $(`#plate-total-${mode}`).textContent=Number.isFinite(total)?`Total : ${format(total)} %${Math.abs(total-100)<1e-7?' ✓':' — total attendu : 100 %'}`:'Renseigne chaque proportion.';
    $(`#plate-example-${mode}`).textContent=Number.isFinite(total)?'Exemple pour 400 g : '+parts.map(part=>`${part==='starch'?'féculents':part==='vegetables'?'légumes':mode==='whole'?'plat entier':mode==='separate'?'viande et légumes':'viande / protéines'} ${formatQty(400*ratios[mode][part])} g`).join(' · '):'';
  }
  $('#plate-ratios-form button[type="submit"]').disabled=!validPlateRatios(ratios);
}
async function refreshPlateSettings() {
  const root=$('#plate-ratios-fields');root.replaceChildren();
  $('#plate-ratios-form button[type="submit"]').disabled=true;
  const settings=await api(`/api/plate-settings?householdId=${encodeURIComponent(state.household.id)}`);
  state.plateRatios=settings.ratios;
  const labels={whole:'Tout ensemble',separate:'Viande et légumes ensemble, féculents séparés',three:'Protéines, féculents et légumes séparés'};
  for(const [mode,parts] of Object.entries(PLATE_PARTS)) {
    const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=labels[mode];
    const fields=document.createElement('div');fields.className='form-grid';
    for(const part of parts) {
      const label=document.createElement('label');label.textContent=(part==='starch'?'Féculents':part==='vegetables'?'Légumes':mode==='whole'?'Plat entier':mode==='separate'?'Viande et légumes':'Viande / protéines')+' (%)';
      const input=document.createElement('input');input.type='number';input.name=`${mode}-${part}`;input.min='0.1';input.max='100';input.step='0.1';input.required=true;input.readOnly=mode==='whole';input.value=Number((settings.ratios[mode][part]*100).toFixed(4));label.append(input);fields.append(label);
    }
    const total=document.createElement('p');total.id=`plate-total-${mode}`;total.setAttribute('role','status');
    const example=document.createElement('small');example.className='muted';example.id=`plate-example-${mode}`;
    group.append(legend,fields,total,example);root.append(group);
  }
  updatePlateRatiosPreview();
}
$('#plate-ratios-form').addEventListener('input',updatePlateRatiosPreview);
$('#plate-ratios-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,ratios=plateRatiosFromForm(),message=$('#plate-ratios-message');
  if(!form.reportValidity() || !validPlateRatios(ratios)){showMessage(message,'Chaque mode doit totaliser 100 %, avec une valeur positive pour chaque partie.');return;}
  if(!state.household)return;
  $('button[type="submit"]',form).disabled=true;
  try {
    const settings=await api('/api/plate-settings',{method:'PUT',body:JSON.stringify({householdId:state.household.id,ratios})});state.plateRatios=settings.ratios;
    await refreshCalendar();await refreshPlateSettings();
    showMessage(message,'Composition enregistrée. Utilise « Recalculer les portions » dans les repas à ajuster.',true);
  }catch(error){showMessage(message,`Enregistrement impossible : ${error.body?.error??error.message}`);}
  finally{if($('#plate-ratios-fields input'))updatePlateRatiosPreview();}
});

async function init() {
  try {
    const session = await api('/api/session');
    if (!session.authenticated) { $('#login-dialog').showModal(); return; }
  } catch { $('#login-dialog').showModal(); return; }
  $('#connection').textContent = 'Connexion à la base…';
  const health = api('/api/health').then(() => {
    $('#connection').textContent = 'Base connectée';
    $('#connection').classList.remove('error');
  }).catch(() => {
    $('#connection').textContent = 'Base indisponible';
    $('#connection').classList.add('error');
  });
  await loadHouseholds();
  await Promise.all([refreshFoods(), health]);
  await Promise.all([refreshPeople(), refreshCalendar(), refreshDashboard(), refreshRecipeAIConfig()]);
  $('#shopping-start').value = localDateValue(); $('#shopping-end').value = addDays(localDateValue(), 29); $('#production-form').elements.producedOn.value = localDateValue();
  addRecipeLine();
}

$('#person-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.household) { showMessage($('#people-message'), 'Crée d’abord un foyer.'); return; }
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    await api('/api/people', { method: 'POST', body: JSON.stringify({ householdId: state.household.id, ...data }) });
    form.reset(); showMessage($('#people-message'), 'Profil ajouté.', true); await refreshPeople();await refreshProteinSettings();
  } catch (error) { showMessage($('#people-message'), error.body?.error === 'person-already-exists' ? 'Ce nom de profil existe déjà dans le foyer.' : 'Impossible de créer le profil.'); }
});

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  showMessage($('#login-message'), '');
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ password: form.elements.password.value }) });
    form.reset();
    $('#login-dialog').close();
    await init();
  } catch (error) {
    showMessage($('#login-message'), error.body?.error === 'invalid-password' ? 'Mot de passe incorrect.' : 'Connexion impossible. Vérifie que le service est prêt.');
  }
});

init();



const slotLabels = MEAL_LABELS;
const activityLabels = { sedentary: 'Sédentaire', light: 'Légère', moderate: 'Modérée', active: 'Importante', very_active: 'Très importante' };

function dateOnly(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function addDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateOnly(date);
}
function mondayOf(value) {
  const date = new Date(`${value}T12:00:00`);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dateOnly(date);
}
function displayDate(value, options = { weekday: 'short', day: '2-digit', month: 'short' }) {
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(`${value}T12:00:00`));
}
function latestProfile(person, date) {
  return (person.profileHistory ?? []).find((entry) => entry.effectiveFrom <= date) ?? null;
}

async function refreshCalendar() {
  const grid = $('#calendar-grid');
  if (!grid || !state.household) {
    if (grid) grid.replaceChildren(emptyMessage('Crée d’abord un foyer.'));
    return;
  }
  const today = localDateValue();
  state.calendarWeekStart ??= mondayOf(today);
  grid.replaceChildren(emptyMessage('Chargement de la semaine…'));
  try {
    const end = addDays(state.calendarWeekStart, 6);
    const [plan, peopleResult, recipesResult, mealSettings, reserve, plateSettings, proteinSettings, mealAdditionsResult] = await Promise.all([
      api(`/api/planning?householdId=${encodeURIComponent(state.household.id)}&weekStart=${state.calendarWeekStart}`),
      api(`/api/people?householdId=${encodeURIComponent(state.household.id)}`),
      api(`/api/recipes?householdId=${encodeURIComponent(state.household.id)}`),
      api(`/api/meal-settings?householdId=${encodeURIComponent(state.household.id)}`),
      api(`/api/energy-reserve?householdId=${encodeURIComponent(state.household.id)}&asOf=${end}`),
      api(`/api/plate-settings?householdId=${encodeURIComponent(state.household.id)}`),
      api(`/api/protein-settings?householdId=${encodeURIComponent(state.household.id)}`),
      api(`/api/meal-additions?householdId=${encodeURIComponent(state.household.id)}`),
    ]);
    state.mealRatios=mealSettings.ratios;
    state.plateRatios=plateSettings.ratios;
    state.proteinTargets=proteinSettings.targets??{};
    state.mealAdditions=mealAdditionsResult.additions??[];
    state.people = peopleResult.people;
    state.recipes = recipesResult.recipes;
    state.calendarReserveOverview=reserve;
    state.calendarMeals = plan.meals ?? [];
    $('#calendar-week-title').textContent = `${displayDate(state.calendarWeekStart, { day: '2-digit', month: 'long' })} – ${displayDate(end, { day: '2-digit', month: 'long', year: 'numeric' })}`;
    grid.replaceChildren(...Array.from({ length: 7 }, (_, index) => renderCalendarDay(addDays(state.calendarWeekStart, index), plan.meals ?? [], today)));
    renderCalendarSummary(plan.meals ?? [], state.people, state.calendarWeekStart);
  } catch (error) {
    grid.replaceChildren(emptyMessage(`Calendrier indisponible : ${error.body?.error ?? error.message}`));
  }
}

function renderCalendarDay(date, meals, today) {
  const day = document.createElement('article');
  day.className = `calendar-day${date === today ? ' today' : ''}`;
  const heading = document.createElement('div'); heading.className = 'calendar-day-heading';
  heading.innerHTML = `<span>${displayDate(date, { weekday: 'short' })}</span><strong>${displayDate(date, { day: '2-digit', month: 'short' })}</strong>`;
  if (date === today) { const badge = document.createElement('small'); badge.className = 'today-badge'; badge.textContent = 'AUJ.'; heading.append(badge); }
  day.append(heading);
  for (const slot of MEAL_ORDER) {
    const section = document.createElement('section'); section.className = 'calendar-slot';
    section.dataset.slot = slot;
    const slotHeading = document.createElement('div'); slotHeading.className = 'calendar-slot-heading';
    const label = document.createElement('span'); label.textContent = slotLabels[slot];
    const add = document.createElement('button'); add.type = 'button'; add.className = 'calendar-add'; add.textContent = '+ Ajouter';
    add.addEventListener('click', () => openMealEditor(date, slot));
    const slotMeals = meals.filter((item) => item.mealDate === date && item.slot === slot);
    if (!slotMeals.length) { slotHeading.append(label, add); section.append(slotHeading); }
    for (const meal of slotMeals) section.append(renderMealCard(meal));
    day.append(section);
  }
  day.append(renderDailyEnergySummary(date,meals));
  return day;
}

function renderDailyEnergySummary(date,meals) {
  const footer=document.createElement('footer');footer.className='daily-energy-summary';
  const heading=document.createElement('strong');heading.textContent='Kcal prévues / objectif · protéines / minimum';footer.append(heading);
  for(const person of state.people) {
    const daily=calculateDailyEnergy(meals,person.id,date),target=latestProfile(person,date)?.dailyEnergyKcal;
    const hasOccasion=meals.some(meal=>meal.mealDate===date&&meal.isOccasion&&meal.attendees.some(attendee=>attendee.id===person.id));
    const savings=state.calendarReserveOverview?.accounts?.find(account=>account.personId===person.id)?.savingsPlans?.find(plan=>plan.startsOn<=date&&plan.endsOn>=date);
    const line=document.createElement('div');line.className='daily-energy-person';
    const name=document.createElement('span');name.textContent=person.displayName;
    const value=document.createElement('strong');value.className='daily-energy-value';
    value.textContent=`${daily.kcal==null?'—':format(daily.kcal)} / ${target>0?format(target):'—'} kcal`;
    if(daily.incomplete){value.classList.add('incomplete');value.title='Sous-total partiel : certaines valeurs nutritionnelles sont inconnues.';}
    else if(!hasOccasion&&target>0 && daily.kcal>target)value.classList.add('over-target');
    line.append(name,value);
    if(savings){const budget=document.createElement('small');budget.textContent=`Budget repas ajusté : ${format(Math.max(0,Number(target)-savings.dailyKcal))} kcal (épargne ${format(savings.dailyKcal)} kcal)`;line.append(budget);}
    if(daily.incomplete){const note=document.createElement('small');note.textContent='Données incomplètes';line.append(note);}
    footer.append(line);
    const proteins=calculateDailyProtein(meals,person.id,date),proteinTarget=dailyProteinTarget(person,state.proteinTargets);
    const proteinLine=document.createElement('div');proteinLine.className='daily-protein-person';
    const proteinValue=document.createElement('strong');proteinValue.className='daily-protein-value';
    proteinValue.textContent=proteinTarget==null
      ? `${proteins.incomplete?'≥ ':''}${format(proteins.grams)} g · minimum non défini`
      : `${proteins.incomplete?'≥ ':''}${format(proteins.grams)} / ${proteinTarget} g protéines`;
    if(proteinTarget==null)proteinValue.classList.add('protein-unknown');
    else if(proteins.incomplete)proteinValue.classList.add('protein-unknown');
    else proteinValue.classList.add(proteins.grams>=proteinTarget?'protein-sufficient':'protein-low');
    proteinLine.append(proteinValue);
    if(proteins.incomplete){const note=document.createElement('small');note.textContent='Protéines partielles : certaines données sont inconnues.';proteinLine.append(note);}
    footer.append(proteinLine);
  }
  if(meals.some(meal=>meal.mealDate===date&&meal.isOccasion)){const note=document.createElement('small');note.className='muted';note.textContent='Les repas exceptionnels sont inclus dans les kcal prévues, sans limite de créneau, et débités de l’épargne.';footer.append(note);}
  const needsBreakfast=meals.some(meal=>meal.mealDate===date && meal.slot==='breakfast' && meal.items.some(item=>item.role==='main' && item.amounts.some(amount=>amount.quantity>breakfastServingLimit(item.recipe,state.recipes.find(parent=>parent.id===item.recipe?.parentRecipeId)))));
  const needsSavingRebalance=state.people.some(person=>{const target=latestProfile(person,date)?.dailyEnergyKcal;const saving=state.calendarReserveOverview?.accounts?.find(account=>account.personId===person.id)?.savingsPlans?.find(plan=>plan.startsOn<=date&&plan.endsOn>=date)?.dailyKcal??0;const daily=calculateDailyEnergy(meals.filter(meal=>!meal.isOccasion),person.id,date).kcal;return target>saving&&daily>target-saving;});
  if(needsBreakfast || needsSavingRebalance || state.people.some(person=>calculateDailyEnergy(meals.filter(meal=>!meal.isOccasion),person.id,date).kcal>latestProfile(person,date)?.dailyEnergyKcal)) {
    const button=document.createElement('button');button.type='button';button.className='secondary daily-rebalance-button';button.textContent=needsSavingRebalance?'Rééquilibrer pour l’épargne':'Rééquilibrer';button.addEventListener('click',()=>openDailyRebalance(date));footer.append(button);
  }
  return footer;
}

let dailyRebalancePreview=null;
let dailyRebalanceRequest=0;
const rebalanceReasons={
  'minor-profile':'Profil adolescent : quantités conservées.',
  'age-missing':'Date de naissance manquante : aucun ajustement automatique.',
  'target-missing':'Objectif quotidien manquant.',
  'inactive-profile':'Profil inactif.',
  'incomplete-nutrition':'Données nutritionnelles incomplètes : quantités conservées.',
  'cannot-fully-rebalance':'Une partie du dépassement reste à ajuster : les portions minimales ou le repère protéique limitent les réductions.',
};
async function openDailyRebalance(date) {
  const request=++dailyRebalanceRequest;
  $('#rebalance-dialog h2').textContent=`Rééquilibrer le ${displayDate(date)}`;
  dailyRebalancePreview=null;$('#rebalance-dialog').showModal();$('#apply-rebalance').disabled=true;
  $('#rebalance-preview').replaceChildren(emptyMessage('Calcul des nouvelles quantités…'));$('#rebalance-message').textContent='';
  try {
    const preview=await api(`/api/planning/rebalance-preview?householdId=${encodeURIComponent(state.household.id)}&date=${date}`);
    if(request!==dailyRebalanceRequest || !$('#rebalance-dialog').open)return;
    dailyRebalancePreview=preview;
    const root=$('#rebalance-preview');root.replaceChildren();
    for(const person of [...preview.results].sort((a,b)=>Number(Boolean(a.reason))-Number(Boolean(b.reason)) || a.name.localeCompare(b.name,'fr'))) {
      const section=document.createElement('section');section.className='rebalance-person';
      const heading=document.createElement('strong');heading.textContent=`${person.name} : ${format(person.beforeKcal)} → ${format(person.afterKcal)} / ${person.targetKcal==null?'—':format(person.targetKcal)} kcal`;section.append(heading);
      for(const change of preview.changes.filter(change=>change.personId===person.personId).sort((a,b)=>MEAL_ORDER.indexOf(a.slot)-MEAL_ORDER.indexOf(b.slot))) {
        const line=document.createElement('p');line.textContent=`${slotLabels[change.slot]} · ${change.recipeName} : ${formatQty(change.before)} → ${formatQty(change.after)} ${change.unitId}`;section.append(line);
      }
      if(person.reason){const note=document.createElement('p');note.className='muted';note.textContent=rebalanceReasons[person.reason] ?? person.reason;section.append(note);}
      root.append(section);
    }
    if(!preview.changes.length)showMessage($('#rebalance-message'),'Aucune réduction automatique proposée.');
    $('#apply-rebalance').disabled=!preview.changes.length;
  }catch(error){if(request===dailyRebalanceRequest)showMessage($('#rebalance-message'),`Calcul impossible : ${error.body?.error ?? error.message}`);}
}
$('#rebalance-dialog').addEventListener('close',()=>{dailyRebalanceRequest++;dailyRebalancePreview=null;});
$('#close-rebalance').addEventListener('click',()=>$('#rebalance-dialog').close());
$('#apply-rebalance').addEventListener('click',async()=>{
  if(!dailyRebalancePreview)return;
  const button=$('#apply-rebalance');button.disabled=true;
  try {
    await api('/api/planning/rebalance',{method:'POST',body:JSON.stringify({householdId:state.household.id,date:dailyRebalancePreview.date,token:dailyRebalancePreview.token})});
    $('#rebalance-dialog').close();await Promise.all([refreshCalendar(),refreshDashboard()]);
  }catch(error){showMessage($('#rebalance-message'),error.body?.error==='rebalance-preview-stale'?'Le planning ou un profil a changé depuis le calcul. Ferme cette fenêtre et relance le rééquilibrage.':`Application impossible : ${error.body?.error ?? error.message}`);}
});

function mealCalories(meal) {
  if(meal.isOccasion)return (meal.occasionEnergy??[]).reduce((sum,entry)=>sum+Number(entry.kcal||0),0);
  if (!meal.attendees?.length || !meal.items?.length) return 0;
  return meal.items.reduce((sum, item) => {
    const recipe = item.recipe;
    const kcal = recipe?.nutrition?.perYieldUnit?.energyKcal;
    if (kcal == null) return sum;
    return sum + item.amounts.reduce((subtotal, amount) => subtotal + (amount.quantity * kcal), 0);
  }, 0);
}

function renderMealCard(meal) {
  const card = document.createElement('article'); card.className = 'planned-meal-card';
  const edit = document.createElement('button'); edit.type = 'button';
  edit.textContent = meal.isOccasion ? `✨ ${meal.occasionTitle || 'Repas exceptionnel'} · hors quotas` : [...new Set(meal.items?.filter(item => ['main','accompaniment'].includes(item.role ?? 'main')).map(item => item.recipe?.parentRecipeId ? item.recipe.name.split(' — ')[0] : item.recipe?.name ?? 'Recette supprimée'))].join(' + ') || 'Repas';
  const attendee = document.createElement('small'); attendee.textContent = meal.attendees?.map((person) => person.displayName).join(', ') || 'Aucune personne sélectionnée';
  const kcal = meal.isOccasion ? (meal.occasionEnergy??[]).reduce((sum,entry)=>sum+Number(entry.kcal||0),0) : mealCalories(meal);
  const partial = meal.isOccasion ? false : meal.items?.some((item) => !item.recipe?.nutrition?.complete) ?? false;
  const total = document.createElement('small'); total.className = 'meal-kcal'; total.textContent = meal.isOccasion ? `${format(kcal)} kcal estimées · déduites de l’épargne` : kcal ? `${partial ? 'Sous-total partiel' : 'Total'} · ${format(kcal)} kcal` : 'Valeurs inconnues ou incomplètes';
  card.append(edit, attendee, total);
  const printItems = document.createElement('div'); printItems.className = 'print-meal-items';
  if (meal.isOccasion) {
    const line = document.createElement('p'); line.textContent = meal.occasionTitle || 'Repas exceptionnel'; printItems.append(line);
  } else {
    for (const item of meal.items ?? []) {
      if (!item.recipe) continue;
      const row = document.createElement('div'); row.className = 'print-meal-item';
      const recipeName = document.createElement('strong'); recipeName.textContent = item.recipe.name;
      const quantities = document.createElement('ul');
      for (const amount of item.amounts ?? []) {
        const person = meal.attendees?.find((entry) => entry.id === amount.personId) ?? state.people.find((entry) => entry.id === amount.personId);
        if (!person) continue;
        const quantity = document.createElement('li');
        quantity.textContent = `${person.displayName} : ${formatQty(displayServingQuantity(item.recipe,amount.quantity))} ${servingUnitLabel(servingUnit(item.recipe))}`;
        quantities.append(quantity);
      }
      row.append(recipeName, quantities); printItems.append(row);
    }
  }
  card.append(printItems);
  if(meal.preparedAt){const done=document.createElement('small');done.className='stock-status';done.textContent='Préparé ✓';card.append(done);edit.disabled=true;edit.title='Annule la préparation avant de modifier ce repas.';}
  if(!meal.isOccasion){const prepared=document.createElement('button');prepared.type='button';prepared.className='text-button';prepared.textContent=meal.preparedAt?'Annuler la préparation':'Marquer préparé';
    const status=document.createElement('small');status.setAttribute('role','status');
    prepared.addEventListener('click',async()=>{
      prepared.disabled=true;
      try{await api(`/api/planning/meals/${meal.id}/prepared`,{method:'PUT',body:JSON.stringify({householdId:state.household.id,prepared:!meal.preparedAt})});
        await Promise.all([refreshCalendar(),refreshShopping(),refreshDashboard()]);}
      catch(error){const body=error.body??{};const explanations={
        'prepared-batch-insufficient':'Cette recette de batch n’a pas assez de portions produites. Enregistre d’abord sa production dans Courses & stocks.',
        'prepared-component-insufficient':'Prépare d’abord '+body.name+' : '+formatQty(body.requiredQuantity)+' '+body.unitId+' nécessaires, '+formatQty(body.availableQuantity)+' disponibles.',
      'ingredient-stock-insufficient':`Stock insuffisant pour ${body.name} : ${formatQty(body.requiredG)} g nécessaires, ${formatQty(body.availableG)} g disponibles.`,
        'ingredient-conversion-missing':`Conversion en grammes manquante pour ${body.name}. Complète la fiche de cet aliment.`};
        status.textContent=explanations[body.error]??`Préparation non enregistrée : ${body.error??error.message}`;prepared.disabled=false;}
    });card.append(prepared,status);
  }
  const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='text-button';duplicate.textContent='Dupliquer';duplicate.addEventListener('click',()=>openMealDuplication(meal));card.append(duplicate);
  edit.addEventListener('click', () => openMealEditor(meal.mealDate, meal.slot, meal));
  return card;
}

$('#print-calendar')?.addEventListener('click', () => window.print());

function renderCalendarSummary(meals, people, weekStart) {
  const summary = $('#calendar-summary');
  summary.replaceChildren();
  const title = document.createElement('h3'); title.textContent = 'Prévisions par personne'; summary.append(title);
  if (!people.length) { summary.append(emptyMessage('Ajoute les personnes du foyer dans Profils.')); return; }
  for (const person of people) {
    const row = document.createElement('article'); row.className = 'person-forecast';
    const name = document.createElement('strong'); name.textContent = person.displayName;
    const total = document.createElement('span');
    let totalKcal = 0; let incomplete = false; let daysPlanned = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i); let daily = 0; let hasPlan = false;
      for (const meal of meals.filter((entry) => entry.mealDate === date && entry.attendees.some((p) => p.id === person.id))) {
        if(meal.isOccasion){const entry=meal.occasionEnergy?.find(value=>value.personId===person.id);hasPlan=true;if(entry)daily+=Number(entry.kcal);else incomplete=true;continue;}
        for (const item of meal.items) {
          const amount = item.amounts.find((entry) => entry.personId === person.id);
          if (!amount) continue;
          hasPlan = true;
          const nutrition = item.recipe?.nutrition;
          const energy = nutrition?.perYieldUnit?.energyKcal;
          if (energy == null || !nutrition.complete) incomplete = true;
          if (energy != null) daily += energy * amount.quantity;
        }
      }
      if (hasPlan) { totalKcal += daily; daysPlanned++; }
    }
    total.textContent = daysPlanned ? `${format(totalKcal)} kcal prévues sur 7 jours · ${daysPlanned}/7 jours planifiés${incomplete ? ' · données incomplètes' : ''}` : 'Aucun repas planifié';
    row.append(name, total);
    const weeklyTarget = calculateWeeklyEnergyTarget(person, weekStart, latestProfile, addDays);
    if (weeklyTarget.kcal != null) {
      const target = document.createElement('small'); target.textContent = `Repère hebdomadaire : ${format(weeklyTarget.kcal)} kcal`; row.append(target);
    } else if (weeklyTarget.daysWithTarget) {
      const target = document.createElement('small'); target.textContent = `Repère hebdomadaire partiel : ${format(weeklyTarget.partialKcal)} kcal (${weeklyTarget.daysWithTarget}/7 jours renseignés)`; row.append(target);
    } else {
      const target = document.createElement('small'); target.className = 'muted'; target.textContent = 'Repère hebdomadaire non renseigné'; row.append(target);
    }
    const reserve=state.calendarReserveOverview?.accounts?.find(account=>account.personId===person.id);
    if(reserve){const balance=document.createElement('b');balance.textContent=`Épargne 30 j : ${format(reserve.balanceKcal)} kcal`;if(reserve.balanceKcal<0)balance.classList.add('reserve-negative');row.append(balance);}
    summary.append(row);
  }
  const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Estimations prévues à partir des recettes. Les données inconnues restent visibles; ce récapitulatif ne représente pas une consommation réelle.'; summary.append(note);
}

function isIndividualRole(role) { return role !== 'main'; }
function individualDefaultQuantity(recipe, role) {
  if(recipe?.recipeType?.startsWith('custom-'))return 1;
  if(role==='sauce')return sauceDefaultQuantity(recipe);
  return role === 'dessert' && ['g','ml'].includes(recipe?.yield?.unitId) ? recipe.yield.amount : 1;
}
function currentFormAmounts() {
  const output = {};
  $$('.planned-item-editor', $('#planned-items')).forEach((row, index) => {
    const categoryId = $('select[name="role"]', row)?.value ?? 'main';
    const category=typeof mealAdditionById==='function'?mealAdditionById(categoryId):null;
    const role = categoryId==='main'?'main':category?mealAdditionRole(categoryId):(row.dataset?.role??categoryId);
    if (isIndividualRole(role)) {
      const assignments = {};
      $$('.beverage-person', row).forEach((personRow) => {
        const personId = personRow.dataset.personId;
        const recipeId = $('select[data-person-recipe]', personRow)?.value ?? '';
        const quantity = $('input[data-person-id]', personRow)?.value ?? '';
        if (recipeId) assignments[personId] = { recipeId, quantity };
      });
      output[index] = { recipeId: '', role, categoryId, assignments };
      return;
    }
    const assignments = {};
    $$('.beverage-person', row).forEach((personRow) => {
      const recipeId = $('select[data-person-recipe]', personRow)?.value ?? '';
      if (recipeId) assignments[personRow.dataset.personId] = { recipeId, quantity: $('input[data-person-id]', personRow)?.value ?? '' };
    });
    const recipeId = $('select[name="recipeId"]', row)?.value || Object.values(assignments)[0]?.recipeId || '';
    const amounts = {};
    if (Object.keys(assignments).length) Object.entries(assignments).forEach(([personId, assignment]) => { amounts[personId] = assignment.quantity; });
    else $$('input[data-person-id]', row).forEach((input) => { amounts[input.dataset.personId] = servingInputValue(input); });
    output[index] = { recipeId, role, categoryId, amounts };
  });
  return output;
}

function renderOccasionEnergy() {
  const root=$('#occasion-energy');if(!root)return;
  const attendees=$$('#meal-attendees input:checked').map(input=>input.value);
  const previous={...state.mealOccasionEnergy};
  root.replaceChildren(...attendees.map(personId=>{
    const person=state.people.find(entry=>entry.id===personId);const label=document.createElement('label');label.textContent=`${person?.displayName??'Personne'} · kcal estimées`;
    const input=document.createElement('input');input.type='number';input.min='0';input.max='100000';input.step='1';input.required=true;input.dataset.personId=personId;input.value=previous[personId]??'';input.placeholder='Ex. 1200';input.setAttribute('aria-label',`Kcal estimées pour ${person?.displayName??'personne'}`);input.addEventListener('input',()=>{state.mealOccasionEnergy[personId]=input.value;});label.append(input);return label;
  }));
}

function updateMealType() {
  const isOccasion=$('#meal-form').elements.isOccasion.checked;
  renderPlannedAdditionActions();
  $('#planned-addition-actions').classList.toggle('hidden',isOccasion);
  $('#occasion-fields').classList.toggle('hidden',!isOccasion);
  $('#regular-meal-fields').classList.toggle('hidden',isOccasion);
  $$('#regular-meal-fields input, #regular-meal-fields select, #regular-meal-fields button').forEach(control=>control.disabled=isOccasion);
  $('#meal-form').elements.occasionTitle.required=isOccasion;
  $$('#occasion-energy input').forEach(input=>input.required=isOccasion);
  if(isOccasion)renderOccasionEnergy();
}

function plannedCaloriesForPerson(meal, personId) {
  if (!meal.attendees?.some((person) => person.id === personId)) return 0;
  if(meal.isOccasion)return Number(meal.occasionEnergy?.find(entry=>entry.personId===personId)?.kcal??0);
  return (meal.items ?? []).reduce((sum, item) => {
    const amount = item.amounts?.find((entry) => entry.personId === personId);
    const energy = item.recipe?.nutrition?.perYieldUnit?.energyKcal;
    return amount && energy != null ? sum + amount.quantity * energy : sum;
  }, 0);
}

function applyAutomaticPortions(items, attendeeIds) {
  const date = $('#meal-form').elements.mealDate.value;
  const slot = $('#meal-form').elements.slot.value;
  const roleWeights = { main: 0.7, accompaniment: 0.2 };
  const selectedItems = Object.values(items).filter((item) => item.recipeId || (isIndividualRole(item.role) && Object.keys(item.assignments ?? {}).length));
  const messages = new Set();
  for (const personId of attendeeIds) {
    const selectedForPerson = selectedItems.filter((item) => !isIndividualRole(item.role ?? 'main') || item.assignments?.[personId]?.recipeId);
    const roleCounts = Object.fromEntries(Object.keys(roleWeights).map((role) => [role, selectedForPerson.filter((item) => (item.role ?? 'main') === role).length]));
    const activeWeight = Object.entries(roleCounts).reduce((sum, [role, count]) => sum + (count ? roleWeights[role] : 0), 0);
    const person = state.people.find((entry) => entry.id === personId);
    const profile = person && latestProfile(person, date);
    const plannedOtherKcal = state.calendarMeals
      .filter((meal) => meal.mealDate === date && meal.id !== state.calendarMealId && !meal.isOccasion)
      .reduce((sum, meal) => sum + plannedCaloriesForPerson(meal, personId), 0);
    const proposals = [];
    for (const item of selectedForPerson) {
      const role = item.role ?? 'main';
      const assignment = isIndividualRole(role) ? item.assignments?.[personId] : null;
      if(isIndividualRole(role)&&assignment&&Number(assignment.quantity)===0)continue;
      const recipeId = isIndividualRole(role) ? assignment?.recipeId : item.recipeId;
      if (!recipeId) continue;
      const recipe = allPlanningRecipes().find((entry) => entry.id === recipeId);
      const kcal = recipe?.nutrition?.perYieldUnit?.energyKcal;
      const recipeUnit = recipe?.yield.unitId ?? 'portion';
      const step = recipeUnit === 'piece' ? 1 : recipeUnit === 'g' ? 10 : 0.5;
      if (isIndividualRole(role)) {
        const quantity = Number(assignment?.quantity);
        proposals.push({ item, assignment, personId, role, quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0, step, recipeKcal: Number(kcal), proteinG: recipe?.nutrition?.perYieldUnit?.proteinG == null ? null : Number(recipe.nutrition.perYieldUnit.proteinG), maxQuantity: Infinity });
        if (kcal == null) messages.add(`${recipe?.name ?? (role === 'sauce' ? 'Une sauce' : 'Une boisson')} : calories inconnues, le respect du budget ne peut pas être vérifié.`);
        continue;
      }
      const extraSaving=Number(state.calendarReserveOverview?.accounts?.find(account=>account.personId===personId)?.savingsPlans?.find(plan=>plan.startsOn<=date&&plan.endsOn>=date)?.dailyKcal??0);
      const effectiveTarget=profile?.dailyEnergyKcal?Math.max(1,Number(profile.dailyEnergyKcal)-extraSaving):null;
      const suggestion = suggestQuantity({
        dailyTargetKcal: effectiveTarget,
        slot,
        plannedOtherKcal,
        recipeKcal: kcal,
        recipeUnit,
        recipeCount: roleCounts[role] || 1,
        budgetShare: activeWeight ? roleWeights[role] / activeWeight : 1,
        slotRatios: state.mealRatios ?? SLOT_RATIOS,
      });
      item.amounts ??= {};
      const fallbackQuantity = suggestion.quantity == null && ['daily-target-missing', 'recipe-energy-missing'].includes(suggestion.reason)
        ? (recipeUnit === 'g' ? 10 : 1)
        : null;
      const proposedQuantity = suggestion.quantity ?? fallbackQuantity;
      const servingMax = recipe?.parentRecipeId && ['main','vegetables'].includes(recipe.servingPart)
        ? mainServingLimit(recipe, state.recipes.find(parent => parent.id === recipe.parentRecipeId))
        : role === 'accompaniment' && recipeUnit === 'g' && !recipe?.parentRecipeId
        ? Math.min(200, Number(recipe?.yield?.amount) * 1.5)
        : Infinity;
      const parentRecipe=state.recipes.find(parent=>parent.id===recipe?.parentRecipeId);
      const maxQuantity=Math.min(servingMax,saladServingLimit(recipe),slot==='breakfast' && role==='main'?breakfastServingLimit(recipe,parentRecipe):Infinity);
      const quantity = proposedQuantity == null ? null : Math.min(
        proposedQuantity,
        maxQuantity,
        recipe?.parentRecipeId ? proposedQuantity : capAccompanimentQuantity(proposedQuantity, { recipeUnit, recipeYieldAmount: recipe?.yield?.amount }),
      );
      item.amounts[personId] = quantity == null ? '' : String(quantity);
      if (Number.isFinite(maxQuantity) && proposedQuantity > maxQuantity) {
        messages.add(`${recipe?.name ?? 'La préparation'} : portion proposée plafonnée à ${maxQuantity} ${recipeUnit} par personne; tu peux toujours l’ajuster.`);
      }
      if (suggestion.reason === 'daily-target-missing') messages.add(`${person?.displayName ?? 'Une personne'} : besoin quotidien manquant, une quantité par défaut est proposée.`);
      else if (suggestion.reason === 'recipe-energy-missing') messages.add(`${recipe?.name ?? 'Une recette'} : calories inconnues, la quantité par défaut ne peut pas garantir le budget.`);
      else if (suggestion.reason === 'daily-budget-used') messages.add(`${person?.displayName ?? 'Une personne'} : enveloppe quotidienne déjà atteinte.`);
      else if (suggestion.reason === 'no-natural-portion-fits') messages.add(`${recipe?.name ?? 'Une recette'} : aucune portion entière ou demi-portion ne tient dans le budget restant.`);
      else if (suggestion.reason === 'no-slot-budget') messages.add('Ce créneau est réglé à 0 % du budget. Tu peux ajuster la répartition dans Administration.');
      const parent=state.recipes.find(parent=>parent.id===recipe?.parentRecipeId);
      proposals.push({ item, personId, role, quantity, reason: suggestion.reason, step, recipeKcal: Number(kcal), proteinG: recipe?.nutrition?.perYieldUnit?.proteinG == null ? null : Number(recipe.nutrition.perYieldUnit.proteinG), maxQuantity, slotBudgetKcal: suggestion.slotBudgetKcal, assignment,
        parentRecipeId:recipe?.parentRecipeId,servingPart:recipe?.servingPart,recipeUnit,
        countStep:recipe?.servingDisplay?.gramsPerUnit,plateParts:parent?.servingParts?.map(part=>part.servingPart),budgetFraction:activeWeight?roleWeights[role]/activeWeight/(roleCounts[role]||1):1 });
    }
    const budget = proposals.find((proposal) => Number.isFinite(proposal.slotBudgetKcal))?.slotBudgetKcal;
    if (Number.isFinite(budget) && proposals.length && proposals.every((proposal) => Number.isFinite(proposal.recipeKcal) && proposal.recipeKcal > 0)) {
      const initial = suggestPlatePortions(proposals, budget, state.plateRatios);
      const rounded = roundServingCalories(initial.proposals);
      const result = {...initial,proposals:rounded.proposals,warnings:[...initial.warnings,...rounded.warnings]};
      result.estimatedKcal=result.proposals.reduce((sum,row)=>sum+(row.quantity??0)*row.recipeKcal,0);
      result.estimatedProteinG=result.proteinKnown?result.proposals.reduce((sum,row)=>sum+(row.quantity??0)*row.proteinG,0):null;
      result.proteinTargetMet=result.proteinKnown && result.estimatedProteinG>=MIN_PROTEIN_G_PER_MEAL-1e-8;
      result.withinBudget=result.estimatedKcal<=budget+1e-4;
      result.warnings.forEach(message=>messages.add(message));
      if(result.proportionsApplied)messages.add(proposals.some(row=>row.countStep>0)?'Calcul initial selon les proportions d’Administration. Arrondi des unités au plus proche lorsque la compensation calorique sur la partie en grammes est possible, sans imposer à nouveau les pourcentages.':'Proportions en poids estimé appliquées depuis Administration. Le poids total respecte le budget kcal et les plafonds des parties ; le repère protéique ne modifie pas ces proportions.');
      result.proposals.forEach((proposal) => {
        if (isIndividualRole(proposal.role)) proposal.assignment.quantity = String(proposal.quantity);
        else proposal.item.amounts[personId] = proposal.quantity == null ? '' : String(proposal.quantity);
      });
      if (!result.withinBudget) messages.add(`${person?.displayName ?? 'Une personne'} : le repas dépasse encore l’enveloppe avec les portions minimales; ajuste une boisson, une sauce ou le repas.`);
      if (!result.proteinKnown) messages.add(`${person?.displayName ?? 'Une personne'} : données protéiques incomplètes, le seuil de ${MIN_PROTEIN_G_PER_MEAL} g ne peut pas être vérifié.`);
      else if (!result.proteinTargetMet) messages.add(`${person?.displayName ?? 'Une personne'} : impossible d’atteindre ${MIN_PROTEIN_G_PER_MEAL} g de protéines sans dépasser l’enveloppe ou les portions maximales.`);
    }
  }
  const notice = document.createElement('details');
  const title = document.createElement('summary');title.textContent = 'Détails du calcul des portions';
  const explanation = document.createElement('p');explanation.className = 'form-message';
  explanation.textContent = messages.size ? [...messages].join(' ') : `Portions proposées avec un repère de ${MIN_PROTEIN_G_PER_MEAL} g de protéines par personne. Les quantités restent ajustables.`;
  notice.append(title,explanation);
  $('#planned-items').replaceChildren(notice);
}

function mealProteinSummary(items, attendeeIds) {
  const root=document.createElement('div');root.id='meal-protein-summary';root.className='meal-person-summary';root.setAttribute('role','status');
  const meal={items:Object.values(items).flatMap(item=>{
    if(isIndividualRole(item.role)) return Object.entries(item.assignments??{}).map(([personId,assignment])=>({
      recipe:allPlanningRecipes().find(recipe=>recipe.id===assignment.recipeId),amounts:[{personId,quantity:Number(assignment.quantity)}],
    }));
    return [{recipe:allPlanningRecipes().find(recipe=>recipe.id===item.recipeId),amounts:Object.entries(item.amounts??{}).map(([personId,quantity])=>({personId,quantity:Number(quantity)}))}];
  })};
  const preferred=['bibinette','lapinou','bibou','titus'];
  const rank=id=>{const name=state.people.find(person=>person.id===id)?.displayName?.toLocaleLowerCase('fr');const index=preferred.indexOf(name);return index<0?preferred.length:index;};
  for(const personId of [...attendeeIds].sort((a,b)=>rank(a)-rank(b))){
    const person=state.people.find(person=>person.id===personId),result=calculatePersonProtein(meal,personId);
    const row=document.createElement('div');row.className='meal-person-row';
    const name=document.createElement('strong');name.textContent=`${person?.displayName??'Personne'} :`;
    const tag=document.createElement('span');tag.className=`protein-tag ${!result.known?'protein-unknown':result.grams>=MIN_PROTEIN_G_PER_MEAL?'protein-sufficient':'protein-low'}`;
    tag.textContent=`Prot : ${result.known?format(result.grams):'—'} / ${MIN_PROTEIN_G_PER_MEAL} g`;
    if(!result.known)tag.title='Quantités ou données protéiques à compléter';
    const energy=calculatePersonEnergy(meal,personId);
    const form=$('#meal-form'),profile=person && latestProfile(person,form.elements.mealDate.value);
    const daily=Number(profile?.dailyEnergyKcal),ratio=(state.mealRatios ?? SLOT_RATIOS)[form.elements.slot.value];
    const objective=Number.isFinite(daily) && daily>0 && Number.isFinite(ratio) ? daily*ratio : null;
    const energyTag=document.createElement('span');
    energyTag.className=`protein-tag ${!energy.known || objective==null?'protein-unknown':energy.kcal<=objective?'protein-sufficient':'protein-low'}`;
    energyTag.textContent=`Kcal : ${energy.known?format(energy.kcal):'—'} / ${objective==null?'—':format(objective)}`;
    energyTag.title=objective==null?'Objectif quotidien à renseigner dans le profil':`Objectif du repas : ${ratio*100} % du besoin quotidien. Les propositions automatiques autorisent une marge de 100 kcal, dans le budget quotidien restant.`;
    row.append(name,energyTag,tag);root.append(row);
  }
  return root;
}
function updateMealProteinSummary() {
  $('#meal-protein-summary')?.replaceWith(mealProteinSummary(currentFormAmounts(),$$('#meal-attendees input:checked').map(input=>input.value)));
}

function allPlanningRecipes() { return state.recipes.flatMap(recipe => [recipe,...(recipe.servingParts ?? []),...(recipe.archivedServingParts??[])]); }
function linkedParentRecipeId(item) {
  const ids=[item?.recipeId,...Object.values(item?.assignments??{}).map(assignment=>assignment.recipeId)];
  return ids.map(id=>allPlanningRecipes().find(recipe=>recipe.id===id)?.parentRecipeId).find(Boolean)??null;
}
function removeLinkedRecipeGroup(items,parentRecipeId) {
  for(const [key,item] of Object.entries(items))if(linkedParentRecipeId(item)===parentRecipeId)delete items[key];
}
function sauceDefaultQuantity(recipe) { return ['g','ml'].includes(recipe?.yield?.unitId) ? 30 : 1; }
function plannedItemRoleOptions(currentCategoryId,slot) {
  const options=[['main','Plat principal · partagé']];
  for(const category of state.mealAdditions.filter(item=>item.slots.includes(slot)||item.id===currentCategoryId))options.push([category.id,`${category.label} · choix individuel`]);
  if(currentCategoryId&&!options.some(([id])=>id===currentCategoryId))options.push([currentCategoryId,`${mealAdditionLabel(currentCategoryId)} · choix individuel`]);
  return options;
}
function recipesForPlanning(slot, role, selectedIds = [], requiredRecipeType = null) {
  const selected = new Set(selectedIds.filter(Boolean));
  const eligible = allPlanningRecipes().filter((recipe) => {
    const moments = recipe.mealMoments ?? [];
    if (moments.length && !moments.includes(slot === 'evening_snack' ? 'snack' : slot)) return false;
    if (recipe.recipeType) {
      const configuredRoles=state.mealAdditions.filter(category=>category.recipeType===recipe.recipeType).map(category=>category.role??roleForRecipeType(category.recipeType));
      const planningTypeRole=configuredRoles[0]??recipe.recipeType;
      if(requiredRecipeType&&recipe.recipeType!==requiredRecipeType)return false;
      if (!requiredRecipeType&&isIndividualRole(role) && recipe.recipeType !== role && !(role==='accompaniment'&&recipe.recipeType==='salad')) return false;
      if (!requiredRecipeType && role === 'sauce' && recipe.recipeType !== 'sauce') return false;
      if (!requiredRecipeType && role === 'accompaniment' && !['accompaniment','salad'].includes(recipe.recipeType)) return false;
      if (role === 'main' && ['beverage', 'accompaniment', 'sauce'].includes(planningTypeRole)) return false;
      if (role === 'main' && planningTypeRole === 'dessert' && !['breakfast', 'snack', 'evening_snack'].includes(slot)) return false;
    }
    if (recipe.parentRecipeId) return false;
    return true;
  });
  const kept = new Set(eligible.map((recipe) => recipe.id));
  for (const id of selected) {
    if (!kept.has(id)) {
      const recipe = allPlanningRecipes().find((entry) => entry.id === id);
      if (recipe) eligible.push(recipe);
    }
  }
  return eligible;
}

function renderPlannedItems(existing = {}, { autoSuggest = false } = {}) {
  const root = $('#planned-items');
  const saved = currentFormAmounts();
  const source = Object.keys(existing).length ? existing : saved;
  const attendees = $$('#meal-attendees input:checked').map((input) => input.value);
  if (autoSuggest) applyAutomaticPortions(source, attendees);
  const rows = Object.entries(source);
  const suggestionNotice = autoSuggest ? root.firstChild : null;
  const editorRows = rows.map(([index, item], rowIndex) => {
    const row = document.createElement('div'); row.className = 'planned-item-editor'; row.dataset.itemKey=String(rowIndex);
    const linkedRecipeId=item.recipeId||Object.values(item.assignments??{}).find(assignment=>assignment.recipeId)?.recipeId;
    const linkedRecipe=allPlanningRecipes().find(recipe=>recipe.id===linkedRecipeId&&recipe.parentRecipeId);
    const select = document.createElement('select'); select.name = 'recipeId'; select.setAttribute('aria-label', 'Recette');
    select.add(new Option('Choisir une recette', ''));
    const slot = $('#meal-form').elements.slot.value;
    const categoryId=item.categoryId??item.role??'main';
    const role = document.createElement('select'); role.name = 'role'; role.setAttribute('aria-label', 'Catégorie de l’ajout');
    plannedItemRoleOptions(categoryId,slot).forEach(([value, label]) => role.add(new Option(label, value)));
    role.value=categoryId;row.dataset.role=categoryId==='main'?'main':(mealAdditionById(categoryId)?mealAdditionRole(categoryId):(item.role??'accompaniment'));
    if(linkedRecipe){
      role.hidden=true;
      const partLabel={main:'Protéines / plat',vegetables:'Légumes',starch:'Féculents'}[linkedRecipe.servingPart]??'Composant';
      const linkedLabel=document.createElement('span');linkedLabel.className='muted linked-recipe-part';linkedLabel.textContent=`${partLabel} · ${linkedRecipe.parentRecipeName??linkedRecipe.name.split(' — ')[0]}${linkedRecipe.servingPartActive===false?' · ancienne composition conservée':''}`;
      row.dataset.linkedRecipeId=linkedRecipe.id;
      row.dataset.linkedLabel=linkedLabel.textContent;
    }
    const activeCategory=mealAdditionById(categoryId);
    const categoryRecipeType=activeCategory?.recipeType??(row.dataset.role==='accompaniment'?null:row.dataset.role);
    const currentRole=row.dataset.role;
    recipesForPlanning(slot,currentRole,[item.recipeId],currentRole==='main'?null:categoryRecipeType).forEach((recipe) => select.add(new Option(recipePlanningLabel(recipe), recipe.id)));
    select.value = item.recipeId ?? '';
    role.addEventListener('change', () => {
      const data=currentFormAmounts();const selectedId=role.value;const nextRole=selectedId==='main'?'main':mealAdditionById(selectedId)?mealAdditionRole(selectedId):(item.role??'accompaniment');
      data[index]={recipeId:'',role:nextRole,categoryId:selectedId,...(isIndividualRole(nextRole)?{assignments:{}}:{amounts:{}})};
      renderPlannedItems(data,{autoSuggest:nextRole!=='dessert'});
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-line'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Retirer cette recette');
    remove.addEventListener('click', () => { const data = currentFormAmounts();const parentId=linkedParentRecipeId(data[index]);if(parentId)removeLinkedRecipeGroup(data,parentId);else delete data[index];renderPlannedItems(data); });
    const top = document.createElement('div'); top.className = 'planned-item-top'; top.append(select, role, remove);
    if(linkedRecipe){const linkedLabel=document.createElement('span');linkedLabel.className='muted linked-recipe-part';linkedLabel.textContent=row.dataset.linkedLabel;top.insertBefore(linkedLabel,remove);}
    const quantities = document.createElement('div'); quantities.className = 'planned-amounts';
    if (isIndividualRole(currentRole)) {
      select.hidden = true;
      quantities.classList.add('beverage-amounts');
      for (const personId of attendees) {
        const person = state.people.find((entry) => entry.id === personId);
        const assignment = item.assignments?.[personId] ?? {};
        const personRow = document.createElement('label'); personRow.className = 'beverage-person'; personRow.dataset.personId = personId;
        const caption = document.createElement('span'); caption.textContent = person?.displayName ?? 'Personne';
        const choiceLabel=activeCategory?.label??mealAdditionLabel(categoryId);
        const personSelect = document.createElement('select'); personSelect.dataset.personRecipe = 'true'; personSelect.setAttribute('aria-label', `${choiceLabel} pour ${person?.displayName ?? 'personne'}`);
        personSelect.add(new Option(`Aucun${choiceLabel.toLowerCase().startsWith('accompagnement')?' accompagnement':` ${choiceLabel.toLowerCase()}`}`, ''));
        recipesForPlanning(slot,currentRole,[assignment.recipeId??linkedRecipe?.id],categoryRecipeType).forEach((recipe) => personSelect.add(new Option(recipePlanningLabel(recipe), recipe.id)));
        personSelect.value = assignment.recipeId ?? (linkedRecipe?.id??'');
        if(linkedRecipe){personSelect.hidden=true;personSelect.disabled=true;}
        const recipe = allPlanningRecipes().find((entry) => entry.id === personSelect.value);
        const unit = recipe?.yield.unitId ?? 'portion';
        const step = ['g','ml'].includes(unit) ? 'any' : unit === 'piece' ? '1' : '0.5';
        const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.step = step; input.dataset.personId = personId;
        input.value = assignment.quantity == null || assignment.quantity === '' ? (personSelect.value ? String(individualDefaultQuantity(recipe,currentRole)) : '0') : assignment.quantity; input.placeholder = '0 = aucun'; input.setAttribute('aria-label', `Quantité de ${choiceLabel.toLowerCase()} pour ${person?.displayName ?? 'personne'}`);
        input.addEventListener('input',updateMealProteinSummary);
        if (!personSelect.value) input.disabled = true;
        personSelect.addEventListener('change', () => {
          const data = currentFormAmounts();
          const rowData = data[index] ?? { recipeId: '', role: currentRole, categoryId, assignments: {} };
          rowData.assignments ??= {};
          const recipeId = personSelect.value;
          if (recipeId) {
            const quantity = $('input[data-person-id]', personRow).value;
            rowData.assignments[personId] = {
              recipeId,
              quantity: assignment.recipeId === recipeId && quantity !== '' ? quantity : String(individualDefaultQuantity(allPlanningRecipes().find(recipe=>recipe.id===recipeId),currentRole)),
            };
          } else {
            delete rowData.assignments[personId];
          }
          data[index] = rowData;
          renderPlannedItems(data);
        });
        input.addEventListener('change', () => renderPlannedItems(currentFormAmounts()));
        personRow.append(caption, personSelect, input); quantities.append(personRow);
      }
      top.classList.add('beverage-item-top');
    } else {
      for (const personId of attendees) {
        const person = state.people.find((entry) => entry.id === personId);
        const label = document.createElement('label'); label.textContent = `${person?.displayName ?? 'Personne'} · ${servingUnitLabel(servingUnit(allPlanningRecipes().find((recipe) => recipe.id === item.recipeId)))}`;
        const recipe = allPlanningRecipes().find((entry) => entry.id === item.recipeId);
        const unit = recipe?.yield.unitId ?? 'portion';
        const step = unit === 'piece' ? '1' : unit === 'g' ? '10' : '0.5';
        const input = document.createElement('input'); input.type = 'number'; input.min = unit === 'g' ? '0.01' : step; input.step = ['g','ml'].includes(unit) ? 'any' : step; input.required = true; input.dataset.personId = personId;
        input.value = item.amounts?.[personId] ?? ''; input.placeholder = 'Ex. 1'; input.setAttribute('aria-label', `Quantité pour ${person?.displayName ?? 'personne'}`);
        setServingInput(input,recipe,item.amounts?.[personId]??'');
        let previousQuantity=servingInputValue(input);
        input.addEventListener('input',()=>{
          const next=servingInputValue(input);
          let accepted=!recipe?.servingDisplay;
          if(recipe?.servingDisplay && next!=='' && previousQuantity!=='' && Number.isFinite(Number(next)) && Number(next)>=0){
            const data=currentFormAmounts();
            const result=compensateManualServing(data,allPlanningRecipes(),recipe.id,personId,Number(previousQuantity));
            if(result.ok){
              accepted=true;
              const targetRow=$$('.planned-item-editor',root).find(entry=>entry.dataset.itemKey===result.itemKey);
              const target=$$('input[data-person-id]',targetRow).find(entry=>entry.dataset.personId===personId);
              if(target)target.value=String(result.quantity);
              $('#meal-message').textContent='Partie en grammes ajustée pour conserver les calories du repas avant ta modification.';
            }else if(result.reason)$('#meal-message').textContent=result.reason;
          }
          if(accepted && next!=='' && Number.isFinite(Number(next)))previousQuantity=next;
          updateMealProteinSummary();
        });
        label.append(input); quantities.append(label);
      }
      select.addEventListener('change', () => {
        const data = currentFormAmounts();
        const recipe = state.recipes.find(recipe => recipe.id === select.value);
        const previousParentId=linkedParentRecipeId(data[index]);
        if(previousParentId)removeLinkedRecipeGroup(data,previousParentId);
        if (recipe?.servingParts?.length) {
          const main = recipe.servingParts.find(part => part.servingPart === 'main');
          const starch = recipe.servingParts.find(part => part.servingPart === 'starch');
          data[index] = {recipeId:main.id,role:currentRole,categoryId:'main',amounts:{}};
          if (starch) data[Math.max(-1,...Object.keys(data).map(Number))+1] = {recipeId:starch.id,role:'accompaniment',categoryId:'accompaniment',amounts:{}};
          const vegetables = recipe.servingParts.find(part => part.servingPart === 'vegetables');
          if (vegetables) data[Math.max(-1,...Object.keys(data).map(Number))+1] = {recipeId:vegetables.id,role:'accompaniment',categoryId:'accompaniment',amounts:{}};
        }else if(recipe)data[index]={recipeId:recipe.id,role:currentRole,categoryId:'main',amounts:{}};
        renderPlannedItems(data,{autoSuggest:true});
      });
    }
    row.append(top, quantities);
    if (allPlanningRecipes().find(recipe=>recipe.id===item.recipeId)?.parentRecipeId) {
      const estimate=document.createElement('small'); estimate.className='muted'; const counted=allPlanningRecipes().find(recipe=>recipe.id===item.recipeId)?.servingDisplay; estimate.textContent=counted ? '1 '+servingUnitLabel(counted.unitId)+' = '+formatQty(counted.gramsPerUnit)+' g selon la recette et ses équivalences. Le recalcul arrondit au plus proche et compense les calories sur la partie en grammes.' : 'Grammes estimés à partir des ingrédients et du coefficient de cuisson.'; row.append(estimate);
    }
    return row;
  });
  const summary=mealProteinSummary(source,attendees);
  if (suggestionNotice) root.replaceChildren(summary, suggestionNotice, ...editorRows);
  else root.replaceChildren(summary,...editorRows);
}

async function openMealEditor(date, slot, meal = null) {
  if(meal?.preparedAt)return;
  if (!state.people.length || !state.recipes.length) await refreshCalendar();
  state.calendarMealId = meal?.id ?? null;
  state.duplicationMeal = meal;
  const form = $('#meal-form'); form.reset();
  $('#meal-message').textContent = '';
  $('#meal-dialog-title').textContent = meal ? 'Modifier le repas' : 'Planifier un repas';
  form.elements.mealDate.value = date;
  form.elements.slot.value = slot;
  form.elements.notes.value = meal?.notes ?? '';
  form.elements.isOccasion.checked=Boolean(meal?.isOccasion);
  form.elements.occasionTitle.value=meal?.occasionTitle??'';
  state.mealOccasionEnergy=Object.fromEntries((meal?.occasionEnergy??[]).map(entry=>[entry.personId,String(entry.kcal)]));
  $('#delete-meal').classList.toggle('hidden', !meal);
  $('#duplicate-meal').classList.toggle('hidden', !meal);
  const attendeeRoot = $('#meal-attendees');
  attendeeRoot.replaceChildren(...state.people.map((person) => {
    const label = document.createElement('label'); label.className = 'attendee-option';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = person.id; checkbox.checked = Boolean(meal?.attendees?.some((entry) => entry.id === person.id)); checkbox.addEventListener('change', () => {renderPlannedItems(currentFormAmounts(), { autoSuggest: true });updateMealType();});
    const name = document.createElement('span'); name.textContent = person.displayName; label.append(checkbox, name); return label;
  }));
  const items = {};
  let nextItemIndex = 0;
  const individualRows = {};
  for (const item of meal?.items ?? []) {
    if (isIndividualRole(item.role)) {
      const categoryId=item.categoryId??item.role;
      const groups=individualRows[categoryId]??=[];
      let individualRow=groups.find(group=>item.amounts.every(amount=>!group.assignments[amount.personId]));
      if(!individualRow){individualRow={recipeId:'',role:item.role,categoryId,assignments:{}};groups.push(individualRow);}
      for (const amount of item.amounts) {
        individualRow.assignments[amount.personId] = { recipeId: item.recipeId, quantity: String(amount.quantity) };
      }
    } else {
      items[nextItemIndex++] = {
        recipeId: item.recipeId, role: item.role ?? 'main', categoryId:item.categoryId??item.role??'main',
        amounts: Object.fromEntries([
          ...(item.role === 'sauce' ? (meal.attendees ?? []).map(person=>[person.id,'0']) : []),
          ...item.amounts.map(amount=>[amount.personId,String(amount.quantity)]),
        ]),
      };
    }
  }
  for(const groups of Object.values(individualRows))for(const row of groups)items[nextItemIndex++]=row;
  if (!Object.keys(items).length) items[0] = { recipeId: '', role:'main', categoryId:'main', amounts: {} };
  renderPlannedItems(items, { autoSuggest: !meal });
  updateMealType();
  $('#meal-dialog').showModal();
}

let duplicationSource=null, pendingDuplication=null;
function openMealDuplication(meal){
  duplicationSource=meal;pendingDuplication=null;
  const form=$('#duplicate-meal-form');form.reset();
  form.elements.startDate.value=addDays(meal.mealDate,1);form.elements.endDate.value=form.elements.startDate.value;form.elements.slot.value=meal.slot;
  $('#duplicate-source').textContent=`Repas du ${displayDate(meal.mealDate)} · ${slotLabels[meal.slot]}`;
  $('#duplicate-message').textContent='';$('#meal-dialog').close();updateDuplicationPreview();$('#duplicate-meal-dialog').showModal();
}
function duplicationDates(){
  const form=$('#duplicate-meal-form'),start=form.elements.startDate.value,end=form.elements.endDate.value;
  if(!start||!end||end<start||Number.isNaN(new Date(start).getTime())||Number.isNaN(new Date(end).getTime()))return [];
  const weekdays=new Set($$('input[name="weekday"]:checked',form).map(input=>Number(input.value))),dates=[];
  let date=start;
  for(let count=0;date<=end&&count<=366;count++,date=addDays(date,1)){
    if(weekdays.has(new Date(date+'T12:00:00').getDay()) && !(date===duplicationSource.mealDate&&form.elements.slot.value===duplicationSource.slot))dates.push(date);
  }
  if(date<=end||dates.length>62)return null;
  return dates;
}
function updateDuplicationPreview(){
  const dates=duplicationDates();$('#duplicate-preview').textContent=dates===null?'Choisis au maximum 62 dates sur une période d’un an.':dates.length?`${dates.length} repas à ajouter : ${dates.map(date=>displayDate(date,{day:'numeric',month:'short'})).join(' · ')}`:'Aucune date à copier. Choisis une période et des jours.';
}
$('#duplicate-meal').addEventListener('click',()=>{
  const meal=state.duplicationMeal;if(meal)openMealDuplication(meal);
});
$('#close-duplicate-meal').addEventListener('click',()=>$('#duplicate-meal-dialog').close());
$('#duplicate-meal-form').addEventListener('change',updateDuplicationPreview);
$('#duplicate-meal-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),dates=duplicationDates();
  if(button.disabled)return;
  if(!dates?.length){showMessage($('#duplicate-message'),'Choisis de 1 à 62 dates valides.');return;}
  const payload={householdId:state.household.id,dates,slot:form.elements.slot.value},fingerprint=JSON.stringify(payload);
  if(pendingDuplication?.fingerprint!==fingerprint)pendingDuplication={fingerprint,requestId:newProductionRequestId()};
  button.disabled=true;showMessage($('#duplicate-message'),'Création des copies…');
  try{
    await api(`/api/planning/meals/${duplicationSource.id}/duplicate`,{method:'POST',body:JSON.stringify({...payload,requestId:pendingDuplication.requestId})});
    $('#duplicate-meal-dialog').close();state.calendarWeekStart=mondayOf(dates[0]);setView('calendar');await refreshCalendar();await refreshDashboard();
  }catch(error){showMessage($('#duplicate-message'),error.body?.error==='source-meal-not-found'?'Le repas source n’existe plus. Actualise le calendrier.':'Copies non créées : '+(error.body?.error??error.message));}
  finally{button.disabled=false;}
});

$('#previous-week').addEventListener('click', () => { state.calendarWeekStart = addDays(state.calendarWeekStart, -7); refreshCalendar(); });
$('#next-week').addEventListener('click', () => { state.calendarWeekStart = addDays(state.calendarWeekStart, 7); refreshCalendar(); });
$('#current-week').addEventListener('click', () => { state.calendarWeekStart = mondayOf(localDateValue()); refreshCalendar(); });
$('#manage-profiles').addEventListener('click', () => setView('profiles'));
$('#add-planned-item').addEventListener('click', () => {
  const items = currentFormAmounts(); items[Math.max(-1, ...Object.keys(items).map(Number)) + 1] = { recipeId: '', role:'main', categoryId:'main', amounts: {} }; renderPlannedItems(items);
});
$('#recalculate-portions').addEventListener('click', () => renderPlannedItems(currentFormAmounts(), { autoSuggest: true }));
$('#close-meal-dialog').addEventListener('click', () => $('#meal-dialog').close());
$('#cancel-meal').addEventListener('click', () => $('#meal-dialog').close());
$('#delete-meal').addEventListener('click', async () => {
  if (!state.calendarMealId || !state.household) return;
  try {
    await api(`/api/planning/meals/${state.calendarMealId}?householdId=${encodeURIComponent(state.household.id)}`, { method: 'DELETE' });
    $('#meal-dialog').close(); await Promise.all([refreshCalendar(),refreshDashboard()]);
  } catch (error) { showMessage($('#meal-message'), `Suppression impossible : ${error.body?.error ?? error.message}`); }
});
for (const field of ['mealDate', 'slot']) {
  $('#meal-form').elements[field].addEventListener('change', () => {renderPlannedItems(currentFormAmounts(), { autoSuggest: true });updateMealType();});
}

$('#meal-form').addEventListener('invalid', (event) => {
  const field = event.target.getAttribute('aria-label')
    ?? event.target.closest('label')?.textContent?.trim()
    ?? 'un champ obligatoire';
  showMessage($('#meal-message'), `Vérifie « ${field} » avant d’enregistrer le repas.`);
}, true);

async function saveMeal(event) {
  event.preventDefault();
  const form = $('#meal-form');
  if (!form.reportValidity()) {
    const invalid = form.querySelector(':invalid');
    if (invalid) {
      const field = invalid.getAttribute('aria-label') ?? invalid.closest('label')?.textContent?.trim() ?? 'un champ obligatoire';
      showMessage($('#meal-message'), `Vérifie « ${field} » avant d’enregistrer le repas.`);
      invalid.focus();
    }
    return;
  }
  const message = $('#meal-message');
  if (!state.household) {
    showMessage(message, 'Le foyer n’est pas chargé. Recharge la page puis réessaie.');
    message.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const attendeeIds = $$('#meal-attendees input:checked').map((input) => input.value);
  const isOccasion=form.elements.isOccasion.checked;
  const occasionEnergy=isOccasion?$$('#occasion-energy input').map(input=>({personId:input.dataset.personId,kcal:Number(input.value)})):[];
  const rows = $$('.planned-item-editor', $('#planned-items'));
  const items = isOccasion ? [] : rows.flatMap((row) => {
    const categoryId=$('select[name="role"]',row).value;
    const role=categoryId==='main'?'main':mealAdditionById(categoryId)?mealAdditionRole(categoryId):(row.dataset.role??'accompaniment');
    if (role==='main') {
      const amounts=$$('input[data-person-id]', row).map(input=>({personId:input.dataset.personId,quantity:Number(servingInputValue(input))}));
      const recipeId=$('select[name="recipeId"]',row).value;
      return recipeId?[{recipeId,role,categoryId:'main',amounts}]:[];
    }
    const byRecipe = new Map();
    $$('.beverage-person', row).forEach((personRow) => {
      const recipeId = $('select[data-person-recipe]', personRow).value;
      if (!recipeId) return;
      const quantity = Number($('input[data-person-id]', personRow).value);
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      const amounts = byRecipe.get(recipeId) ?? [];
      amounts.push({ personId: personRow.dataset.personId, quantity });
      byRecipe.set(recipeId, amounts);
    });
    return [...byRecipe].map(([recipeId, amounts]) => ({ recipeId, role, categoryId, amounts }));
  });
  if (!attendeeIds.length) { showMessage($('#meal-message'), 'Sélectionne les personnes présentes pour ce repas.'); return; }
  if(!isOccasion && (!items.length || items.some((item) => !item.recipeId))) { showMessage($('#meal-message'), 'Choisis au moins une recette pour ce repas.'); return; }
  if(isOccasion && (!form.elements.occasionTitle.value.trim() || occasionEnergy.length!==attendeeIds.length || occasionEnergy.some(entry=>!Number.isFinite(entry.kcal)||entry.kcal<0))){showMessage($('#meal-message'),'Indique le nom de l’occasion et une estimation kcal pour chaque personne présente.');return;}
  if (items.some((item) => item.role==='main' && item.amounts.length !== attendeeIds.length)
    || items.some((item) => item.amounts.length < 1 || item.amounts.some((amount) => !Number.isFinite(amount.quantity) || amount.quantity <= 0))) {
    showMessage($('#meal-message'), 'Indique une quantité positive pour chaque personne concernée par les recettes choisies.');
    return;
  }
  const submitButton = $('#save-meal');
  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Enregistrement…';
  const payload = { householdId: state.household.id, mealDate: form.elements.mealDate.value, slot: form.elements.slot.value, notes: form.elements.notes.value, attendeeIds, items, isOccasion, occasionTitle:form.elements.occasionTitle.value, occasionEnergy };
  try {
    await api(state.calendarMealId ? `/api/planning/meals/${state.calendarMealId}` : '/api/planning/meals', { method: state.calendarMealId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    $('#meal-dialog').close(); await Promise.all([refreshCalendar(),refreshDashboard()]);
  } catch (error) {
    showMessage(message, `Enregistrement impossible : ${error.body?.error ?? error.message}`);
    message.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
}

$('#meal-form').addEventListener('submit', saveMeal);
$('#save-meal').addEventListener('click', saveMeal);
$('#meal-form').elements.isOccasion.addEventListener('change',updateMealType);

