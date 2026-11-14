// Calosport — page Sport : bibliothèque d'exercices, favoris, formulaire de séance
// (séries prévues, superset / circuit / dropset) et enregistrement de la séance.

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
let activeWorkoutId = null;
let exoRowCount = 0;
let EXERCISE_LIBRARY = [];

async function loadExerciseLibrary(){
  const { data } = await supabaseClient
    .from("exercise_library").select("*")
    .order("muscle_group", { ascending: true })
    .order("name", { ascending: true });
  EXERCISE_LIBRARY = data || [];

  // Favoris (si la table n'existe pas encore, on continue simplement sans favoris)
  const { data: favs } = await supabaseClient.from("favorite_exercises").select("exercise_library_id");
  FAVORITE_EXERCISE_IDS = new Set((favs || []).map(f => f.exercise_library_id));
}

let FAVORITE_EXERCISE_IDS = new Set();

function refreshFavButtons(){
  document.querySelectorAll("#exo-rows .exo-row").forEach(row => {
    const btn = row.querySelector(".exo-fav");
    if (!btn) return;
    const isFav = FAVORITE_EXERCISE_IDS.has(row.querySelector(".exo-select").value);
    btn.classList.toggle("active", isFav);
    btn.textContent = isFav ? "★" : "☆";
    btn.title = isFav ? "Retirer des favoris" : "Ajouter aux favoris";
  });
  refreshExoLastLines();
}

async function toggleFavoriteExercise(btn){
  const row = btn.closest(".exo-row");
  const libId = row.querySelector(".exo-select").value;
  if (!libId || libId === "__custom__"){
    alert("Choisis d'abord un exercice dans la liste. Un nouvel exercice pourra être mis en favori une fois la séance enregistrée.");
    return;
  }
  if (FAVORITE_EXERCISE_IDS.has(libId)){
    const { error } = await supabaseClient.from("favorite_exercises").delete()
      .eq("user_id", currentUser.id).eq("exercise_library_id", libId);
    if (error){ alert("Erreur : " + error.message); return; }
    FAVORITE_EXERCISE_IDS.delete(libId);
  } else {
    const { error } = await supabaseClient.from("favorite_exercises")
      .insert({ user_id: currentUser.id, exercise_library_id: libId });
    if (error){ alert("Impossible d'ajouter le favori : " + error.message); return; }
    FAVORITE_EXERCISE_IDS.add(libId);
  }
  // Le groupe « Favoris » des listes déroulantes change : on les reconstruit en gardant les choix en cours
  document.querySelectorAll("#exo-rows .exo-select").forEach(sel => {
    const current = sel.value;
    sel.innerHTML = exerciseSelectOptionsHtml();
    sel.value = current;
  });
  refreshFavButtons();
}

function exerciseSelectOptionsHtml(){
  const groups = {};
  EXERCISE_LIBRARY.forEach(ex => {
    const g = ex.muscle_group || "Autre";
    if (!groups[g]) groups[g] = [];
    groups[g].push(ex);
  });
  let html = `<option value="" disabled selected>Choisir un exercice…</option>`;
  const favorites = EXERCISE_LIBRARY
    .filter(ex => FAVORITE_EXERCISE_IDS.has(ex.id))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  if (favorites.length){
    html += `<optgroup label="⭐ Favoris">`;
    favorites.forEach(ex => { html += `<option value="${ex.id}">${ex.name}</option>`; });
    html += `</optgroup>`;
  }
  Object.keys(groups).forEach(g => {
    html += `<optgroup label="${g}">`;
    groups[g].forEach(ex => { html += `<option value="${ex.id}">${ex.name}</option>`; });
    html += `</optgroup>`;
  });
  html += `<option value="__custom__">➕ Créer un nouvel exercice…</option>`;
  return html;
}

function openWorkoutModal(){
  document.getElementById("workout-modal-title").textContent = "Nouvelle séance";
  document.getElementById("workout-modal-submit").textContent = "Créer la séance";
  document.getElementById("w-id").value = "";
  document.getElementById("w-completed").checked = false;
  document.getElementById("w-deload").checked = false;
  document.getElementById("workout-modal-overlay").classList.add("open");
  const today = new Date();
  document.getElementById("w-date").value = localDateKey(today);
  document.getElementById("w-time").value = today.toTimeString().slice(0,5);
  if (document.getElementById("exo-rows").children.length === 0){
    addExoRow(); addExoRow();
  }
  renderUsualSlotHint();
}

// Date locale au format AAAA-MM-JJ (toISOString donnerait la date UTC, fausse après minuit en France)
function localDateKey(d){
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// ---------- créneau habituel : le jour et l'heure où l'utilisateur s'entraîne le plus souvent ----------
const DAY_NAMES_FR = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

async function renderUsualSlotHint(){
  const hint = document.getElementById("usual-slot-hint");
  if (!hint) return;
  hint.innerHTML = "";
  if (!currentUser) return;

  const since = new Date();
  since.setDate(since.getDate() - 90);
  const { data } = await supabaseClient
    .from("workouts").select("scheduled_at")
    .eq("user_id", currentUser.id).eq("completed", true)
    .gte("scheduled_at", since.toISOString());

  const counts = {};
  (data || []).forEach(w => {
    if (!w.scheduled_at) return;
    const d = new Date(w.scheduled_at);
    const key = d.getDay() + "-" + d.getHours();
    counts[key] = (counts[key] || 0) + 1;
  });
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  // Il faut au moins deux séances au même créneau pour que ce soit une habitude
  if (!best || best[1] < 2) return;

  const [day, hour] = best[0].split("-").map(Number);
  const hh = String(hour).padStart(2, "0");
  hint.innerHTML = `<button type="button" class="usual-slot-btn" onclick="applyUsualSlot(${day}, ${hour})">
    <span>🕒 Ton créneau habituel : ${DAY_NAMES_FR[day]} vers ${hh}h</span><b>Utiliser</b>
  </button>`;
}

function applyUsualSlot(day, hour){
  // Prochaine date tombant sur ce jour de la semaine (aujourd'hui compris)
  const target = new Date();
  target.setDate(target.getDate() + ((day - target.getDay() + 7) % 7));
  document.getElementById("w-date").value = localDateKey(target);
  document.getElementById("w-time").value = String(hour).padStart(2, "0") + ":00";
}
function closeWorkoutModal(){
  document.getElementById("workout-modal-overlay").classList.remove("open");
  document.getElementById("w-id").value = "";
  document.getElementById("w-name").value = "";
  document.getElementById("w-type").value = "";
  document.getElementById("w-duration").value = "";
  document.getElementById("w-calories").value = "";
  document.getElementById("w-completed").checked = false;
  document.getElementById("w-deload").checked = false;
  document.getElementById("exo-rows").innerHTML = "";
  exoRowCount = 0;
  plannedSetsByRow = {};
  plannedBlocks = {};
  blockCounter = 0;
  cancelBlockGrouping();
}

async function editWorkout(workoutId){
  const hint = document.getElementById("usual-slot-hint");
  if (hint) hint.innerHTML = ""; // le créneau habituel ne sert que pour une nouvelle séance
  const { data: workout, error } = await supabaseClient
    .from("workouts").select("*").eq("id", workoutId).single();
  if (error || !workout){ alert("Impossible de charger cette séance."); return; }

  const { data: exercises } = await supabaseClient
    .from("exercises").select("*").eq("workout_id", workoutId).order("position", { ascending: true });

  document.getElementById("workout-modal-title").textContent = "Modifier la séance";
  document.getElementById("workout-modal-submit").textContent = "Enregistrer les modifications";
  document.getElementById("w-id").value = workout.id;
  document.getElementById("w-name").value = workout.name || "";
  document.getElementById("w-type").value = workout.workout_type || "";
  document.getElementById("w-duration").value = workout.duration_min || "";
  document.getElementById("w-calories").value = workout.calories_burned ? Math.round(kcalToDisplayEnergy(workout.calories_burned)) : "";
  document.getElementById("w-completed").checked = !!workout.completed;
  document.getElementById("w-deload").checked = !!workout.is_deload;
  if (workout.scheduled_at){
    const d = new Date(workout.scheduled_at);
    document.getElementById("w-date").value = d.toISOString().slice(0,10);
    document.getElementById("w-time").value = d.toTimeString().slice(0,5);
  }

  document.getElementById("exo-rows").innerHTML = "";
  exoRowCount = 0;
  plannedBlocks = {};
  blockCounter = 0;
  const rowIdByExId = {};
  for (const ex of (exercises || [])){
    addExoRow();
    const id = "exo-row-" + (exoRowCount - 1);
    rowIdByExId[ex.id] = id;
    const row = document.getElementById(id);
    const select = row.querySelector(".exo-select");
    const customInput = row.querySelector(".exo-custom-input");
    if (ex.exercise_library_id && EXERCISE_LIBRARY.some(e => e.id === ex.exercise_library_id)){
      select.value = ex.exercise_library_id;
    } else {
      select.value = "__custom__";
      customInput.style.display = "block";
      customInput.value = ex.name || "";
    }

    const { data: existingSets } = await supabaseClient
      .from("workout_sets").select("*").eq("exercise_id", ex.id).order("set_number", { ascending: true });

    const plan = plannedSetsByRow[id];
    plan.rest = ex.rest_seconds || 90;
    const warmupSets = (existingSets || []).filter(s => s.is_warmup);
    const workingSets = (existingSets || []).filter(s => !s.is_warmup);
    if (warmupSets.length) plan.warmup = warmupSets.map(s => ({ reps: s.reps ?? "", weight: s.weight_kg ?? "" }));
    if (workingSets.length) plan.working = workingSets.map((s, i) => ({ reps: s.reps ?? "", weight: s.weight_kg ?? "", noRestBefore: i > 0 && !!s.no_rest_before }));

    const restInput = row.querySelector(".ecp-rest-row input");
    if (restInput) restInput.value = plan.rest;

    renderPlannedSetRows(id, true);
    renderPlannedSetRows(id, false);
    if (warmupSets.length){
      document.getElementById("warmup-table-" + id).style.display = "block";
      document.getElementById("warmup-toggle-" + id).textContent = "Masquer";
    }
  }
  if (!(exercises || []).length){ addExoRow(); addExoRow(); }

  // Reconstruction des groupes superset / circuit
  if ((exercises || []).some(e => e.block_id)){
    const { data: blocks } = await supabaseClient
      .from("workout_blocks").select("*").eq("workout_id", workoutId).order("position", { ascending: true });
    (blocks || []).forEach(b => {
      const rowIds = exercises
        .filter(e => e.block_id === b.id)
        .sort((x, y) => (x.block_order ?? 0) - (y.block_order ?? 0))
        .map(e => rowIdByExId[e.id]);
      if (rowIds.length >= 2){
        plannedBlocks["blk-" + (blockCounter++)] = { type: b.block_type, rest: b.rest_between_rounds ?? 90, rowIds };
      }
    });
  }
  renderAllBlockBadges();
  refreshFavButtons();

  document.getElementById("workout-modal-overlay").classList.add("open");
}

async function duplicateWorkout(workoutId){
  await editWorkout(workoutId);
  // On repart du même contenu, mais comme une nouvelle séance (pas une modification)
  document.getElementById("w-id").value = "";
  document.getElementById("workout-modal-title").textContent = "Dupliquer la séance";
  document.getElementById("workout-modal-submit").textContent = "Créer la séance";
  const today = new Date();
  document.getElementById("w-date").value = today.toISOString().slice(0, 10);
  document.getElementById("w-time").value = today.toTimeString().slice(0, 5);
}

let plannedSetsByRow = {}; // { rowId: { rest: 90, warmup: [{reps,weight}], working: [{reps,weight}] } }

function defaultPlanForRow(){
  return {
    rest: 90,
    warmup: [],
    working: [{ reps: "", weight: "" }, { reps: "", weight: "" }, { reps: "", weight: "" }],
    warmupVisible: true,
  };
}

function onExoSelectChange(selectEl){
  const row = selectEl.closest(".exo-row");
  delete row.dataset.muscle; // choix manuel : on oublie le groupe musculaire proposé par un programme
  const customInput = row.querySelector(".exo-custom-input");
  customInput.style.display = selectEl.value === "__custom__" ? "block" : "none";
  refreshFavButtons();
}

function addExoRow(){
  const id = "exo-row-" + (exoRowCount++);
  plannedSetsByRow[id] = defaultPlanForRow();
  const row = document.createElement("div");
  row.className = "exo-row";
  row.id = id;
  row.innerHTML = `
    <div class="block-badge" id="block-badge-${id}"></div>
    <div class="exo-row-top">
      <input type="checkbox" class="exo-select-check" title="Cocher pour grouper en superset / circuit">
      <select class="exo-select" onchange="onExoSelectChange(this)">${exerciseSelectOptionsHtml()}</select>
      <input type="text" class="exo-custom-input" placeholder="Nom du nouvel exercice" onchange="refreshExoLastLines()">
      <button type="button" class="exo-fav" onclick="toggleFavoriteExercise(this)" title="Ajouter aux favoris">☆</button>
      <button type="button" class="exo-remove" onclick="removeExoRow('${id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="exo-last" onclick="openExerciseHistory(this.dataset.name)"></div>
    <div class="exo-config-toggle" onclick="toggleExoConfig('${id}')">
      <span id="exo-summary-${id}">3 séries efficaces · 90s repos</span>
      <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </div>
    <div class="exo-config-panel" id="exo-config-${id}">
      <div class="ecp-rest-row">
        <label>Repos entre séries</label>
        <input type="number" min="0" step="5" value="90" onchange="setRest('${id}', this.value)">
        <span style="font-size:11.5px; color:var(--text-muted);">sec</span>
      </div>

      <div class="ecp-section">
        <div class="ecp-section-head">
          <div class="ecp-section-title">Séries d'échauffement</div>
          <button type="button" class="ecp-toggle-visibility" onclick="toggleWarmupVisibility('${id}')" id="warmup-toggle-${id}">Afficher</button>
        </div>
        <div id="warmup-table-${id}" style="display:none;">
          <div class="ecp-table-head"><div>Série</div><div>Répétitions</div><div>Kg</div><div></div><div></div></div>
          <div id="warmup-rows-${id}"></div>
          <button type="button" class="ecp-add-set" onclick="addPlannedSet('${id}', true)">+ Ajouter une série d'échauffement</button>
        </div>
      </div>

      <div class="ecp-section">
        <div class="ecp-section-head"><div class="ecp-section-title">Séries efficaces</div></div>
        <div class="ecp-table-head"><div>Série</div><div>Répétitions</div><div>Kg</div><div></div><div></div></div>
        <div id="working-rows-${id}"></div>
        <div class="ecp-hint">⚡ = dropset : la série s'enchaîne sans repos après la précédente</div>
        <button type="button" class="ecp-add-set" onclick="addPlannedSet('${id}', false)">+ Ajouter une série</button>
      </div>
    </div>`;
  document.getElementById("exo-rows").appendChild(row);
  renderPlannedSetRows(id, true);
  renderPlannedSetRows(id, false);
}

function toggleExoConfig(id){
  document.getElementById("exo-config-" + id).classList.toggle("open");
  document.querySelector(`#${id} .exo-config-toggle`).classList.toggle("open");
}

function toggleWarmupVisibility(id){
  const table = document.getElementById("warmup-table-" + id);
  const btn = document.getElementById("warmup-toggle-" + id);
  const nowVisible = table.style.display === "none";
  table.style.display = nowVisible ? "block" : "none";
  btn.textContent = nowVisible ? "Masquer" : "Afficher";
}

function setRest(id, value){
  plannedSetsByRow[id].rest = parseInt(value) || 90;
  updateExoSummary(id);
}

function addPlannedSet(id, isWarmup){
  const plan = plannedSetsByRow[id];
  (isWarmup ? plan.warmup : plan.working).push({ reps: "", weight: "" });
  if (isWarmup && plan.warmup.length === 1){
    document.getElementById("warmup-table-" + id).style.display = "block";
    document.getElementById("warmup-toggle-" + id).textContent = "Masquer";
  }
  renderPlannedSetRows(id, isWarmup);
  updateExoSummary(id);
  renderAllBlockBadges();
}

function removePlannedSet(id, isWarmup, index){
  const plan = plannedSetsByRow[id];
  (isWarmup ? plan.warmup : plan.working).splice(index, 1);
  if (!isWarmup && plan.working[0]) plan.working[0].noRestBefore = false;
  renderPlannedSetRows(id, isWarmup);
  updateExoSummary(id);
  renderAllBlockBadges();
}

// ---------- SUPERSET / CIRCUIT / DROPSET (planification) ----------
let plannedBlocks = {}; // { bid: { type: 'superset'|'circuit', rest: 90, rowIds: [...] } }
let blockCounter = 0;

function blockLabel(b){ return (b.type === "circuit" ? "Circuit " : "Superset ") + (b.letter || ""); }
function rowBlockId(rowId){
  return Object.keys(plannedBlocks).find(bid => plannedBlocks[bid].rowIds.includes(rowId)) || null;
}
// Un "tour" = une série efficace + ses éventuels dropsets enchaînés
function plannedRoundCount(rowId){
  const p = plannedSetsByRow[rowId];
  return p ? p.working.filter(s => !s.noRestBefore).length : 0;
}

function removeExoRow(id){
  const bid = rowBlockId(id);
  if (bid){
    const b = plannedBlocks[bid];
    b.rowIds = b.rowIds.filter(r => r !== id);
    if (b.rowIds.length < 2) delete plannedBlocks[bid];
  }
  delete plannedSetsByRow[id];
  document.getElementById(id).remove();
  renderAllBlockBadges();
}

function toggleDropset(id, index){
  const s = plannedSetsByRow[id].working[index];
  if (!s || index === 0) return;
  s.noRestBefore = !s.noRestBefore;
  renderPlannedSetRows(id, false);
  renderAllBlockBadges();
}

function selectedRowsForGrouping(){
  return Array.from(document.querySelectorAll("#exo-rows .exo-row"))
    .filter(r => r.querySelector(".exo-select-check").checked);
}

function openBlockGrouping(){
  const rows = selectedRowsForGrouping();
  if (rows.length < 2){
    alert("Coche au moins 2 exercices (case à gauche de chaque exercice) pour les grouper.");
    return;
  }
  if (rows.some(r => rowBlockId(r.id))){
    alert("Un des exercices cochés fait déjà partie d'un groupe. Dissocie-le d'abord.");
    return;
  }
  document.getElementById("block-type").value = rows.length === 2 ? "superset" : "circuit";
  document.getElementById("block-rounds").value = Math.max(1, ...rows.map(r => plannedRoundCount(r.id)));
  document.getElementById("block-count-lbl").textContent = `${rows.length} exercices cochés`;
  document.getElementById("block-config-panel").classList.add("open");
}

function cancelBlockGrouping(){
  document.getElementById("block-config-panel").classList.remove("open");
}

function confirmBlockGrouping(){
  const rows = selectedRowsForGrouping().filter(r => !rowBlockId(r.id));
  if (rows.length < 2){ cancelBlockGrouping(); return; }
  const type = document.getElementById("block-type").value === "circuit" ? "circuit" : "superset";
  const rounds = Math.max(1, parseInt(document.getElementById("block-rounds").value) || 3);
  const restVal = parseInt(document.getElementById("block-rest").value);
  const rest = isNaN(restVal) ? 90 : Math.max(0, restVal);

  // Les exercices d'un groupe se suivent dans la séance
  let anchor = rows[0];
  rows.slice(1).forEach(r => { anchor.after(r); anchor = r; });

  rows.forEach(r => {
    const plan = plannedSetsByRow[r.id];
    // On aligne le nombre de séries efficaces sur le nombre de tours
    while (plannedRoundCount(r.id) < rounds){
      const last = plan.working[plan.working.length - 1] || { reps: "", weight: "" };
      plan.working.push({ reps: last.reps, weight: last.weight });
    }
    while (plannedRoundCount(r.id) > rounds && plan.working.length > 1){
      const last = plan.working[plan.working.length - 1];
      if (last.reps !== "" || last.weight !== "") break; // on ne supprime jamais une série déjà remplie
      plan.working.pop();
    }
    renderPlannedSetRows(r.id, false);
    r.querySelector(".exo-select-check").checked = false;
  });

  plannedBlocks["blk-" + (blockCounter++)] = { type, rest, rowIds: rows.map(r => r.id) };
  cancelBlockGrouping();
  renderAllBlockBadges();
}

function ungroupBlock(bid){
  delete plannedBlocks[bid];
  renderAllBlockBadges();
}

function renderAllBlockBadges(){
  const rows = Array.from(document.querySelectorAll("#exo-rows .exo-row"));
  const firstIdx = bid => rows.findIndex(r => plannedBlocks[bid].rowIds.includes(r.id));
  Object.keys(plannedBlocks)
    .sort((a, b) => firstIdx(a) - firstIdx(b))
    .forEach((bid, i) => { plannedBlocks[bid].letter = String.fromCharCode(65 + i); });

  rows.forEach(r => {
    const badge = document.getElementById("block-badge-" + r.id);
    if (!badge) return;
    const bid = rowBlockId(r.id);
    r.classList.toggle("in-block", !!bid);
    if (!bid){ badge.className = "block-badge"; badge.innerHTML = ""; return; }
    const b = plannedBlocks[bid];
    const rounds = Math.max(1, ...b.rowIds.map(id => plannedRoundCount(id)));
    badge.className = "block-badge show " + b.type;
    badge.innerHTML = `<span>🔗 ${blockLabel(b)} · ${b.rowIds.indexOf(r.id) + 1}/${b.rowIds.length} · ${rounds} tour${rounds > 1 ? "s" : ""} · ${b.rest}s entre les tours</span>
      <button type="button" onclick="ungroupBlock('${bid}')">Dissocier</button>`;
  });
}

function updatePlannedSetField(id, isWarmup, index, field, value){
  plannedSetsByRow[id][isWarmup ? "warmup" : "working"][index][field] = value;
  if (field === "reps" || field === "weight") updateExoSummary(id);
}

function renderPlannedSetRows(id, isWarmup){
  const plan = plannedSetsByRow[id];
  const list = isWarmup ? plan.warmup : plan.working;
  const container = document.getElementById((isWarmup ? "warmup-rows-" : "working-rows-") + id);
  container.innerHTML = "";
  list.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "ecp-set-row";
    row.innerHTML = `
      <div class="ecp-set-num">${i + 1}</div>
      <input type="number" min="0" placeholder="10" value="${s.reps}"
             onchange="updatePlannedSetField('${id}', ${isWarmup}, ${i}, 'reps', this.value)">
      <input type="number" min="0" step="0.1" placeholder="0" value="${s.weight}"
             onchange="updatePlannedSetField('${id}', ${isWarmup}, ${i}, 'weight', this.value)">
      ${(!isWarmup && i > 0)
        ? `<button type="button" class="dropset-toggle ${s.noRestBefore ? "active" : ""}" title="Dropset : enchaîner cette série sans repos après la précédente" onclick="toggleDropset('${id}', ${i})">⚡</button>`
        : `<div></div>`}
      <button type="button" class="ecp-set-remove" onclick="removePlannedSet('${id}', ${isWarmup}, ${i})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>`;
    container.appendChild(row);
  });
  updateExoSummary(id);
}

function updateExoSummary(id){
  const el = document.getElementById("exo-summary-" + id);
  if (!el) return;
  const plan = plannedSetsByRow[id];
  const warmupTxt = plan.warmup.length ? `${plan.warmup.length} échauffement + ` : "";
  const drops = plan.working.filter(s => s.noRestBefore).length;
  el.textContent = `${warmupTxt}${plan.working.length} série${plan.working.length > 1 ? "s" : ""} efficace${plan.working.length > 1 ? "s" : ""} · ${plan.rest}s repos${drops ? ` · ⚡ ${drops} dropset` : ""}`;
}

async function submitWorkout(e){
  e.preventDefault();
  const editId = document.getElementById("w-id").value;
  const name = document.getElementById("w-name").value.trim();
  const type = document.getElementById("w-type").value.trim();
  const duration = parseInt(document.getElementById("w-duration").value) || null;
  const caloriesInput = parseInt(document.getElementById("w-calories").value) || null;
  const calories = caloriesInput != null ? Math.round(displayEnergyToKcal(caloriesInput)) : null;
  const date = document.getElementById("w-date").value;
  const time = document.getElementById("w-time").value;
  const scheduledAt = new Date(`${date}T${time}`).toISOString();
  const isDeload = document.getElementById("w-deload").checked;
  const isCompleted = document.getElementById("w-completed").checked;

  let workout;
  if (editId){
    const { data, error } = await supabaseClient
      .from("workouts")
      .update({ name, workout_type: type || null, duration_min: duration, calories_burned: calories, scheduled_at: scheduledAt, is_deload: isDeload, completed: isCompleted })
      .eq("id", editId)
      .select().single();
    if (error){ alert("Erreur : " + error.message); return; }
    workout = data;
    // On repart des exercices actuels du formulaire : on supprime les anciens puis on réinsère
    // (les séries déjà loggées sur cette séance seront donc réinitialisées)
    await supabaseClient.from("exercises").delete().eq("workout_id", editId);
    await supabaseClient.from("workout_blocks").delete().eq("workout_id", editId);
  } else {
    const { data, error } = await supabaseClient
      .from("workouts")
      .insert({
        user_id: currentUser.id,
        name, workout_type: type || null,
        duration_min: duration, calories_burned: calories,
        scheduled_at: scheduledAt, completed: isCompleted, is_deload: isDeload
      })
      .select().single();
    if (error){ alert("Erreur : " + error.message); return; }
    workout = data;
  }

  const exoRows = Array.from(document.querySelectorAll(".exo-row"));
  const exercisesToInsert = [];
  const rowIdByIndex = [];

  for (const row of exoRows){
    const rowId = row.id;
    const plan = plannedSetsByRow[rowId];
    const select = row.querySelector(".exo-select");
    const customInput = row.querySelector(".exo-custom-input");

    let libraryId = null;
    let exName = "";

    if (select.value === "__custom__"){
      exName = customInput.value.trim();
      if (!exName) continue;
      const { data: newLib, error: libErr } = await supabaseClient
        .from("exercise_library")
        .insert({ user_id: currentUser.id, name: exName, muscle_group: row.dataset.muscle || "Perso" })
        .select().single();
      if (libErr){ alert("Erreur création exercice : " + libErr.message); continue; }
      libraryId = newLib.id;
      EXERCISE_LIBRARY.push(newLib);
    } else if (select.value){
      libraryId = select.value;
      const found = EXERCISE_LIBRARY.find(e => e.id === libraryId);
      exName = found ? found.name : "Exercice";
    } else {
      continue;
    }

    const workingCount = plan.working.filter(s => s.reps || s.weight).length || plan.working.length;
    const firstWorking = plan.working[0] || {};

    exercisesToInsert.push({
      workout_id: workout.id,
      exercise_library_id: libraryId,
      name: exName,
      sets: workingCount || null,
      reps: firstWorking.reps ? parseInt(firstWorking.reps) : null,
      rest_seconds: plan.rest || 90,
      position: exercisesToInsert.length,
      done: false
    });
    rowIdByIndex.push(rowId);
  }

  // Groupes superset / circuit : on crée d'abord les blocs, puis on y rattache les exercices
  let anyBlock = false;
  const blockDefs = Object.values(plannedBlocks)
    .map(b => ({ b, idxs: b.rowIds.map(r => rowIdByIndex.indexOf(r)).filter(i => i >= 0).sort((x, y) => x - y) }))
    .filter(x => x.idxs.length >= 2)
    .sort((x, y) => x.idxs[0] - y.idxs[0]);
  for (let bi = 0; bi < blockDefs.length; bi++){
    const { b, idxs } = blockDefs[bi];
    const rounds = Math.max(1, ...b.rowIds.map(r => plannedRoundCount(r)));
    const { data: blockRow, error: blockErr } = await supabaseClient
      .from("workout_blocks")
      .insert({ workout_id: workout.id, block_type: b.type, rounds, rest_between_rounds: b.rest, position: bi })
      .select().single();
    if (blockErr){
      alert("Groupe superset/circuit non enregistré (schema_v21.sql a-t-il bien été exécuté dans Supabase ?) : " + blockErr.message);
      break;
    }
    anyBlock = true;
    idxs.forEach((exIdx, order) => {
      exercisesToInsert[exIdx].block_id = blockRow.id;
      exercisesToInsert[exIdx].block_order = order;
    });
  }
  if (anyBlock){
    exercisesToInsert.forEach(ex => {
      if (!("block_id" in ex)){ ex.block_id = null; ex.block_order = null; }
    });
  }

  if (exercisesToInsert.length){
    const { data: insertedExercises, error: exoError } = await supabaseClient
      .from("exercises").insert(exercisesToInsert).select();
    if (exoError){
      alert("Séance créée, mais erreur sur les exercices : " + exoError.message);
    } else {
      const setsToInsert = [];
      insertedExercises.forEach((ex, idx) => {
        const plan = plannedSetsByRow[rowIdByIndex[idx]];
        if (!plan) return;
        plan.warmup.forEach((s, i) => {
          setsToInsert.push({
            exercise_id: ex.id, set_number: i + 1, is_warmup: true,
            weight_kg: s.weight !== "" ? parseFloat(s.weight) : null,
            reps: s.reps !== "" ? parseInt(s.reps) : null,
            completed: isCompleted,
            completed_at: isCompleted ? scheduledAt : null,
            no_rest_before: false
          });
        });
        plan.working.forEach((s, i) => {
          setsToInsert.push({
            exercise_id: ex.id, set_number: i + 1, is_warmup: false,
            weight_kg: s.weight !== "" ? parseFloat(s.weight) : null,
            reps: s.reps !== "" ? parseInt(s.reps) : null,
            completed: isCompleted,
            completed_at: isCompleted ? scheduledAt : null,
            no_rest_before: i > 0 && !!s.noRestBefore
          });
        });
      });
      // Sans dropset, on n'envoie pas la colonne (la séance reste compatible même sans schema_v21)
      if (!setsToInsert.some(s => s.no_rest_before)) setsToInsert.forEach(s => { delete s.no_rest_before; });
      if (setsToInsert.length){
        const { error: setsError } = await supabaseClient.from("workout_sets").insert(setsToInsert);
        if (setsError) alert("Séance créée, mais erreur sur les séries planifiées : " + setsError.message);
      }
    }
  }

  if (isCompleted){
    awardXp("workout_completed", workout.id, 50);
  }

  closeWorkoutModal();
  loadSport();
}
