const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { offset: 0, limit: 50, query: '', total: 0, household: null, debounce: null };
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

function addRecipeLine() {
  const row = document.createElement('div'); row.className = 'recipe-line';
  const foodBox = document.createElement('div'); foodBox.className = 'food-choice';
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Rechercher un aliment'; search.autocomplete = 'off';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Aliment lié'); select.innerHTML = '<option value="">Choisir un aliment</option>';
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
  const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '0.01'; quantity.step = 'any'; quantity.value = '100'; quantity.setAttribute('aria-label', 'Quantité');
  const unit = document.createElement('select'); unit.setAttribute('aria-label', 'Unité');
  for (const [id, label] of [['g','g'],['kg','kg'],['ml','ml'],['l','l'],['tsp','c. à café'],['tbsp','c. à soupe'],['cup','tasse'],['piece','pièce']]) unit.add(new Option(label, id));
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-line'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Supprimer cet ingrédient'); remove.addEventListener('click', () => row.remove());
  foodBox.append(search, select); row.append(foodBox, quantity, unit, remove); $('#recipe-lines').append(row);
}

$('#add-line').addEventListener('click', addRecipeLine);
$('#recipe-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#recipe-message'); message.textContent = '';
  if (!state.household) { showMessage(message, 'Crée d’abord un foyer en haut de la page.'); return; }
  const lines = $$('.recipe-line').map((row) => ({ foodId: $('select[aria-label="Aliment lié"]', row).value, quantity: Number($('input[aria-label="Quantité"]', row).value), unitId: $('select[aria-label="Unité"]', row).value }));
  if (lines.some((line) => !line.foodId)) { showMessage(message, 'Associe chaque ligne à un aliment du catalogue.'); return; }
  const form = event.currentTarget;
  try {
    const { recipe } = await api('/api/recipes', { method: 'POST', body: JSON.stringify({ name: form.elements.name.value, description: form.elements.description.value, householdId: state.household.id, yield: { amount: Number(form.elements.yieldAmount.value), unitId: form.elements.yieldUnit.value }, lines }) });
    renderRecipe(recipe); showMessage(message, 'Recette enregistrée. Les valeurs affichées sont calculées depuis le catalogue.', true);
  } catch (error) { showMessage(message, `Enregistrement impossible : ${error.body?.error ?? error.message}`); }
});

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
