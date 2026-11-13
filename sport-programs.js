// Calosport — page Sport : programmes préconstruits et reprise d'une séance en un clic.

// ---------- PROGRAMMES PRÉCONSTRUITS ----------
// Catalogue : nom affiché, groupe musculaire, autres noms possibles dans la bibliothèque
const PROGRAM_EXERCISES = {
  bench:      { name: "Développé couché", group: "Pectoraux", alt: ["Développé couché barre", "Bench press"] },
  inclineDb:  { name: "Développé incliné haltères", group: "Pectoraux", alt: ["Développé incliné", "Incline dumbbell press"] },
  dips:       { name: "Dips", group: "Pectoraux", alt: ["Dips pectoraux", "Dips triceps"] },
  ohp:        { name: "Développé militaire", group: "Épaules", alt: ["Développé militaire barre", "Overhead press", "Développé épaules"] },
  lateral:    { name: "Élévations latérales", group: "Épaules", alt: ["Élévation latérale", "Élévations latérales haltères", "Lateral raise"] },
  facePull:   { name: "Face pull", group: "Épaules", alt: ["Face pull poulie"] },
  pullup:     { name: "Tractions", group: "Dos", alt: ["Traction", "Tractions pronation", "Pull-up"] },
  row:        { name: "Rowing barre", group: "Dos", alt: ["Rowing barre buste penché", "Barbell row"] },
  dbRow:      { name: "Rowing haltère", group: "Dos", alt: ["Rowing haltère un bras", "Rowing haltères"] },
  latPull:    { name: "Tirage vertical", group: "Dos", alt: ["Tirage vertical poulie haute", "Tirage poitrine", "Lat pulldown"] },
  deadlift:   { name: "Soulevé de terre", group: "Dos", alt: ["Deadlift"] },
  curl:       { name: "Curl barre", group: "Biceps", alt: ["Curl barre EZ", "Curl biceps barre", "Curl biceps"] },
  hammer:     { name: "Curl marteau", group: "Biceps", alt: ["Curl marteau haltères", "Hammer curl"] },
  pushdown:   { name: "Extension triceps poulie", group: "Triceps", alt: ["Extension triceps à la poulie", "Extensions triceps poulie haute", "Triceps pushdown"] },
  squat:      { name: "Squat", group: "Jambes", alt: ["Squat barre", "Back squat"] },
  legPress:   { name: "Presse à cuisses", group: "Jambes", alt: ["Presse à cuisse", "Presse", "Leg press"] },
  rdl:        { name: "Soulevé de terre roumain", group: "Jambes", alt: ["Soulevé de terre jambes tendues", "Romanian deadlift"] },
  lunge:      { name: "Fentes", group: "Jambes", alt: ["Fentes haltères", "Fentes avant", "Fentes marchées"] },
  legExt:     { name: "Leg extension", group: "Jambes", alt: ["Extension de jambes", "Extensions jambes"] },
  legCurl:    { name: "Leg curl", group: "Jambes", alt: ["Leg curl allongé", "Leg curl assis", "Flexion des jambes"] },
  calf:       { name: "Mollets debout", group: "Jambes", alt: ["Extension mollets debout", "Extensions mollets", "Mollets"] },
  crunch:     { name: "Crunch", group: "Abdos", alt: ["Crunchs", "Crunch au sol"] },
};

// Chaque exercice : [clé, séries, répétitions, repos en secondes]
const PROGRAMS = [
  {
    name: "Push / Pull / Legs", short: "PPL", level: "Intermédiaire", freq: "3 ou 6 séances / semaine", goal: "Prise de muscle",
    desc: "Un jour pour pousser, un pour tirer, un pour les jambes. Enchaîne les 3 séances une fois (3 j) ou deux fois (6 j) dans la semaine.",
    days: [
      { name: "Push — pectoraux, épaules, triceps", exercises: [["bench",4,8,120],["inclineDb",3,10,90],["ohp",3,8,120],["lateral",4,15,60],["dips",3,10,90],["pushdown",3,12,60]] },
      { name: "Pull — dos, biceps", exercises: [["deadlift",3,5,180],["pullup",4,8,120],["row",3,8,120],["latPull",3,10,90],["facePull",3,15,60],["curl",3,10,60],["hammer",3,12,60]] },
      { name: "Legs — jambes", exercises: [["squat",4,6,180],["legPress",3,10,120],["rdl",3,8,120],["legExt",3,12,60],["legCurl",3,12,60],["calf",4,15,60]] },
    ]
  },
  {
    name: "5×5 (StrongLifts)", short: "5×5", level: "Débutant", freq: "3 séances / semaine", goal: "Force",
    desc: "Alterne les séances A et B avec un jour de repos entre chaque (A-B-A, puis B-A-B). Ajoute 2,5 kg à chaque séance réussie.",
    days: [
      { name: "Séance A", exercises: [["squat",5,5,180],["bench",5,5,180],["row",5,5,180]] },
      { name: "Séance B", exercises: [["squat",5,5,180],["ohp",5,5,180],["deadlift",1,5,180]] },
    ]
  },
  {
    name: "Full body", short: "Full body", level: "Débutant", freq: "3 séances / semaine", goal: "Remise en forme / prise de muscle",
    desc: "Tout le corps à chaque séance. Alterne A et B avec au moins un jour de repos entre deux séances.",
    days: [
      { name: "Séance A", exercises: [["squat",3,8,120],["bench",3,8,120],["row",3,8,120],["ohp",2,10,90],["curl",2,12,60],["crunch",3,15,45]] },
      { name: "Séance B", exercises: [["deadlift",3,5,180],["inclineDb",3,10,90],["latPull",3,10,90],["lunge",3,10,90],["pushdown",2,12,60],["crunch",3,15,45]] },
    ]
  },
  {
    name: "Upper / Lower", short: "Upper/Lower", level: "Intermédiaire", freq: "4 séances / semaine", goal: "Force + prise de muscle",
    desc: "Haut du corps / bas du corps, deux fois par semaine : une séance orientée force (A), une orientée volume (B).",
    days: [
      { name: "Upper A — haut du corps (force)", exercises: [["bench",4,5,150],["row",4,5,150],["ohp",3,8,120],["pullup",3,8,120],["curl",3,10,60],["pushdown",3,10,60]] },
      { name: "Lower A — bas du corps (force)", exercises: [["squat",4,5,180],["rdl",3,8,120],["legPress",3,10,120],["legCurl",3,12,60],["calf",4,12,60]] },
      { name: "Upper B — haut du corps (volume)", exercises: [["inclineDb",4,10,90],["latPull",4,10,90],["lateral",4,15,60],["dbRow",3,10,90],["dips",3,10,90],["hammer",3,12,60]] },
      { name: "Lower B — bas du corps (volume)", exercises: [["deadlift",3,5,180],["lunge",3,10,90],["legExt",3,15,60],["legCurl",3,15,60],["calf",4,15,60]] },
    ]
  },
];

function normalizeExoName(s){
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// Cherche l'exercice dans la bibliothèque : nom exact d'abord, puis nom qui commence pareil
function findLibraryExercise(def){
  const wanted = [def.name, ...(def.alt || [])].map(normalizeExoName);
  const lib = EXERCISE_LIBRARY.map(e => ({ e, n: normalizeExoName(e.name) }));
  for (const w of wanted){
    const exact = lib.find(x => x.n === w);
    if (exact) return exact.e;
  }
  const main = wanted[0];
  const starts = lib.filter(x => x.n.startsWith(main + " ")).sort((a, b) => a.n.length - b.n.length);
  return starts.length ? starts[0].e : null;
}

function programDayDuration(day){
  const sec = day.exercises.reduce((t, [, sets, , rest]) => t + sets * (rest + 45), 0);
  return Math.max(15, Math.round(sec / 60 / 5) * 5);
}

function openProgramsOverlay(){
  renderProgramList();
  document.getElementById("programs-overlay").classList.add("open");
}
function closeProgramsOverlay(){
  document.getElementById("programs-overlay").classList.remove("open");
}

function renderProgramList(){
  document.getElementById("programs-title").textContent = "Programmes préconstruits";
  document.getElementById("programs-body").innerHTML = PROGRAMS.map((p, pi) => `
    <div class="prog-card" onclick="renderProgramDetail(${pi})">
      <div class="prog-name">${p.name}</div>
      <div class="prog-meta">${p.desc}</div>
      <span class="prog-tag">${p.level}</span><span class="prog-tag">${p.freq}</span><span class="prog-tag">${p.goal}</span>
    </div>`).join("");
}

function renderProgramDetail(pi){
  const p = PROGRAMS[pi];
  document.getElementById("programs-title").textContent = p.name;
  document.getElementById("programs-body").innerHTML = `
    <button type="button" class="prog-back" onclick="renderProgramList()">← Tous les programmes</button>
    <div class="prog-meta" style="margin:0 0 12px;">${p.desc}<br>Choisis une séance : elle s'ouvre déjà remplie, tu n'as plus qu'à régler la date et tes charges.</div>
    ${p.days.map((d, di) => `
      <div class="prog-day">
        <div class="prog-day-head">
          <div class="prog-day-name">${d.name}<div class="prog-meta" style="margin-top:2px;">${d.exercises.length} exercices · environ ${programDayDuration(d)} min</div></div>
          <button type="button" class="prog-day-add" onclick="applyProgramDay(${pi}, ${di})">Utiliser</button>
        </div>
        ${d.exercises.map(([key, sets, reps, rest]) => `
          <div class="prog-exo"><span>${PROGRAM_EXERCISES[key].name}</span><span>${sets} × ${reps} · ${rest}s</span></div>`).join("")}
      </div>`).join("")}`;
}

// Ouvre le formulaire "Nouvelle séance" pré-rempli avec la séance du programme
function applyProgramDay(pi, di){
  const p = PROGRAMS[pi];
  const day = p.days[di];
  closeProgramsOverlay();
  closeWorkoutModal();
  openWorkoutModal();
  document.getElementById("exo-rows").innerHTML = "";
  exoRowCount = 0;
  plannedSetsByRow = {};

  document.getElementById("w-name").value = `${p.short} — ${day.name.split(" — ")[0]}`;
  document.getElementById("w-type").value = "Force";
  document.getElementById("w-duration").value = programDayDuration(day);

  day.exercises.forEach(([key, sets, reps, rest]) => {
    const def = PROGRAM_EXERCISES[key];
    addExoRow();
    const id = "exo-row-" + (exoRowCount - 1);
    const row = document.getElementById(id);
    const select = row.querySelector(".exo-select");
    const customInput = row.querySelector(".exo-custom-input");
    const lib = findLibraryExercise(def);
    if (lib){
      select.value = lib.id;
    } else {
      // Absent de la bibliothèque : il y sera ajouté à l'enregistrement de la séance
      select.value = "__custom__";
      customInput.style.display = "block";
      customInput.value = def.name;
      row.dataset.muscle = def.group;
    }
    const plan = plannedSetsByRow[id];
    plan.rest = rest;
    plan.working = Array.from({ length: sets }, () => ({ reps: reps, weight: "" }));
    const restInput = row.querySelector(".ecp-rest-row input");
    if (restInput) restInput.value = rest;
    renderPlannedSetRows(id, false);
  });
  refreshFavButtons();
}

// ---------- REPRISE D'UNE SÉANCE EN UN CLIC ----------
// Recrée la séance pour aujourd'hui, avec les mêmes exercices, groupes et charges que la dernière fois.
let repeatInProgress = false;

function escHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function repeatWorkout(workoutId){
  if (repeatInProgress) return;
  repeatInProgress = true;
  try {
    const { data: src } = await supabaseClient.from("workouts").select("*").eq("id", workoutId).single();
    if (!src){ alert("Séance introuvable."); return; }
    if (currentWorkout && !confirm(`Tu as déjà une séance prévue aujourd'hui (« ${currentWorkout.name} »). Ajouter quand même « ${src.name} » ?`)) return;

    const { data: exercises } = await supabaseClient
      .from("exercises").select("*").eq("workout_id", workoutId).order("position", { ascending: true });
    const exoList = exercises || [];
    const exoIds = exoList.map(e => e.id);

    let sets = [];
    if (exoIds.length){
      const { data } = await supabaseClient
        .from("workout_sets").select("*").in("exercise_id", exoIds).order("set_number", { ascending: true });
      sets = data || [];
    }
    let blocks = [];
    if (exoList.some(e => e.block_id)){
      const { data } = await supabaseClient.from("workout_blocks").select("*").eq("workout_id", workoutId);
      blocks = data || [];
    }

    const { data: created, error } = await supabaseClient
      .from("workouts")
      .insert({
        user_id: currentUser.id, name: src.name, workout_type: src.workout_type,
        duration_min: src.duration_min, calories_burned: src.calories_burned,
        scheduled_at: new Date().toISOString(), completed: false, is_deload: false
      })
      .select().single();
    if (error){ alert("Erreur : " + error.message); return; }

    const blockIdMap = {};
    for (const b of blocks){
      const { data: nb, error: blockErr } = await supabaseClient
        .from("workout_blocks")
        .insert({ workout_id: created.id, block_type: b.block_type, rounds: b.rounds, rest_between_rounds: b.rest_between_rounds, position: b.position })
        .select().single();
      if (!blockErr && nb) blockIdMap[b.id] = nb.id;
    }
    const anyBlock = Object.keys(blockIdMap).length > 0;

    if (exoList.length){
      const exoRows = exoList.map((e, i) => {
        const r = {
          workout_id: created.id, name: e.name, exercise_library_id: e.exercise_library_id,
          sets: e.sets, reps: e.reps, rest_seconds: e.rest_seconds, position: i
        };
        if (anyBlock){
          r.block_id = blockIdMap[e.block_id] || null;
          r.block_order = r.block_id ? e.block_order : null;
        }
        return r;
      });
      const { data: inserted, error: exErr } = await supabaseClient.from("exercises").insert(exoRows).select();
      if (exErr){
        alert("La séance a été créée, mais ses exercices n'ont pas pu être copiés : " + exErr.message);
      } else {
        const newIdByPos = {};
        (inserted || []).forEach(x => { newIdByPos[x.position] = x.id; });
        const setRows = [];
        exoList.forEach((e, i) => {
          sets.filter(s => s.exercise_id === e.id).forEach(s => {
            setRows.push({
              exercise_id: newIdByPos[i], set_number: s.set_number, is_warmup: !!s.is_warmup,
              weight_kg: s.weight_kg, reps: s.reps, completed: false, completed_at: null,
              no_rest_before: !!s.no_rest_before
            });
          });
        });
        if (!setRows.some(s => s.no_rest_before)) setRows.forEach(s => { delete s.no_rest_before; });
        if (setRows.length){
          const { error: setErr } = await supabaseClient.from("workout_sets").insert(setRows);
          if (setErr) alert("Les séries n'ont pas pu être copiées : " + setErr.message);
        }
      }
    }

    showPRToast(`« ${src.name} » ajoutée à aujourd'hui`);
    await loadSport();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } finally {
    repeatInProgress = false;
  }
}

// Sous « Aucune séance planifiée » : les dernières séances différentes, à relancer en un clic
async function renderRepeatSuggestions(){
  const box = document.getElementById("repeat-suggestions");
  if (!box || !currentUser) return;
  const { data } = await supabaseClient
    .from("workouts").select("id, name, scheduled_at")
    .eq("user_id", currentUser.id).eq("completed", true)
    .order("scheduled_at", { ascending: false }).limit(25);
  const seen = new Set();
  const picks = [];
  (data || []).forEach(w => {
    const key = (w.name || "").trim().toLowerCase();
    if (!key || seen.has(key) || picks.length >= 4) return;
    seen.add(key);
    picks.push(w);
  });
  if (!picks.length){ box.innerHTML = ""; return; }
  const ago = iso => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} jours`;
  };
  box.innerHTML = `<div class="repeat-box">
    <div class="repeat-label">Refaire une séance en un clic</div>
    <div class="repeat-chips">` + picks.map(w => `
      <button type="button" class="repeat-chip" onclick="repeatWorkout('${w.id}')">↻ ${escHtml(w.name)}<small>Faite ${ago(w.scheduled_at)}</small></button>`).join("") + `
    </div>
  </div>`;
}
