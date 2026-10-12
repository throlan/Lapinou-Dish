import { rebalanceNaturalPortions, suggestQuantity } from './portion-planner.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { offset: 0, limit: 50, query: '', onlyIncomplete: false, total: 0, household: null, debounce: null, editingRecipeId: null, importingDraftId: null, editingFoodFromRecipe: false, people: [], recipes: [], calendarWeekStart: null, calendarMealId: null, calendarMeals: [] };
const nutrientLabels = [['energyKcal', 'kcal'], ['proteinG', 'g prot.'], ['carbohydrateG', 'g gluc.'], ['fatG', 'g lip.']];

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error ?? `HTTP ${response.status}`), { status: response.status, body });
  return body;
}

function showMessage(target, text, success = false) {
  target.textContent = text;
  target.style.color = success ? '#315f42' : '';
}

function setView(name) {
  $('#foods-view').classList.toggle('hidden', name !== 'foods');
  $('#recipes-view').classList.toggle('hidden', name !== 'recipes');
  $('#calendar-view').classList.toggle('hidden', name !== 'calendar');
  $('#profiles-view').classList.toggle('hidden', name !== 'profiles');
  $$('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'recipes') refreshRecipes();
  if (name === 'calendar') refreshCalendar();
  if (name === 'profiles') refreshPeople();
}

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
  const card = document.createElement('article'); card.className = 'profile-card';
  const heading = document.createElement('div'); heading.className = 'profile-card-heading';
  const title = document.createElement('h3'); title.textContent = person.displayName;
  const birth = document.createElement('p'); birth.className = 'muted'; birth.textContent = person.birthDate ? `Né(e) le ${person.birthDate}` : 'Date de naissance non renseignée';
  heading.append(title, birth); card.append(heading);
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

async function refreshFoods() {
  const params = new URLSearchParams({ limit: String(state.limit), offset: String(state.offset) });
  if (state.query) params.set('q', state.query);
  if (state.onlyIncomplete) params.set('incomplete', 'true');
  $('#food-rows').innerHTML = '<tr><td colspan="4" class="empty">Chargement…</td></tr>';
  try {
    const { foods, total } = await api(`/api/foods?${params}`);
    state.total = total;
    $('#food-count').textContent = `${total.toLocaleString('fr-FR')} aliment${total > 1 ? 's' : ''}`;
    $('#page-label').textContent = total ? `${state.offset + 1}–${Math.min(state.offset + foods.length, total)} sur ${total}` : 'Aucun résultat';
    $('#previous-page').disabled = state.offset === 0;
    $('#next-page').disabled = state.offset + state.limit >= total;
    if (!foods.length) {
      $('#food-rows').innerHTML = '<tr><td colspan="4" class="empty">Aucun aliment trouvé.</td></tr>';
      return;
    }
    $('#food-rows').replaceChildren(...foods.map(foodRow));
  } catch {
    $('#food-rows').innerHTML = '<tr><td colspan="4" class="empty">Catalogue indisponible. Vérifie la connexion à la base.</td></tr>';
  }
}

function foodRow(food) {
  const row = document.createElement('tr');
  const name = document.createElement('td');
  const strong = document.createElement('strong'); strong.textContent = food.name;
  const small = document.createElement('small'); small.textContent = [food.brand, food.source === 'ciqual' ? `Ciqual ${food.source_reference ?? ''}` : food.source].filter(Boolean).join(' · ');
  const requiredValues = ['energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fibre_g'];
  const hasMissingNutrition = requiredValues.some((key) => food.nutrients_per_100g?.[key] == null);
  if (hasMissingNutrition) small.textContent += `${small.textContent ? ' · ' : ''}À compléter`;
  name.append(strong, small);
  const source = document.createElement('td'); source.textContent = food.source === 'ciqual' ? 'Ciqual' : food.source === 'manual' ? 'Saisie manuelle' : food.source;
  const values = document.createElement('td'); values.className = 'food-nutrients';
  values.textContent = nutrientLabels.map(([key, unit]) => `${format(food.nutrients_per_100g?.[key === 'energyKcal' ? 'energy_kcal' : key === 'proteinG' ? 'protein_g' : key === 'carbohydrateG' ? 'carbohydrate_g' : 'fat_g'])} ${unit}`).join(' · ');
  const action = document.createElement('td'); action.className = 'food-actions';
  const button = document.createElement('button'); button.className = 'secondary'; button.textContent = 'Modifier'; button.addEventListener('click', () => openFoodEditor(food.id)); action.append(button);
  if (hasMissingNutrition) {
    const complete = document.createElement('button'); complete.className = 'primary'; complete.textContent = 'Compléter';
    complete.setAttribute('aria-label', `Rechercher des valeurs nutritionnelles manquantes pour ${food.name}`);
    complete.addEventListener('click', () => openFoodEditor(food.id, { searchExternal: true })); action.append(complete);
  }
  row.append(name, source, values, action); return row;
}

function format(value) { return value == null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Number(value)); }

async function openFoodEditor(id = null, { searchExternal = false, fromRecipe = false } = {}) {
  state.editingFoodFromRecipe = fromRecipe;
  const form = $('#food-form'); form.reset(); form.elements.id.value = '';
  $('#food-message').textContent = '';
  $('#food-dialog-title').textContent = id ? 'Modifier cet aliment' : 'Nouvel aliment';
  if (id) {
    try {
      const { food } = await api(`/api/foods/${id}`);
      form.elements.id.value = food.id;
      form.elements.name.value = food.name;
      form.elements.brand.value = food.brand ?? '';
      form.elements.aliases.value = (food.aliases ?? []).filter((alias) => alias !== food.name).join(', ');
      for (const key of ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fibreG']) form.elements[key].value = food.nutrientsPer100g?.[key] ?? '';
      form.elements.gramsPerMillilitre.value = food.gramsPerMillilitre ?? '';
      form.elements.pieceGrams.value = food.gramsPerUnit?.piece ?? '';
      $('#nutrition-completion').classList.remove('hidden');
      $('#nutrition-matches').replaceChildren();
      $('#nutrition-matches').dataset.foodId = food.id;
    } catch { showMessage($('#food-message'), 'Impossible de charger cette fiche.'); return; }
  } else {
    $('#nutrition-completion').classList.add('hidden');
    $('#nutrition-matches').replaceChildren();
  }
  $('#food-dialog').showModal();
  if (id && searchExternal) $('#find-external-nutrition').click();
}

$('#food-search').addEventListener('input', (event) => {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(() => { state.query = event.target.value.trim(); state.offset = 0; refreshFoods(); }, 180);
});
$('#food-incomplete').addEventListener('change', (event) => { state.onlyIncomplete = event.target.checked; state.offset = 0; refreshFoods(); });
$('#previous-page').addEventListener('click', () => { state.offset = Math.max(0, state.offset - state.limit); refreshFoods(); });
$('#next-page').addEventListener('click', () => { state.offset += state.limit; refreshFoods(); });
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

$$('.nav-button').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

$('#food-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const numeric = (name) => form.elements[name].value === '' ? null : Number(form.elements[name].value);
  const payload = {
    name: form.elements.name.value,
    brand: form.elements.brand.value || null,
    aliases: form.elements.aliases.value.split(',').map((value) => value.trim()).filter(Boolean),
    nutrientsPer100g: Object.fromEntries(['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fibreG'].map((key) => [key, numeric(key)])),
    gramsPerMillilitre: numeric('gramsPerMillilitre'),
    gramsPerUnit: numeric('pieceGrams') === null ? {} : { piece: numeric('pieceGrams') },
  };
  const id = form.elements.id.value;
  try {
    const result = await api(id ? `/api/foods/${id}` : '/api/foods', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    $('#food-dialog').close();
    await refreshFoods();
    if (state.editingFoodFromRecipe) showMessage($('#recipe-message'), 'Fiche mise à jour. Les valeurs seront recalculées à l’enregistrement de la recette.', true);
  } catch (error) {
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
        try { await api('/api/households', { method: 'POST', body: JSON.stringify({ name: $('#household-name').value }) }); await loadHouseholds(); }
        catch { $('#household-box').insertAdjacentText('beforeend', ' — création impossible'); }
      });
    }
  } catch { $('#household-box').textContent = 'Base de données indisponible'; }
}

function addRecipeLine(initial = null) {
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
    if (select.value) { search.value = ''; search.classList.add('hidden'); row.classList.add('has-match'); changeMatch.classList.remove('hidden'); editFood.classList.remove('hidden'); }
    else { search.classList.remove('hidden'); row.classList.remove('has-match'); changeMatch.classList.add('hidden'); editFood.classList.add('hidden'); }
  });
  const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '0.01'; quantity.step = 'any';
  quantity.value = initial && Object.hasOwn(initial, 'quantity') ? String(initial.quantity ?? '') : '100';
  quantity.placeholder = quantity.value ? '' : 'À préciser'; quantity.required = true; quantity.setAttribute('aria-label', 'Quantité');
  const unit = document.createElement('select'); unit.setAttribute('aria-label', 'Unité');
  for (const [id, label] of [['g','g'],['kg','kg'],['ml','ml'],['l','l'],['tsp','c. à café'],['tbsp','c. à soupe'],['cup','tasse'],['piece','pièce']]) unit.add(new Option(label, id));
  if (initial?.unitId) unit.value = initial.unitId;
  unit.addEventListener('change', () => { if (search.value.trim().length >= 2) search.dispatchEvent(new Event('input')); });
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-line'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Supprimer cet ingrédient'); remove.addEventListener('click', () => row.remove());
  foodBox.append(search, select, changeMatch, editFood, incompleteTag, hint); row.append(foodBox, quantity, unit, remove); $('#recipe-lines').append(row);
  if (initial?.foodId) changeMatch.classList.remove('hidden');
  // Imported ingredient names are already a useful search query. Trigger the
  // same lookup as typing so the dropdown is populated during recipe review.
  if (initial?.foodName && !initial?.foodId) search.dispatchEvent(new Event('input'));
}

$('#add-line').addEventListener('click', addRecipeLine);
$('#new-recipe').addEventListener('click', () => openRecipeEditor());
$('#cancel-recipe').addEventListener('click', () => { $('#recipe-form').classList.add('hidden'); $('#recipe-result').classList.add('hidden'); });
$('#recipe-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#recipe-message'); message.textContent = '';
  if (!state.household) { showMessage(message, 'Crée d’abord un foyer en haut de la page.'); return; }
  const lines = $$('.recipe-line').map((row) => ({ foodId: $('select[aria-label="Aliment lié"]', row).value, quantity: Number($('input[aria-label="Quantité"]', row).value), unitId: $('select[aria-label="Unité"]', row).value }));
  const unmatched = $$('.recipe-line').filter((row) => !$('select[aria-label="Aliment lié"]', row).value)
    .map((row) => $('input[type="search"]', row).value.trim()).filter(Boolean);
  if (lines.some((line) => !line.foodId)) {
    showMessage(message, unmatched.length
      ? `Aliments à créer ou associer : ${unmatched.join(', ')}.`
      : 'Associe chaque ligne à un aliment du catalogue.');
    return;
  }
  const form = event.currentTarget;
  try {
    const path = state.editingRecipeId ? `/api/recipes/${state.editingRecipeId}` : '/api/recipes';
    const method = state.editingRecipeId ? 'PUT' : 'POST';
    const { recipe } = await api(path, { method, body: JSON.stringify({ name: form.elements.name.value, description: form.elements.description.value, instructions: form.elements.instructions.value, sourceUrl: form.elements.sourceUrl.value || null, householdId: state.household.id, yield: { amount: Number(form.elements.yieldAmount.value), unitId: form.elements.yieldUnit.value }, lines }) });
    if (state.importingDraftId) {
      await api(`/api/recipe-imports/${state.importingDraftId}/converted`, { method: 'POST', body: JSON.stringify({ householdId: state.household.id }) });
      state.importingDraftId = null;
    }
    renderRecipe(recipe); showMessage(message, 'Recette enregistrée. Les valeurs affichées sont calculées depuis le catalogue.', true);
    state.editingRecipeId = null;
    $('#recipe-form-title').textContent = 'Nouvelle recette';
    $('#recipe-form').classList.add('hidden');
    await refreshRecipes();
  } catch (error) { showMessage(message, `Enregistrement impossible : ${error.body?.error ?? error.message}`); }
});

async function openRecipeEditor(id = null) {
  const form = $('#recipe-form');
  form.reset();
  $('#recipe-lines').replaceChildren();
  $('#recipe-message').textContent = '';
  $('#recipe-result').classList.add('hidden');
  state.editingRecipeId = id;
  state.importingDraftId = null;
  $('#recipe-form-title').textContent = id ? 'Modifier la recette' : 'Nouvelle recette';
  if (id) {
    try {
      const { recipe } = await api(`/api/recipes/${id}`);
      form.elements.name.value = recipe.name;
      form.elements.description.value = recipe.description ?? '';
      form.elements.sourceUrl.value = recipe.sourceUrl ?? '';
      form.elements.instructions.value = recipe.instructions ?? '';
      form.elements.yieldAmount.value = recipe.yield.amount;
      form.elements.yieldUnit.value = recipe.yield.unitId;
      const incompleteLines = new Set((recipe.nutrition.lineIssues ?? []).map((issue) => issue.lineIndex));
      recipe.lines.forEach((line, index) => addRecipeLine({ ...line, incomplete: incompleteLines.has(index) }));
    } catch (error) {
      showMessage($('#recipe-message'), `Impossible de charger cette recette : ${error.body?.error ?? error.message}`);
      form.classList.remove('hidden');
      return;
    }
  } else addRecipeLine();
  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function refreshRecipes() {
  const list = $('#recipe-list');
  if (!state.household) { list.innerHTML = '<p class="empty">Crée d’abord un foyer pour enregistrer des recettes.</p>'; return; }
  list.innerHTML = '<p class="empty">Chargement des recettes…</p>';
  try {
    const { recipes } = await api(`/api/recipes?householdId=${encodeURIComponent(state.household.id)}`);
    state.recipes = recipes;
    list.replaceChildren(...(recipes.length ? recipes.map(recipeCard) : [emptyMessage('Aucune recette enregistrée.')]));
  } catch (error) {
    const message = document.createElement('p'); message.className = 'empty'; message.textContent = `Liste indisponible : ${error.body?.error ?? error.message}`; list.replaceChildren(message);
  }
  await refreshImportDrafts();
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
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = 'Vérifier'; button.addEventListener('click', () => openImportDraft(draft));
      const discard = document.createElement('button'); discard.type = 'button'; discard.className = 'secondary'; discard.textContent = 'Ignorer'; discard.addEventListener('click', async () => {
        try { await api(`/api/recipe-imports/${draft.id}/discarded`, { method: 'POST', body: JSON.stringify({ householdId: state.household.id }) }); await refreshImportDrafts(); }
        catch { showMessage($('#recipe-import-message'), 'Impossible d’ignorer ce brouillon.'); }
      });
      actions.append(button, discard); row.append(copy, actions); return row;
    }));
  } catch { list.replaceChildren(emptyMessage('Impossible de charger les brouillons importés.')); }
}

function openImportDraft(draft) {
  const form = $('#recipe-form'); form.reset(); $('#recipe-lines').replaceChildren();
  state.editingRecipeId = null; state.importingDraftId = draft.id;
  $('#recipe-form-title').textContent = 'Vérifier la recette importée';
  form.elements.name.value = draft.name || '';
  form.elements.description.value = draft.description || '';
  form.elements.instructions.value = draft.instructions || '';
  form.elements.yieldAmount.value = draft.yieldAmount || 1;
  form.elements.yieldUnit.value = draft.yieldUnitId || 'portion';
  form.elements.sourceUrl.value = draft.sourceUrl || '';
  for (const line of draft.ingredients) addRecipeLine({ foodName: line.foodName || line.rawText, quantity: line.quantity, unitId: line.unitId || toUnitId(line.rawText) });
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
  try {
    const result = await api('/api/recipe-imports/text', { method: 'POST', body: JSON.stringify({ householdId: state.household.id, text: form.elements.text.value, sourceUrl: form.elements.sourceUrl.value || null }) });
    form.reset(); showMessage($('#recipe-import-message'), 'Recette ajoutée aux brouillons. Associe ses ingrédients aux aliments du catalogue.', true);
    await refreshImportDrafts();
    const { drafts } = await api(`/api/recipe-imports?householdId=${encodeURIComponent(state.household.id)}`);
    const draft = drafts.find((item) => item.id === result.drafts?.[0]?.id);
    if (draft) openImportDraft(draft);
  } catch (error) { showMessage($('#recipe-import-message'), `Import impossible : ${error.body?.error ?? error.message}`); }
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

function recipeCard(recipe) {
  const card = document.createElement('article'); card.className = 'recipe-card';
  const details = document.createElement('div');
  const title = document.createElement('h3'); title.textContent = recipe.name; details.append(title);
  const subtitle = document.createElement('p'); subtitle.textContent = `${recipe.lines.length} ingrédient${recipe.lines.length === 1 ? '' : 's'} · rendement ${format(recipe.yield.amount)} ${recipe.yield.unitId}`; details.append(subtitle);
  const nutrition = document.createElement('p'); nutrition.className = 'recipe-nutrition';
  nutrition.textContent = `${format(recipe.nutrition.perYieldUnit.energyKcal)} kcal · P ${format(recipe.nutrition.perYieldUnit.proteinG)} g · G ${format(recipe.nutrition.perYieldUnit.carbohydrateG)} g · L ${format(recipe.nutrition.perYieldUnit.fatG)} g / ${recipe.yield.unitId}`;
  details.append(nutrition);
  if (recipe.nutrition.unresolvedLineIndexes?.length) {
    const partial = document.createElement('p'); partial.className = 'muted'; partial.textContent = 'Sous-total partiel : les ingrédients sans conversion sont exclus.'; details.append(partial);
  }
  if (!recipe.nutrition.complete) details.append(nutritionIssues(recipe));
  const actions = document.createElement('div'); actions.className = 'recipe-card-actions';
  const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary'; edit.textContent = 'Modifier'; edit.addEventListener('click', () => openRecipeEditor(recipe.id));
  actions.append(edit); card.append(details, actions); return card;
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
    const name = line?.foodName || `Ingrédient ${issue.lineIndex + 1}`;
    if (issue.reason === 'unit-conversion-missing') item.textContent = `${name} (${format(line.quantity)} ${line.unitId}) : conversion en grammes inconnue pour cet aliment.`;
    else if (issue.reason === 'food-not-linked') item.textContent = `${name} : aucun aliment du catalogue associé.`;
    else item.textContent = `${name} : valeur${issue.missingNutrients.length > 1 ? 's' : ''} manquante${issue.missingNutrients.length > 1 ? 's' : ''} pour ${issue.missingNutrients.map((key) => nutrientNames[key] ?? key).join(', ')}.`;
    list.append(item);
  }
  if (!list.childElementCount) { const item = document.createElement('li'); item.textContent = 'Vérifie les conversions et les valeurs nutritionnelles des aliments.'; list.append(item); }
  return list;
}

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
  await Promise.all([refreshFoods(), loadHouseholds(), health]);
  await Promise.all([refreshPeople(), refreshCalendar()]);
  addRecipeLine();
}

$('#person-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.household) { showMessage($('#people-message'), 'Crée d’abord un foyer.'); return; }
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    await api('/api/people', { method: 'POST', body: JSON.stringify({ householdId: state.household.id, ...data }) });
    form.reset(); showMessage($('#people-message'), 'Profil ajouté.', true); await refreshPeople();
  } catch (error) { showMessage($('#people-message'), error.body?.error === 'person-already-exists' ? 'Ce nom de profil existe déjà dans le foyer.' : 'Impossible de créer le profil.'); }
});

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ password: event.currentTarget.elements.password.value }) });
    event.currentTarget.reset();
    $('#login-dialog').close();
    await init();
  } catch (error) {
    showMessage($('#login-message'), error.body?.error === 'invalid-password' ? 'Mot de passe incorrect.' : 'Connexion impossible. Vérifie que le service est prêt.');
  }
});

init();



const slotLabels = { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner', snack: 'Collation' };
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
    const [plan, peopleResult, recipesResult] = await Promise.all([
      api(`/api/planning?householdId=${encodeURIComponent(state.household.id)}&weekStart=${state.calendarWeekStart}`),
      api(`/api/people?householdId=${encodeURIComponent(state.household.id)}`),
      api(`/api/recipes?householdId=${encodeURIComponent(state.household.id)}`),
    ]);
    state.people = peopleResult.people;
    state.recipes = recipesResult.recipes;
    state.calendarMeals = plan.meals ?? [];
    const end = addDays(state.calendarWeekStart, 6);
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
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const section = document.createElement('section'); section.className = 'calendar-slot';
    const slotHeading = document.createElement('div'); slotHeading.className = 'calendar-slot-heading';
    const label = document.createElement('span'); label.textContent = slotLabels[slot];
    const add = document.createElement('button'); add.type = 'button'; add.className = 'calendar-add'; add.textContent = '+ Ajouter';
    add.addEventListener('click', () => openMealEditor(date, slot));
    slotHeading.append(label, add); section.append(slotHeading);
    for (const meal of meals.filter((item) => item.mealDate === date && item.slot === slot)) section.append(renderMealCard(meal));
    day.append(section);
  }
  const footer = document.createElement('footer');
  const calories = meals.filter((meal) => meal.mealDate === date).reduce((sum, meal) => sum + mealCalories(meal), 0);
  footer.textContent = calories ? `${format(calories)} kcal-personnes prévus` : 'Prévisions';
  day.append(footer);
  return day;
}

function mealCalories(meal) {
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
  edit.textContent = meal.items?.map((item) => item.recipe?.name ?? 'Recette supprimée').join(' + ') || 'Repas sans recette';
  const attendee = document.createElement('small'); attendee.textContent = meal.attendees?.map((person) => person.displayName).join(', ') || 'Aucune personne sélectionnée';
  const kcal = mealCalories(meal);
  const partial = meal.items?.some((item) => !item.recipe?.nutrition?.complete) ?? false;
  const total = document.createElement('small'); total.className = 'meal-kcal'; total.textContent = kcal ? `${partial ? 'Sous-total partiel' : 'Total'} · ${format(kcal)} kcal` : 'Valeurs inconnues ou incomplètes';
  card.append(edit, attendee, total);
  edit.addEventListener('click', () => openMealEditor(meal.mealDate, meal.slot, meal));
  return card;
}

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
    total.textContent = daysPlanned ? `${format(totalKcal)} kcal prévues sur ${daysPlanned} jour${daysPlanned > 1 ? 's' : ''}${incomplete ? ' · données incomplètes' : ''}` : 'Aucun repas planifié';
    row.append(name, total);
    const profile = latestProfile(person, dateOnly(new Date()));
    if (profile?.dailyEnergyKcal) {
      const target = document.createElement('small'); target.textContent = `Repère quotidien saisi : ${profile.dailyEnergyKcal} kcal · ${activityLabels[profile.activityLevel] ?? 'activité non renseignée'}`; row.append(target);
    } else {
      const target = document.createElement('small'); target.className = 'muted'; target.textContent = 'Besoin quotidien non renseigné'; row.append(target);
    }
    summary.append(row);
  }
  const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Estimations prévues à partir des recettes. Les données inconnues restent visibles; ce récapitulatif ne représente pas une consommation réelle.'; summary.append(note);
}

function currentFormAmounts() {
  const output = {};
  $$('.planned-item-editor', $('#planned-items')).forEach((row, index) => {
    const role = $('select[name="role"]', row)?.value ?? 'main';
    if (role === 'beverage') {
      const assignments = {};
      $$('.beverage-person', row).forEach((personRow) => {
        const personId = personRow.dataset.personId;
        const recipeId = $('select[data-person-recipe]', personRow)?.value ?? '';
        const quantity = $('input[data-person-id]', personRow)?.value ?? '';
        if (recipeId) assignments[personId] = { recipeId, quantity };
      });
      const sharedRecipeId = $('select[name="recipeId"]', row)?.value;
      if (!Object.keys(assignments).length && sharedRecipeId) {
        $('input[data-person-id]', row).forEach((input) => {
          assignments[input.dataset.personId] = { recipeId: sharedRecipeId, quantity: input.value };
        });
      }
      output[index] = { recipeId: '', role, assignments };
      return;
    }
    const assignments = {};
    $('.beverage-person', row).forEach((personRow) => {
      const recipeId = $('select[data-person-recipe]', personRow)?.value ?? '';
      if (recipeId) assignments[personRow.dataset.personId] = { recipeId, quantity: $('input[data-person-id]', personRow)?.value ?? '' };
    });
    const recipeId = $('select[name="recipeId"]', row)?.value || Object.values(assignments)[0]?.recipeId || '';
    const amounts = {};
    if (Object.keys(assignments).length) Object.entries(assignments).forEach(([personId, assignment]) => { amounts[personId] = assignment.quantity; });
    else $('input[data-person-id]', row).forEach((input) => { amounts[input.dataset.personId] = input.value; });
    output[index] = { recipeId, role, amounts };
  });
  return output;
}

function plannedCaloriesForPerson(meal, personId) {
  if (!meal.attendees?.some((person) => person.id === personId)) return 0;
  return (meal.items ?? []).reduce((sum, item) => {
    const amount = item.amounts?.find((entry) => entry.personId === personId);
    const energy = item.recipe?.nutrition?.perYieldUnit?.energyKcal;
    return amount && energy != null ? sum + amount.quantity * energy : sum;
  }, 0);
}

function applyAutomaticPortions(items, attendeeIds) {
  const date = $('#meal-form').elements.mealDate.value;
  const slot = $('#meal-form').elements.slot.value;
  const roleWeights = { main: 0.7, accompaniment: 0.2, beverage: 0.1 };
  const selectedItems = Object.values(items).filter((item) => item.recipeId || (item.role === 'beverage' && Object.keys(item.assignments ?? {}).length));
  const roleCounts = Object.fromEntries(Object.keys(roleWeights).map((role) => [role, selectedItems.filter((item) => (item.role ?? 'main') === role).length]));
  const activeWeight = Object.entries(roleCounts).reduce((sum, [role, count]) => sum + (count ? roleWeights[role] : 0), 0);
  const messages = new Set();
  for (const personId of attendeeIds) {
    const person = state.people.find((entry) => entry.id === personId);
    const profile = person && latestProfile(person, date);
    const plannedOtherKcal = state.calendarMeals
      .filter((meal) => meal.mealDate === date && meal.id !== state.calendarMealId)
      .reduce((sum, meal) => sum + plannedCaloriesForPerson(meal, personId), 0);
    const proposals = [];
    for (const item of selectedItems) {
      const role = item.role ?? 'main';
      const assignment = role === 'beverage' ? item.assignments?.[personId] : null;
      const recipeId = role === 'beverage' ? assignment?.recipeId : item.recipeId;
      if (!recipeId) continue;
      const recipe = state.recipes.find((entry) => entry.id === recipeId);
      const kcal = recipe?.nutrition?.perYieldUnit?.energyKcal;
      const recipeUnit = recipe?.yield.unitId ?? 'portion';
      const step = recipeUnit === 'piece' ? 1 : recipeUnit === 'g' ? 10 : 0.5;
      const suggestion = suggestQuantity({
        dailyTargetKcal: profile?.dailyEnergyKcal,
        slot,
        plannedOtherKcal,
        recipeKcal: kcal,
        recipeUnit,
        recipeCount: roleCounts[role] || 1,
        budgetShare: activeWeight ? roleWeights[role] / activeWeight : 1,
      });
      if (role === 'beverage') assignment.quantity = suggestion.quantity == null ? '' : String(suggestion.quantity);
      else {
        item.amounts ??= {};
        const fallbackQuantity = suggestion.quantity == null && ['daily-target-missing', 'recipe-energy-missing'].includes(suggestion.reason)
          ? (recipeUnit === 'g' ? 10 : 1)
          : null;
        item.amounts[personId] = suggestion.quantity == null ? (fallbackQuantity == null ? '' : String(fallbackQuantity)) : String(suggestion.quantity);
      }
      const quantity = role === 'beverage' ? (suggestion.quantity == null ? null : suggestion.quantity) : (suggestion.quantity ?? (['daily-target-missing', 'recipe-energy-missing'].includes(suggestion.reason) ? (recipeUnit === 'g' ? 10 : 1) : null));
      if (suggestion.reason === 'daily-target-missing') messages.add(`${person?.displayName ?? 'Une personne'} : besoin quotidien manquant, une quantité par défaut est proposée.`);
      else if (suggestion.reason === 'recipe-energy-missing') messages.add(`${recipe?.name ?? 'Une recette'} : calories inconnues, la quantité par défaut ne peut pas garantir le budget.`);
      else if (suggestion.reason === 'daily-budget-used') messages.add(`${person?.displayName ?? 'Une personne'} : enveloppe quotidienne déjà atteinte.`);
      else if (suggestion.reason === 'no-natural-portion-fits' && role !== 'beverage') messages.add(`${recipe?.name ?? 'Une recette'} : aucune portion entière ou demi-portion ne tient dans le budget restant.`);
      proposals.push({ item, personId, role, quantity, reason: suggestion.reason, step, recipeKcal: Number(kcal), slotBudgetKcal: suggestion.slotBudgetKcal, assignment });
    }
    const budget = proposals.find((proposal) => Number.isFinite(proposal.slotBudgetKcal))?.slotBudgetKcal;
    if (Number.isFinite(budget) && proposals.length && proposals.every((proposal) => Number.isFinite(proposal.recipeKcal) && proposal.recipeKcal > 0)) {
      const result = rebalanceNaturalPortions(proposals, budget);
      result.proposals.forEach((proposal) => {
        if (proposal.role === 'beverage') proposal.assignment.quantity = proposal.quantity == null ? '' : String(proposal.quantity);
        else proposal.item.amounts[personId] = proposal.quantity == null ? '' : String(proposal.quantity);
      });
      if (result.beverageAdded) messages.add(`${person?.displayName ?? 'Une personne'} : une boisson entière est proposée; le surplus au-delà des 10 % indicatifs est pris sur la recette principale, dans la limite du créneau.`);
      else if (result.proposals.some((proposal) => proposal.role === 'beverage' && proposal.quantity == null && proposal.reason === 'no-natural-portion-fits')) messages.add(`${person?.displayName ?? 'Une personne'} : aucune boisson entière ne tient dans le budget restant après ajustement des autres recettes.`);
    }
  }
  const notice = document.createElement('p');
  notice.className = messages.size ? 'form-message warning' : 'form-message';
  notice.setAttribute('role', 'status');
  notice.textContent = messages.size
    ? [...messages].join(' ')
    : 'Répartition indicative : 70 % recette principale, 20 % accompagnements et 10 % boisson. Chacun choisit sa boisson ou peut ne pas en prendre; une boisson entière peut dépasser sa part, le surplus est pris sur le plat sans dépasser le budget du créneau ni celui de la journée.';
  $('#planned-items').replaceChildren(notice);
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
    const row = document.createElement('div'); row.className = 'planned-item-editor';
    const select = document.createElement('select'); select.name = 'recipeId'; select.setAttribute('aria-label', 'Recette');
    select.add(new Option('Choisir une recette', ''));
    state.recipes.forEach((recipe) => select.add(new Option(`${recipe.name} · ${recipe.yield.amount} ${recipe.yield.unitId}`, recipe.id)));
    select.value = item.recipeId ?? '';
    const role = document.createElement('select'); role.name = 'role'; role.setAttribute('aria-label', 'Catégorie de la recette');
    [['main', 'Recette principale · 70 %'], ['accompaniment', 'Accompagnement · 20 %'], ['beverage', 'Boisson · 10 %']].forEach(([value, label]) => role.add(new Option(label, value)));
    role.value = item.role ?? 'main';
    role.addEventListener('change', () => renderPlannedItems(currentFormAmounts(), { autoSuggest: true }));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-line'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Retirer cette recette');
    remove.addEventListener('click', () => { const data = currentFormAmounts(); delete data[index]; renderPlannedItems(data); });
    const top = document.createElement('div'); top.className = 'planned-item-top'; top.append(select, role, remove);
    const quantities = document.createElement('div'); quantities.className = 'planned-amounts';
    if (role.value === 'beverage') {
      select.hidden = true;
      quantities.classList.add('beverage-amounts');
      for (const personId of attendees) {
        const person = state.people.find((entry) => entry.id === personId);
        const assignment = item.assignments?.[personId] ?? {};
        const personRow = document.createElement('label'); personRow.className = 'beverage-person'; personRow.dataset.personId = personId;
        const caption = document.createElement('span'); caption.textContent = person?.displayName ?? 'Personne';
        const personSelect = document.createElement('select'); personSelect.dataset.personRecipe = 'true'; personSelect.setAttribute('aria-label', `Boisson pour ${person?.displayName ?? 'personne'}`);
        personSelect.add(new Option('Aucune boisson', ''));
        state.recipes.forEach((recipe) => personSelect.add(new Option(`${recipe.name} · ${recipe.yield.amount} ${recipe.yield.unitId}`, recipe.id)));
        personSelect.value = assignment.recipeId ?? '';
        const recipe = state.recipes.find((entry) => entry.id === personSelect.value);
        const unit = recipe?.yield.unitId ?? 'portion';
        const step = unit === 'piece' ? '1' : unit === 'g' ? '10' : '0.5';
        const input = document.createElement('input'); input.type = 'number'; input.min = step; input.step = step; input.dataset.personId = personId;
        input.value = assignment.quantity ?? ''; input.placeholder = 'Quantité'; input.setAttribute('aria-label', `Quantité de boisson pour ${person?.displayName ?? 'personne'}`);
        if (!personSelect.value) input.disabled = true;
        personSelect.addEventListener('change', () => renderPlannedItems(currentFormAmounts(), { autoSuggest: true }));
        personRow.append(caption, personSelect, input); quantities.append(personRow);
      }
      top.classList.add('beverage-item-top');
    } else {
      for (const personId of attendees) {
        const person = state.people.find((entry) => entry.id === personId);
        const label = document.createElement('label'); label.textContent = `${person?.displayName ?? 'Personne'} · ${state.recipes.find((recipe) => recipe.id === item.recipeId)?.yield.unitId ?? 'portion'}`;
        const recipe = state.recipes.find((entry) => entry.id === item.recipeId);
        const unit = recipe?.yield.unitId ?? 'portion';
        const step = unit === 'piece' ? '1' : unit === 'g' ? '10' : '0.5';
        const input = document.createElement('input'); input.type = 'number'; input.min = step; input.step = step; input.required = true; input.dataset.personId = personId;
        input.value = item.amounts?.[personId] ?? ''; input.placeholder = 'Ex. 1'; input.setAttribute('aria-label', `Quantité pour ${person?.displayName ?? 'personne'}`);
        label.append(input); quantities.append(label);
      }
      select.addEventListener('change', () => renderPlannedItems(currentFormAmounts(), { autoSuggest: true }));
    }
    row.append(top, quantities); return row;
  });
  if (suggestionNotice) root.replaceChildren(suggestionNotice, ...editorRows);
  else root.replaceChildren(...editorRows);
}

async function openMealEditor(date, slot, meal = null) {
  if (!state.people.length || !state.recipes.length) await refreshCalendar();
  state.calendarMealId = meal?.id ?? null;
  const form = $('#meal-form'); form.reset();
  $('#meal-message').textContent = '';
  $('#meal-dialog-title').textContent = meal ? 'Modifier le repas' : 'Planifier un repas';
  form.elements.mealDate.value = date;
  form.elements.slot.value = slot;
  form.elements.notes.value = meal?.notes ?? '';
  $('#delete-meal').classList.toggle('hidden', !meal);
  const attendeeRoot = $('#meal-attendees');
  attendeeRoot.replaceChildren(...state.people.map((person) => {
    const label = document.createElement('label'); label.className = 'attendee-option';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = person.id; checkbox.checked = Boolean(meal?.attendees?.some((entry) => entry.id === person.id)); checkbox.addEventListener('change', () => renderPlannedItems(currentFormAmounts(), { autoSuggest: true }));
    const name = document.createElement('span'); name.textContent = person.displayName; label.append(checkbox, name); return label;
  }));
  const items = {};
  (meal?.items ?? []).forEach((item, index) => { items[index] = item.role === 'beverage'
    ? { recipeId: '', role: 'beverage', assignments: Object.fromEntries(item.amounts.map((amount) => [amount.personId, { recipeId: item.recipeId, quantity: String(amount.quantity) }])) }
    : { recipeId: item.recipeId, role: item.role ?? 'main', amounts: Object.fromEntries(item.amounts.map((amount) => [amount.personId, String(amount.quantity)])) }; });
  if (!Object.keys(items).length) items[0] = { recipeId: '', amounts: {} };
  renderPlannedItems(items, { autoSuggest: true });
  $('#meal-dialog').showModal();
}

$('#previous-week').addEventListener('click', () => { state.calendarWeekStart = addDays(state.calendarWeekStart, -7); refreshCalendar(); });
$('#next-week').addEventListener('click', () => { state.calendarWeekStart = addDays(state.calendarWeekStart, 7); refreshCalendar(); });
$('#current-week').addEventListener('click', () => { state.calendarWeekStart = mondayOf(localDateValue()); refreshCalendar(); });
$('#manage-profiles').addEventListener('click', () => setView('profiles'));
$('#add-planned-item').addEventListener('click', () => {
  const items = currentFormAmounts(); items[Math.max(-1, ...Object.keys(items).map(Number)) + 1] = { recipeId: '', amounts: {} }; renderPlannedItems(items);
});
$('#close-meal-dialog').addEventListener('click', () => $('#meal-dialog').close());
$('#cancel-meal').addEventListener('click', () => $('#meal-dialog').close());
$('#delete-meal').addEventListener('click', async () => {
  if (!state.calendarMealId || !state.household) return;
  try {
    await api(`/api/planning/meals/${state.calendarMealId}?householdId=${encodeURIComponent(state.household.id)}`, { method: 'DELETE' });
    $('#meal-dialog').close(); await refreshCalendar();
  } catch (error) { showMessage($('#meal-message'), `Suppression impossible : ${error.body?.error ?? error.message}`); }
});
for (const field of ['mealDate', 'slot']) {
  $('#meal-form').elements[field].addEventListener('change', () => renderPlannedItems(currentFormAmounts(), { autoSuggest: true }));
}

$('#meal-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.household) return;
  const attendeeIds = $$('#meal-attendees input:checked').map((input) => input.value);
  const rows = $$('.planned-item-editor', $('#planned-items'));
  const items = rows.flatMap((row) => {
    const role = $('select[name="role"]', row).value;
    if (role !== 'beverage') return [{
      recipeId: $('select[name="recipeId"]', row).value,
      role,
      amounts: $('input[data-person-id]', row).map((input) => ({ personId: input.dataset.personId, quantity: Number(input.value) })),
    }];
    const byRecipe = new Map();
    $('.beverage-person', row).forEach((personRow) => {
      const recipeId = $('select[data-person-recipe]', personRow).value;
      if (!recipeId) return;
      const quantity = Number($('input[data-person-id]', personRow).value);
      const amounts = byRecipe.get(recipeId) ?? [];
      amounts.push({ personId: personRow.dataset.personId, quantity });
      byRecipe.set(recipeId, amounts);
    });
    return [...byRecipe].map(([recipeId, amounts]) => ({ recipeId, role, amounts }));
  });
  if (!attendeeIds.length) { showMessage($('#meal-message'), 'Sélectionne les personnes présentes pour ce repas.'); return; }
  if (!items.length || items.some((item) => !item.recipeId)) { showMessage($('#meal-message'), 'Choisis au moins une recette pour ce repas.'); return; }
  if (items.some((item) => item.role !== 'beverage' && item.amounts.length !== attendeeIds.length)
    || items.some((item) => item.amounts.length < 1 || item.amounts.some((amount) => !Number.isFinite(amount.quantity) || amount.quantity <= 0))) {
    showMessage($('#meal-message'), 'Indique une quantité positive pour chaque personne concernée par les recettes choisies.');
    return;
  }
  const form = event.currentTarget;
  const payload = { householdId: state.household.id, mealDate: form.elements.mealDate.value, slot: form.elements.slot.value, notes: form.elements.notes.value, attendeeIds, items };
  try {
    await api(state.calendarMealId ? `/api/planning/meals/${state.calendarMealId}` : '/api/planning/meals', { method: state.calendarMealId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    $('#meal-dialog').close(); await refreshCalendar();
  } catch (error) { showMessage($('#meal-message'), `Enregistrement impossible : ${error.body?.error ?? error.message}`); }
});
