const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { offset: 0, limit: 50, query: '', total: 0, household: null, debounce: null, editingRecipeId: null, importingDraftId: null };
const nutrientLabels = [['energyKcal', 'kcal'], ['proteinG', 'g prot.'], ['carbohydrateG', 'g gluc.'], ['fatG', 'g lip.']];

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) } });
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
  $$('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'recipes') refreshRecipes();
}

async function refreshFoods() {
  const params = new URLSearchParams({ limit: String(state.limit), offset: String(state.offset) });
  if (state.query) params.set('q', state.query);
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
  name.append(strong, small);
  const source = document.createElement('td'); source.textContent = food.source === 'ciqual' ? 'Ciqual' : food.source === 'manual' ? 'Saisie manuelle' : food.source;
  const values = document.createElement('td'); values.className = 'food-nutrients';
  values.textContent = nutrientLabels.map(([key, unit]) => `${format(food.nutrients_per_100g?.[key === 'energyKcal' ? 'energy_kcal' : key === 'proteinG' ? 'protein_g' : key === 'carbohydrateG' ? 'carbohydrate_g' : 'fat_g'])} ${unit}`).join(' · ');
  const action = document.createElement('td'); const button = document.createElement('button'); button.className = 'secondary'; button.textContent = 'Modifier'; button.addEventListener('click', () => openFoodEditor(food.id)); action.append(button);
  row.append(name, source, values, action); return row;
}

function format(value) { return value == null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Number(value)); }

async function openFoodEditor(id = null) {
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
    } catch { showMessage($('#food-message'), 'Impossible de charger cette fiche.'); return; }
  }
  $('#food-dialog').showModal();
}

$('#food-search').addEventListener('input', (event) => {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(() => { state.query = event.target.value.trim(); state.offset = 0; refreshFoods(); }, 180);
});
$('#previous-page').addEventListener('click', () => { state.offset = Math.max(0, state.offset - state.limit); refreshFoods(); });
$('#next-page').addEventListener('click', () => { state.offset += state.limit; refreshFoods(); });
$('#add-food').addEventListener('click', () => openFoodEditor());
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
  if (initial?.foodId) { select.add(new Option(initial.foodName ?? 'Aliment sélectionné', initial.foodId, true, true)); search.value = initial.foodName ?? ''; }
  else if (initial?.foodName) search.value = initial.foodName;
  let timeout;
  search.addEventListener('input', () => {
    select.value = '';
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      if (search.value.trim().length < 2) return;
      try {
        const { foods } = await api(`/api/foods?q=${encodeURIComponent(search.value.trim())}&limit=20`);
        select.replaceChildren(new Option('Choisir un aliment', ''), ...foods.map((food) => new Option(`${food.name}${food.brand ? ` · ${food.brand}` : ''}`, food.id)));
      } catch { select.replaceChildren(new Option('Catalogue indisponible', '')); }
    }, 180);
  });
  const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '0.01'; quantity.step = 'any';
  quantity.value = initial && Object.hasOwn(initial, 'quantity') ? String(initial.quantity ?? '') : '100';
  quantity.placeholder = quantity.value ? '' : 'À préciser'; quantity.required = true; quantity.setAttribute('aria-label', 'Quantité');
  const unit = document.createElement('select'); unit.setAttribute('aria-label', 'Unité');
  for (const [id, label] of [['g','g'],['kg','kg'],['ml','ml'],['l','l'],['tsp','c. à café'],['tbsp','c. à soupe'],['cup','tasse'],['piece','pièce']]) unit.add(new Option(label, id));
  if (initial?.unitId) unit.value = initial.unitId;
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-line'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Supprimer cet ingrédient'); remove.addEventListener('click', () => row.remove());
  foodBox.append(search, select); row.append(foodBox, quantity, unit, remove); $('#recipe-lines').append(row);
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
  if (lines.some((line) => !line.foodId)) { showMessage(message, 'Associe chaque ligne à un aliment du catalogue.'); return; }
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
      for (const line of recipe.lines) addRecipeLine(line);
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
  if (!recipe.nutrition.complete) { const warning = document.createElement('p'); warning.className = 'warning'; warning.textContent = 'Calcul incomplet : vérifie les aliments, unités et valeurs nutritionnelles associés.'; details.append(warning); }
  const actions = document.createElement('div'); actions.className = 'recipe-card-actions';
  const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary'; edit.textContent = 'Modifier'; edit.addEventListener('click', () => openRecipeEditor(recipe.id));
  actions.append(edit); card.append(details, actions); return card;
}

function renderRecipe(recipe) {
  const result = $('#recipe-result'); result.classList.remove('hidden'); result.replaceChildren();
  const title = document.createElement('h3'); title.textContent = `${recipe.name} · ${recipe.yield.amount} ${recipe.yield.unitId}`; result.append(title);
  const grid = document.createElement('div'); grid.className = 'nutrition-grid';
  const rows = [['Énergie', recipe.nutrition.perYieldUnit.energyKcal, 'kcal'], ['Protéines', recipe.nutrition.perYieldUnit.proteinG, 'g'], ['Glucides', recipe.nutrition.perYieldUnit.carbohydrateG, 'g'], ['Lipides', recipe.nutrition.perYieldUnit.fatG, 'g'], ['Fibres', recipe.nutrition.perYieldUnit.fibreG, 'g']];
  for (const [label, value, unit] of rows) { const cell = document.createElement('div'); const caption = document.createElement('span'); caption.textContent = `${label} par ${recipe.yield.unitId}`; const amount = document.createElement('strong'); amount.textContent = value == null ? 'Inconnu' : `${format(value)} ${unit}`; cell.append(caption, amount); grid.append(cell); }
  result.append(grid);
  if (!recipe.nutrition.complete) { const warning = document.createElement('p'); warning.className = 'warning'; warning.textContent = 'Calcul incomplet : une conversion ou une donnée nutritionnelle manque. Les valeurs inconnues ne sont pas remplacées par zéro.'; result.append(warning); }
  const batch = document.createElement('p'); batch.className = 'muted'; batch.textContent = `Total de la recette : ${format(recipe.nutrition.batch.energyKcal)} kcal`; result.append(batch);
}

async function init() {
  try {
    const session = await api('/api/session');
    if (!session.authenticated) { $('#login-dialog').showModal(); return; }
  } catch { $('#login-dialog').showModal(); return; }
  try { await api('/api/health'); $('#connection').textContent = 'Base connectée'; }
  catch { $('#connection').textContent = 'Base indisponible'; $('#connection').classList.add('error'); }
  await Promise.all([refreshFoods(), loadHouseholds()]);
  addRecipeLine();
}

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
