// Calosport — page Sport : séance du jour, barres de la semaine, détail d'une séance,
// historique récent, chargement de la page. À charger en dernier : il lance la page.

function endOfWeek(){
  const d = startOfWeek();
  d.setDate(d.getDate() + 7);
  d.setMilliseconds(-1);
  return d;
}

let currentWorkout = null;
let currentWorkoutExercises = [];
let currentWorkoutBlocks = {}; // { blockId: { type, rounds, rest, letter } }

async function deleteWorkout(workoutId){
  if (!confirm("Supprimer cette séance et tout ce qu'elle contient (exercices, séries loggées) ?")) return;
  const { error } = await supabaseClient.from("workouts").delete().eq("id", workoutId);
  if (error){ alert("Erreur : " + error.message); return; }
  loadSport();
}

async function deleteExercise(exerciseId){
  if (!confirm("Supprimer cet exercice de la séance ?")) return;
  const { error } = await supabaseClient.from("exercises").delete().eq("id", exerciseId);
  if (error){ alert("Erreur : " + error.message); return; }
  loadSport();
}

async function renderTodayWorkout(user){
  const { data: todays } = await supabaseClient
    .from("workouts").select("*")
    .eq("user_id", user.id)
    .eq("completed", false)
    .gte("scheduled_at", startOfToday().toISOString())
    .lte("scheduled_at", endOfToday().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const heroContainer = document.getElementById("workout-hero-container");
  const exoContainer = document.getElementById("exo-list");

  if (!todays){
    currentWorkout = null; currentWorkoutExercises = [];
    heroContainer.innerHTML = `
      <div class="workout-hero">
        <div class="eyebrow">Aujourd'hui</div>
        <div class="title">Aucune séance planifiée</div>
        <div class="meta">Crée-en une avec le bouton + en bas de l'écran, ou relance une séance récente.</div>
        <div id="repeat-suggestions"></div>
      </div>`;
    exoContainer.innerHTML = "";
    renderRepeatSuggestions();
    return;
  }

  const time = todays.scheduled_at ? new Date(todays.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

  const { data: exercises } = await supabaseClient
    .from("exercises").select("*")
    .eq("workout_id", todays.id)
    .order("position", { ascending: true });

  currentWorkout = todays;
  currentWorkoutExercises = exercises || [];
  currentWorkoutBlocks = {};
  if (currentWorkoutExercises.some(e => e.block_id)){
    const { data: blocks } = await supabaseClient
      .from("workout_blocks").select("*").eq("workout_id", todays.id).order("position", { ascending: true });
    (blocks || []).forEach((b, i) => {
      currentWorkoutBlocks[b.id] = {
        type: b.block_type, rounds: b.rounds, rest: b.rest_between_rounds ?? 90, letter: String.fromCharCode(65 + i)
      };
    });
  }

  heroContainer.innerHTML = `
    <div class="workout-hero">
      <button class="hero-duplicate" onclick="duplicateWorkout('${todays.id}')" title="Dupliquer la séance">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="hero-edit" onclick="editWorkout('${todays.id}')" title="Modifier la séance">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
      </button>
      <button class="hero-delete" onclick="deleteWorkout('${todays.id}')" title="Supprimer la séance">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
      </button>
      <div class="eyebrow">${todays.workout_type || "Séance"}</div>
      <div class="title">${todays.name}</div>
      <div class="meta">${time} · ${todays.duration_min || "?"} min · ${currentWorkoutExercises.length} exercices</div>
      <button class="start-btn" onclick="launchLiveSession()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#12161B"><path d="M8 5v14l11-7z"/></svg>
        Démarrer la séance
      </button>
    </div>`;

  exoContainer.innerHTML = "";
  currentWorkoutExercises.forEach((ex, i) => {
    const el = document.createElement("div");
    el.className = "exo-item";
    const blk = ex.block_id ? currentWorkoutBlocks[ex.block_id] : null;
    const detail = blk
      ? `<span class="exo-block-tag ${blk.type}">🔗 ${blockLabel(blk)}</span> · ${blk.rounds} tour${blk.rounds > 1 ? "s" : ""} × ${ex.reps || "?"} reps · ${blk.rest}s entre les tours`
      : `${ex.sets || "?"} séries × ${ex.reps || "?"} reps · ${ex.rest_seconds || 90}s repos`;
    el.innerHTML = `
      <div class="exo-num">${String(i + 1).padStart(2, "0")}</div>
      <div class="exo-meta">
        <div class="exo-name">${ex.name}</div>
        <div class="exo-detail">${detail}</div>
      </div>
      <button class="exo-delete" onclick="deleteExercise('${ex.id}')" title="Supprimer l'exercice">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
      </button>`;
    exoContainer.appendChild(el);
  });
}

function renderWeekBars(workouts){
  const weekStart = startOfWeek();
  const totals = [0,0,0,0,0,0,0]; // minutes par jour, lundi -> dimanche
  workouts.forEach(w => {
    if (!w.completed || !w.scheduled_at) return;
    const d = new Date(w.scheduled_at);
    const dayIdx = Math.floor((d - weekStart) / 86400000);
    if (dayIdx >= 0 && dayIdx < 7) totals[dayIdx] += (w.duration_min || 0);
  });

  const max = Math.max(60, ...totals);
  const todayIdx = Math.floor((new Date() - weekStart) / 86400000);
  const container = document.getElementById("week-bars");
  container.innerHTML = "";
  totals.forEach((min, i) => {
    const isToday = i === todayIdx;
    const pct = Math.min(100, (min / max) * 100);
    const col = document.createElement("div");
    col.className = "bar-col" + (isToday ? " today" : "");
    col.innerHTML = `<div class="bar-track"><div class="bar-fill" style="height:${pct}%"></div></div><div class="d">${DAY_LABELS[i]}</div>`;
    container.appendChild(col);
  });

  const totalMin = totals.reduce((s, m) => s + m, 0);
  document.getElementById("week-total").textContent = `${Math.floor(totalMin / 60)}h ${totalMin % 60} min`;
}

async function viewWorkoutDetail(workoutId){
  const overlay = document.getElementById("detail-overlay");
  const body = document.getElementById("detail-body");
  body.innerHTML = `<div class="detail-empty">Chargement…</div>`;
  overlay.classList.add("open");

  const { data: workout } = await supabaseClient.from("workouts").select("*").eq("id", workoutId).single();
  const { data: exercises } = await supabaseClient
    .from("exercises").select("*").eq("workout_id", workoutId).order("position", { ascending: true });

  if (!workout || !exercises || !exercises.length){
    document.getElementById("detail-title").textContent = workout ? workout.name : "Séance";
    body.innerHTML = `<div class="detail-empty">Aucun exercice enregistré pour cette séance.</div>`;
    return;
  }

  const exerciseIds = exercises.map(e => e.id);
  const { data: sets } = await supabaseClient
    .from("workout_sets").select("*").in("exercise_id", exerciseIds).order("set_number", { ascending: true });

  // Records personnels : poids max jamais loggé, par nom d'exercice (toutes séances confondues)
  const { data: allSets } = await supabaseClient
    .from("workout_sets")
    .select("weight_kg, exercises!inner(name, workouts!inner(user_id))")
    .eq("exercises.workouts.user_id", currentUser.id);

  const recordsByName = {};
  (allSets || []).forEach(s => {
    const name = s.exercises?.name;
    if (!name || s.weight_kg == null) return;
    if (!recordsByName[name] || s.weight_kg > recordsByName[name]) recordsByName[name] = s.weight_kg;
  });

  document.getElementById("detail-title").textContent = workout.name;

  let totalVolume = 0, totalSets = 0;
  let html = `<div class="detail-summary">
    <div class="item"><div class="v">${workout.duration_min || "?"}</div><div class="k">Minutes</div></div>
    <div class="item"><div class="v">${workout.calories_burned ? Math.round(kcalToDisplayEnergy(workout.calories_burned)) : "?"}</div><div class="k">${energyUnitLabel()} brûlées</div></div>
    <div class="item"><div class="v" id="detail-volume">—</div><div class="k">Volume total (${weightUnitLabel()})</div></div>
  </div>`;

  exercises.forEach(ex => {
    const exoSets = (sets || []).filter(s => s.exercise_id === ex.id);
    html += `<div class="detail-exo"><div class="detail-exo-name">${ex.name}<button type="button" class="detail-hist-link" data-name="${histEsc(ex.name)}" onclick="openExerciseHistory(this.dataset.name)">Historique ›</button></div>`;
    if (!exoSets.length){
      html += `<div class="detail-empty" style="padding:8px 0;">Pas de série loggée en mode live.</div>`;
    } else {
      exoSets.forEach(s => {
        const isRecord = s.weight_kg != null && recordsByName[ex.name] === s.weight_kg && s.weight_kg > 0;
        if (s.weight_kg != null && s.reps != null) totalVolume += s.weight_kg * s.reps;
        totalSets++;
        html += `<div class="detail-set-row">
          <div class="detail-set-num">#${s.set_number}</div>
          <div class="detail-set-val">${s.weight_kg != null ? kgToDisplayWeight(s.weight_kg).toFixed(1) + " " + weightUnitLabel() : "—"} × ${s.reps != null ? s.reps + " reps" : "—"}</div>
          ${isRecord ? '<div class="detail-set-record">🏆 Record</div>' : ''}
        </div>`;
      });
    }
    html += `</div>`;
  });

  body.innerHTML = html;
  const volEl = document.getElementById("detail-volume");
  if (volEl) volEl.textContent = totalSets ? Math.round(kgToDisplayWeight(totalVolume)).toLocaleString("fr-FR") : "—";
}

function closeDetailOverlay(){
  document.getElementById("detail-overlay").classList.remove("open");
}

function renderHistory(workouts){
  const completed = workouts
    .filter(w => w.completed)
    .sort((a, b) => new Date(b.scheduled_at || b.created_at) - new Date(a.scheduled_at || a.created_at))
    .slice(0, 5);

  const container = document.getElementById("history-list");
  if (!completed.length){
    container.innerHTML = `<div class="history-item"><div class="history-meta"><div class="history-name">Pas encore de séance terminée</div></div></div>`;
    return;
  }
  container.innerHTML = "";
  completed.forEach(w => {
    const date = w.scheduled_at ? new Date(w.scheduled_at).toLocaleDateString("fr-FR", { weekday: "long" }) : "";
    const el = document.createElement("div");
    el.className = "history-item";
    el.style.cursor = "pointer";
    el.onclick = () => viewWorkoutDetail(w.id);
    el.innerHTML = `
      <div class="history-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6FA8FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="9" width="2.3" height="6" rx="1"/><rect x="4.3" y="7" width="2" height="10" rx="1"/><line x1="7.3" y1="12" x2="16.7" y2="12"/><rect x="17.7" y="7" width="2" height="10" rx="1"/><rect x="20.2" y="9" width="2.3" height="6" rx="1"/></svg></div>
      <div class="history-meta">
        <div class="history-name">${w.name}</div>
        <div class="history-date">${date}</div>
      </div>
      <div class="history-dur">${w.duration_min || "?"} min</div>
      <div class="history-actions">
        <button class="history-duplicate" onclick="event.stopPropagation(); repeatWorkout('${w.id}')" title="Refaire aujourd'hui en un clic">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
        </button>
        <button class="history-duplicate" onclick="event.stopPropagation(); duplicateWorkout('${w.id}')" title="Dupliquer et modifier">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="history-edit" onclick="event.stopPropagation(); editWorkout('${w.id}')" title="Modifier">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
        </button>
        <button class="history-delete" onclick="event.stopPropagation(); deleteWorkout('${w.id}')" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button>
      </div>`;
    container.appendChild(el);
  });
}

async function loadSport(){
  const user = await requireAuth();
  if (!user) return;

  document.getElementById("sport-date").textContent =
    new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const { data: profile } = await supabaseClient
    .from("profiles").select("weekly_workout_goal").eq("id", user.id).single();
  const weeklyGoal = profile?.weekly_workout_goal || 4;

  const { data: weekWorkouts } = await supabaseClient
    .from("workouts").select("*")
    .eq("user_id", user.id)
    .gte("scheduled_at", startOfWeek().toISOString())
    .lte("scheduled_at", endOfWeek().toISOString());

  const list = weekWorkouts || [];
  renderWeekBars(list);
  const completedCount = list.filter(w => w.completed).length;
  document.getElementById("completed-count").textContent = `${completedCount}/${weeklyGoal}`;
  document.getElementById("completed-label").textContent =
    completedCount >= weeklyGoal ? "Objectif atteint 🎉" : "Séances complétées";
  const totalBurnedKcal = list.filter(w => w.completed).reduce((s, w) => s + (w.calories_burned || 0), 0);
  document.getElementById("burned-total").textContent = Math.round(kcalToDisplayEnergy(totalBurnedKcal)).toLocaleString("fr-FR");
  document.getElementById("burned-label").textContent = `${energyUnitLabel()} brûlées`;
  renderHistory(list);

  await renderTodayWorkout(user);
}

(async function init(){
  await loadExerciseLibrary();
  await loadSport();
  document.getElementById("w-calories-label").textContent = `${energyUnitLabel()} brûlées estimées`;
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");
  if (editId) await editWorkout(editId);
})();
