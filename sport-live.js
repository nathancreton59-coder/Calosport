// Calosport — page Sport : séance en cours (mode live) : pré-remplissage, suggestion de charge,
// ressenti (RPE), chronomètre, validation des séries, repos, écran de fin.

// ---------- MODE LIVE ----------
let live = null;

function formatTime(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function launchLiveSession(){
  if (!currentWorkoutExercises.length){
    alert("Ajoute au moins un exercice à cette séance avant de la démarrer.");
    return;
  }

  const exercisesData = [];
  for (const ex of currentWorkoutExercises){
    const { data: existingSets } = await supabaseClient
      .from("workout_sets").select("*").eq("exercise_id", ex.id)
      .order("is_warmup", { ascending: false })
      .order("set_number", { ascending: true });

    let loggedSets;
    if (existingSets && existingSets.length){
      loggedSets = existingSets.map(s => ({
        set_number: s.set_number, weight_kg: s.weight_kg, reps: s.reps,
        completed: !!s.completed, dbId: s.id, isWarmup: !!s.is_warmup,
        noRestBefore: !s.is_warmup && !!s.no_rest_before, rpe: s.rpe ?? null
      }));
    } else {
      loggedSets = Array.from({ length: Math.max(ex.sets || 1, 1) }, (_, i) => ({
        set_number: i + 1, weight_kg: null, reps: ex.reps || null, completed: false, dbId: null, isWarmup: false
      }));
    }
    exercisesData.push({
      id: ex.id, name: ex.name, rest_seconds: ex.rest_seconds || 90, loggedSets,
      blockId: (ex.block_id && currentWorkoutBlocks[ex.block_id]) ? ex.block_id : null,
      blockOrder: ex.block_order ?? 0
    });
  }

  const exoNames = exercisesData.map(e => e.name);
  const priorRecords = {};
  const { data: userWorkouts } = await supabaseClient.from("workouts").select("id").eq("user_id", currentUser.id);
  const userWorkoutIds = (userWorkouts || []).map(w => w.id);
  if (userWorkoutIds.length && exoNames.length){
    const { data: matchingExos } = await supabaseClient
      .from("exercises").select("id, name").in("workout_id", userWorkoutIds).in("name", exoNames);
    const exoIdToName = {};
    (matchingExos || []).forEach(e => { exoIdToName[e.id] = e.name; });
    const histExoIds = Object.keys(exoIdToName);
    if (histExoIds.length){
      const { data: histSets } = await supabaseClient
        .from("workout_sets").select("exercise_id, weight_kg")
        .in("exercise_id", histExoIds).eq("is_warmup", false).eq("completed", true).not("weight_kg", "is", null);
      (histSets || []).forEach(s => {
        const name = exoIdToName[s.exercise_id];
        if (!priorRecords[name] || s.weight_kg > priorRecords[name]) priorRecords[name] = s.weight_kg;
      });
    }
  }

  // Dernière séance de chaque exercice (hors séance en cours), affichée sous le nom de l'exercice
  const lastByName = {};
  await Promise.all(exercisesData.map(async e => {
    const sessions = await loadExerciseHistory(e.name);
    lastByName[e.name] = sessions.find(s => s.workoutId !== currentWorkout.id) || null;
  }));

  live = {
    workout: currentWorkout, lastByName,
    exercises: exercisesData,
    currentExoIndex: 0,
    phase: "log",
    startTime: new Date(), endTime: null,
    exoMs: {}, exoCur: null, exoSince: Date.now(),
    timer: null, restRemaining: 0, restTotal: 0,
    priorRecords, newRecordAwarded: {},
    suggestions: {}, rpeQueue: [], rpeAsked: {},
    blocks: currentWorkoutBlocks, nextExoIdx: 0, restLabel: ""
  };

  // Suggestion de charge + pré-remplissage à partir de la dernière séance de chaque exercice.
  // Une série déjà validée, ou une charge que tu as saisie toi-même, n'est jamais modifiée.
  const isDeload = !!live.workout.is_deload;
  live.exercises.forEach(exo => {
    const last = live.lastByName[exo.name];
    if (!last || !last.sets.length) return;

    const plannedReps = exo.loggedSets.filter(s => !s.isWarmup && s.reps != null).map(s => s.reps);
    // Si tu as déjà prévu plus lourd que la dernière fois, la suggestion n'a plus lieu d'être
    const plannedTop = Math.max(0, ...exo.loggedSets.filter(s => !s.isWarmup && s.weight_kg != null).map(s => s.weight_kg));
    if (!isDeload){
      const sug = computeLoadSuggestion(last, plannedReps);
      if (sug && plannedTop <= sug.topKg + 0.01) live.suggestions[exo.name] = sug;
    }

    let rank = 0; // rang parmi les séries efficaces
    exo.loggedSets.forEach(s => {
      if (s.isWarmup) return;
      const ref = last.sets[Math.min(rank, last.sets.length - 1)];
      rank++;
      if (s.completed || !ref) return;
      if (s.weight_kg == null && ref.kg != null){
        // Semaine de décharge : 60 % de la dernière charge, arrondi au demi-kilo
        s.weight_kg = isDeload ? Math.round(ref.kg * 0.6 * 2) / 2 : ref.kg;
        exo.prefilled = true;
      }
      if (s.reps == null && ref.reps != null) s.reps = ref.reps;
    });
  });

  document.getElementById("live-overlay").classList.add("open");
  renderLiveBody();
  startLiveClock();
}

// ---------- suggestion de charge ----------
// Pas d'augmentation en dessous de ces paliers : +2,5 kg dès 30 kg, +1 kg dès 12 kg, +0,5 kg en dessous.
function loadStepKg(kg){ return kg >= 30 ? 2.5 : kg >= 12 ? 1 : 0.5; }

// Compare la dernière séance à l'objectif de reps : si toutes les séries à la charge de travail
// ont atteint l'objectif, on propose de monter ; sinon de garder la charge.
function computeLoadSuggestion(last, plannedReps){
  const work = last.sets.filter(s => s.kg > 0 && s.reps > 0);
  if (!work.length) return null;
  const topKg = Math.max(...work.map(s => s.kg));
  const top = work.filter(s => Math.abs(s.kg - topKg) < 0.01);
  const reps = top.map(s => s.reps);
  const fromPlan = plannedReps.length > 0;
  const target = fromPlan ? Math.max(...plannedReps) : Math.max(...reps);
  const hit = reps.every(r => r >= target) && (fromPlan || top.length >= 2);
  const rpes = top.map(s => s.rpe).filter(v => v != null);
  const avgRpe = rpes.length ? rpes.reduce((t, v) => t + v, 0) / rpes.length : null;
  const load = `${histWeight(topKg)} ${weightUnitLabel()}`;
  const setsTxt = `${top.length > 1 ? "tes " + top.length + " séries" : "ta série"} à ${load}`;

  if (hit && avgRpe != null && avgRpe >= 9.5){
    return { type: "keep", topKg, kg: topKg,
      text: `tu as tenu ${target} reps sur ${setsTxt}, mais au maximum (RPE ${avgRpe.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}). Refais cette charge avant de monter.` };
  }
  if (hit){
    const step = loadStepKg(topKg);
    return { type: "up", topKg, kg: topKg + step, step, text: `tu as tenu ${target} reps sur ${setsTxt} la dernière fois.` };
  }
  if (!fromPlan && top.length < 2){
    return { type: "keep", topKg, kg: topKg,
      text: `une seule série à ${load} la dernière fois (${reps[0]} reps). Vise ${reps[0] + 1} reps, ou une série de plus à cette charge, avant de monter.` };
  }
  return { type: "keep", topKg, kg: topKg,
    text: `dernière fois : ${reps.join(", ")} reps à ${load}. Vise ${target} reps sur chaque série avant de monter.` };
}

function liveSuggestHtml(exo){
  const sug = live.suggestions ? live.suggestions[exo.name] : null;
  if (!sug) return "";
  const unit = weightUnitLabel();
  if (sug.type === "up"){
    return `<div class="live-suggest up" id="live-suggest">
      <b>💡 Suggestion : ${histWeight(sug.kg)} ${unit}</b> (+${histWeight(sug.step)} ${unit}) — ${sug.text}
      ${sug.applied
        ? '<span class="applied">✓ Appliquée aux séries restantes</span>'
        : `<button type="button" onclick="applyLoadSuggestion()">Appliquer ${histWeight(sug.kg)} ${unit}</button>`}
    </div>`;
  }
  return `<div class="live-suggest" id="live-suggest"><b>💡 Garde ${histWeight(sug.kg)} ${unit}</b> — ${sug.text}</div>`;
}

// Remplace la charge de travail par la charge suggérée sur les séries pas encore validées
// (les séries plus légères de la dernière fois, montée en charge ou dropset, ne bougent pas).
function applyLoadSuggestion(){
  const exo = live.exercises[live.currentExoIndex];
  const sug = live.suggestions[exo.name];
  const last = live.lastByName[exo.name];
  if (!sug || sug.type !== "up" || !last) return;
  let rank = 0;
  exo.loggedSets.forEach((s, i) => {
    if (s.isWarmup) return;
    const ref = last.sets[Math.min(rank, last.sets.length - 1)];
    rank++;
    if (s.completed || !ref || ref.kg == null || Math.abs(ref.kg - sug.topKg) > 0.01) return;
    s.weight_kg = sug.kg;
    const input = document.querySelector(`#set-row-${i} .set-weight`);
    if (input) input.value = kgToDisplayWeight(sug.kg).toFixed(1);
  });
  sug.applied = true;
  const card = document.getElementById("live-suggest");
  if (card) card.outerHTML = liveSuggestHtml(exo);
}

// ---------- ressenti (RPE) demandé à la fin de chaque exercice ----------
const RPE_CHOICES = [[6, "Facile"], [7, "Modéré"], [8, "Difficile"], [9, "Très dur"], [10, "Maximum"]];

function queueRpePrompt(exoIdx){
  const exo = live.exercises[exoIdx];
  if (live.rpeAsked[exoIdx] || !exo.loggedSets.every(s => s.completed)) return;
  if (!exo.loggedSets.some(s => !s.isWarmup && s.rpe == null)) return; // RPE déjà saisi série par série
  live.rpeAsked[exoIdx] = true;
  live.rpeQueue.push(exoIdx);
}

function rpePromptHtml(){
  if (!live.rpeQueue || !live.rpeQueue.length) return "";
  const exo = live.exercises[live.rpeQueue[0]];
  return `<div class="rpe-prompt" id="rpe-prompt">
    <div class="rp-title">Comment était <b>${histEsc(exo.name)}</b> ?</div>
    <div class="rp-choices">${RPE_CHOICES.map(([v, l]) => `<button type="button" onclick="answerRpePrompt(${v})"><span class="n">${v}</span>${l}</button>`).join("")}</div>
    <button type="button" class="rp-skip" onclick="answerRpePrompt(null)">Passer</button>
  </div>`;
}

// Le ressenti choisi est appliqué aux séries efficaces de l'exercice qui n'ont pas déjà un RPE
async function answerRpePrompt(value){
  const exoIdx = live.rpeQueue.shift();
  const el = document.getElementById("rpe-prompt");
  if (el) el.outerHTML = rpePromptHtml();
  if (value == null || exoIdx == null) return;
  const exo = live.exercises[exoIdx];
  const sets = exo.loggedSets.filter(s => !s.isWarmup && s.completed && s.rpe == null);
  sets.forEach(s => { s.rpe = value; });
  await Promise.all(sets.map(s => s.savePromise).filter(Boolean));
  const ids = sets.map(s => s.dbId).filter(Boolean);
  if (ids.length){
    const { error } = await supabaseClient.from("workout_sets").update({ rpe: value }).in("id", ids);
    if (error) console.error("Enregistrement du RPE", error);
  }
  delete exoHistoryCache[normalizeExoName(exo.name)];
}

// ---------- chronomètre de séance ----------
let liveClockInterval = null;

function liveClockFmt(ms){
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

// Temps passé sur un exercice (repos compris), calculé sur l'horloge et non sur un compteur :
// il reste juste même si le téléphone se met en veille.
function liveExoMs(idx){
  return (live.exoMs[idx] || 0) + (live.exoCur === idx ? Date.now() - live.exoSince : 0);
}

function liveClockSync(){
  const target = live.phase === "summary" ? null : live.currentExoIndex;
  if (live.exoCur === target) return;
  if (live.exoCur != null) live.exoMs[live.exoCur] = (live.exoMs[live.exoCur] || 0) + (Date.now() - live.exoSince);
  live.exoCur = target;
  live.exoSince = Date.now();
  if (target == null && !live.endTime) live.endTime = new Date();
}

function liveClockTick(){
  if (!live) return;
  const total = document.getElementById("live-clock");
  if (total) total.textContent = liveClockFmt((live.endTime || new Date()) - live.startTime);
  const ex = document.getElementById("live-exo-clock");
  if (ex && live.exoCur != null) ex.textContent = liveClockFmt(liveExoMs(live.exoCur));
}

function startLiveClock(){
  stopLiveClock();
  liveClockInterval = setInterval(liveClockTick, 1000);
  liveClockTick();
}

function stopLiveClock(){
  if (liveClockInterval) clearInterval(liveClockInterval);
  liveClockInterval = null;
}

async function saveSet(exo, setIdx){
  delete exoHistoryCache[normalizeExoName(exo.name)]; // l'historique de cet exercice change
  const s = exo.loggedSets[setIdx];
  if (s.dbId){
    await supabaseClient.from("workout_sets")
      .update({ weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe, completed: true, completed_at: new Date().toISOString() })
      .eq("id", s.dbId);
  } else {
    const { data } = await supabaseClient.from("workout_sets")
      .insert({ exercise_id: exo.id, set_number: s.set_number, is_warmup: !!s.isWarmup, weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe, completed: true, completed_at: new Date().toISOString() })
      .select().single();
    if (data) s.dbId = data.id;
  }
}

function validateSet(setIdx){
  const exo = live.exercises[live.currentExoIndex];
  const row = document.getElementById("set-row-" + setIdx);
  const weightInput = parseFloat(row.querySelector(".set-weight").value) || null;
  const weight = weightInput != null ? displayWeightToKg(weightInput) : null;
  const reps = parseInt(row.querySelector(".set-reps").value) || null;
  const rpe = row.dataset.rpe ? parseInt(row.dataset.rpe) : null;
  exo.loggedSets[setIdx].weight_kg = weight;
  exo.loggedSets[setIdx].reps = reps;
  exo.loggedSets[setIdx].rpe = rpe;
  exo.loggedSets[setIdx].completed = true;
  exo.loggedSets[setIdx].savePromise = saveSet(exo, setIdx);
  queueRpePrompt(live.currentExoIndex);

  if (weight != null && weight > 0 && !exo.loggedSets[setIdx].isWarmup){
    const prior = live.priorRecords[exo.name] || 0;
    if (weight > prior && !live.newRecordAwarded[exo.name]){
      live.newRecordAwarded[exo.name] = true;
      const todayStr = new Date().toISOString().slice(0, 10);
      awardXp("personal_record", `${exo.name}:${todayStr}`, 40);
      showPRToast(`🏆 Nouveau record sur ${exo.name} !`);
    }
  }

  const next = computeNextStep(live.currentExoIndex, setIdx);
  if (next.exoIdx == null){ goToSummary(); return; }
  live.nextExoIdx = next.exoIdx;
  live.restLabel = next.label || "Repos avant la série suivante";
  if (next.rest > 0){
    startRest(next.rest, setIdx);
  } else {
    // Enchaînement sans repos (dropset, ou exercice suivant du superset/circuit)
    live.currentExoIndex = next.exoIdx;
    live.phase = "log";
    renderLiveBody();
  }
}

// Un "tour" d'un exercice = une série efficace + ses éventuels dropsets enchaînés
function liveRoundOf(exo, setIdx){
  let r = 0;
  for (let j = 0; j <= setIdx; j++){
    const s = exo.loggedSets[j];
    if (!s.isWarmup && !s.noRestBefore) r++;
  }
  return r;
}
function liveRoundCount(exo){
  return exo.loggedSets.filter(s => !s.isWarmup && !s.noRestBefore).length;
}
function liveBlockMembers(blockId){
  return live.exercises
    .map((e, idx) => ({ e, idx }))
    .filter(m => m.e.blockId === blockId)
    .sort((a, b) => a.e.blockOrder - b.e.blockOrder);
}

// Décide de la suite après validation d'une série : durée du repos (0 = aucun) et exercice suivant (null = résumé)
function computeNextStep(exoIdx, setIdx){
  const exo = live.exercises[exoIdx];
  const cur = exo.loggedSets[setIdx];
  const nextSet = exo.loggedSets[setIdx + 1];

  // Dropset : la série suivante s'enchaîne immédiatement
  if (nextSet && nextSet.noRestBefore) return { rest: 0, exoIdx, label: "" };

  const block = exo.blockId ? live.blocks[exo.blockId] : null;
  if (block && !cur.isWarmup){
    const r = liveRoundOf(exo, setIdx);
    const members = liveBlockMembers(exo.blockId);
    const pos = members.findIndex(m => m.idx === exoIdx);
    const totalRounds = Math.max(...members.map(m => liveRoundCount(m.e)));

    const nextInRound = members.slice(pos + 1).find(m => liveRoundCount(m.e) >= r);
    if (nextInRound) return { rest: 0, exoIdx: nextInRound.idx, label: "" };

    const nextRoundFirst = members.find(m => liveRoundCount(m.e) >= r + 1);
    if (nextRoundFirst){
      return { rest: block.rest, exoIdx: nextRoundFirst.idx, label: `Tour ${r}/${totalRounds} terminé · ensuite : ${nextRoundFirst.e.name}` };
    }

    const after = Math.max(...members.map(m => m.idx)) + 1;
    if (after >= live.exercises.length) return { rest: 0, exoIdx: null };
    return { rest: block.rest, exoIdx: after, label: `${blockLabel(block)} terminé · ensuite : ${live.exercises[after].name}` };
  }

  if (nextSet) return { rest: exo.rest_seconds || 90, exoIdx, label: "Repos avant la série suivante" };
  if (exoIdx >= live.exercises.length - 1) return { rest: 0, exoIdx: null };
  return { rest: exo.rest_seconds || 90, exoIdx: exoIdx + 1, label: `Ensuite : ${live.exercises[exoIdx + 1].name}` };
}

function showPRToast(message){
  const el = document.getElementById("pr-toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window._prToastTimeout);
  window._prToastTimeout = setTimeout(() => el.classList.remove("show"), 2800);
}

function setRpe(setIdx, value){
  const row = document.getElementById("set-row-" + setIdx);
  row.dataset.rpe = value;
  row.querySelectorAll(".rpe-btn").forEach(b => b.classList.toggle("active", parseInt(b.textContent) === value));
}

function startRest(seconds, justCompletedSetIdx){
  live.phase = "rest";
  live.restTotal = seconds;
  live.restRemaining = seconds;
  live.pendingSetIdx = justCompletedSetIdx;
  renderLiveBody();
  live.timer = setInterval(() => {
    live.restRemaining--;
    updateRestUI();
    if (live.restRemaining <= 0){
      clearInterval(live.timer);
      finishRest();
    }
  }, 1000);
}

function updateRestUI(){
  const disp = document.getElementById("rest-time-display");
  const bar = document.getElementById("rest-bar-fill");
  if (disp) disp.textContent = formatTime(live.restRemaining);
  if (bar) bar.style.width = Math.max(0, (live.restRemaining / live.restTotal) * 100) + "%";
}

function addRestTime(sec){
  live.restRemaining += sec; live.restTotal += sec;
  updateRestUI();
}

function skipRest(){
  clearInterval(live.timer);
  finishRest();
}

function finishRest(){
  if (live.nextExoIdx == null){ goToSummary(); return; }
  live.currentExoIndex = live.nextExoIdx;
  live.phase = "log";
  renderLiveBody();
}

function skipToNextExercise(){
  if (live.currentExoIndex < live.exercises.length - 1){
    live.currentExoIndex++;
    live.phase = "log";
    renderLiveBody();
  } else {
    goToSummary();
  }
}

function goToSummary(){
  if (live.timer) clearInterval(live.timer);
  live.phase = "summary";
  renderLiveBody();
}

function confirmExitLive(){
  if (confirm("Quitter la séance ? Les séries déjà validées restent enregistrées.")){
    if (live.timer) clearInterval(live.timer);
    stopLiveClock();
    document.getElementById("live-overlay").classList.remove("open");
    loadSport();
  }
}

async function finishWorkout(){
  const duration = parseInt(document.getElementById("summary-duration").value) || null;
  const caloriesInput = parseInt(document.getElementById("summary-calories").value) || null;
  const calories = caloriesInput != null ? Math.round(displayEnergyToKcal(caloriesInput)) : null;
  await supabaseClient.from("workouts")
    .update({ completed: true, duration_min: duration, calories_burned: calories })
    .eq("id", live.workout.id);
  awardXp("workout_completed", live.workout.id, 50);
  stopLiveClock();
  document.getElementById("live-overlay").classList.remove("open");
  loadSport();
}

function renderLiveBody(){
  const progressLbl = document.getElementById("live-progress-lbl");
  const body = document.getElementById("live-body");
  const footer = document.getElementById("live-footer");

  liveClockSync();
  liveClockTick();

  if (live.phase === "summary"){
    progressLbl.textContent = "Résumé";
    const totalMs = (live.endTime || new Date()) - live.startTime;
    const elapsedMin = Math.max(1, Math.round(totalMs / 60000));
    const timeRows = live.exercises
      .map((e, i) => ({ name: e.name, ms: live.exoMs[i] || 0 }))
      .filter(x => x.ms >= 1000)
      .map(x => `<div class="st-row"><span>${histEsc(x.name)}</span><span>${liveClockFmt(x.ms)}</span></div>`).join("");
    body.innerHTML = `
      ${rpePromptHtml()}
      <div class="live-summary">
        <div class="emoji">🎉</div>
        <h2>Séance terminée !</h2>
        <p>Beau travail. Vérifie les derniers détails avant d'enregistrer.</p>
        <div class="summary-times">
          <div class="st-title">Temps par exercice (repos compris)</div>
          ${timeRows}
          <div class="st-row total"><span>Durée totale</span><span>${liveClockFmt(totalMs)}</span></div>
        </div>
        <div class="modal-field"><label>Durée (min)</label><input type="number" id="summary-duration" value="${elapsedMin}"></div>
        <div class="modal-field"><label>${energyUnitLabel()} brûlées (estimation)</label><input type="number" id="summary-calories" value="${live.workout.calories_burned ? Math.round(kcalToDisplayEnergy(live.workout.calories_burned)) : ""}" placeholder="300"></div>
      </div>`;
    footer.innerHTML = `<button class="live-next-btn" onclick="finishWorkout()">Enregistrer et terminer</button>`;
    return;
  }

  const exo = live.exercises[live.currentExoIndex];
  progressLbl.textContent = `Exercice ${live.currentExoIndex + 1}/${live.exercises.length}`;

  if (live.phase === "rest"){
    body.innerHTML = `
      ${rpePromptHtml()}
      <div class="live-exo-name">${exo.name}</div>
      <div class="live-exo-meta">${live.restLabel || "Repos avant la série suivante"}</div>
      <div class="rest-card">
        <div class="rest-label">Temps de repos</div>
        <div class="rest-time" id="rest-time-display">${formatTime(live.restRemaining)}</div>
        <div class="rest-bar-track"><div class="rest-bar-fill" id="rest-bar-fill" style="width:${(live.restRemaining / live.restTotal) * 100}%"></div></div>
        <div class="rest-actions">
          <button class="rest-btn add" onclick="addRestTime(15)">+15s</button>
          <button class="rest-btn skip" onclick="skipRest()">Passer le repos</button>
        </div>
      </div>`;
    footer.innerHTML = "";
    return;
  }

  const block = exo.blockId ? live.blocks[exo.blockId] : null;
  let blockBanner = "";
  if (block){
    const members = liveBlockMembers(exo.blockId).map(m => m.e);
    const totalRounds = Math.max(...members.map(e => liveRoundCount(e)));
    const doneRounds = exo.loggedSets.filter(s => s.completed && !s.isWarmup && !s.noRestBefore).length;
    const round = Math.min(totalRounds, doneRounds + 1);
    const others = members.filter(e => e !== exo).map(e => e.name).join(", ");
    blockBanner = `<div class="block-live-banner ${block.type}">🔗 ${blockLabel(block)} · Tour ${round}/${totalRounds}
      <span>Une série ici, puis enchaîne sans repos avec : ${others}. Repos de ${block.rest}s à la fin de chaque tour.</span></div>`;
  }
  const currentSetIdx = exo.loggedSets.findIndex(s => !s.completed);

  const setsHtml = exo.loggedSets.map((s, i) => `
    <div class="set-row ${s.completed ? "done" : (i === currentSetIdx ? "current" : "")}" id="set-row-${i}" data-rpe="${s.rpe ?? ""}">
      ${s.noRestBefore ? '<div class="drop-tag">⚡ Dropset — enchaîne sans repos</div>' : ""}
      <div class="set-num">${s.isWarmup ? "É" + (s.set_number ?? i + 1) : (s.set_number ?? i + 1)}</div>
      <div class="set-input-group">
        <div class="grp"><span class="u">${weightUnitLabel()}</span><input type="number" class="set-weight" step="0.1" value="${s.weight_kg != null ? kgToDisplayWeight(s.weight_kg).toFixed(1) : ""}" ${s.completed ? "disabled" : ""}></div>
        <div class="grp"><span class="u">reps</span><input type="number" class="set-reps" value="${s.reps ?? ""}" ${s.completed ? "disabled" : ""}></div>
      </div>
      <button type="button" class="set-validate ${s.completed ? "done" : ""}" onclick="validateSet(${i})" ${s.completed ? "disabled" : ""}>
        ${s.completed
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#12161B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
          : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'}
      </button>
      ${!s.isWarmup ? `
      <div class="rpe-row">
        <span class="rpe-label">RPE</span>
        ${[6, 7, 8, 9, 10].map(v => `<button type="button" class="rpe-btn ${s.rpe === v ? "active" : ""}" onclick="setRpe(${i}, ${v})" ${s.completed ? "disabled" : ""}>${v}</button>`).join("")}
      </div>` : ""}
    </div>`).join("");

  body.innerHTML = `
    ${live.workout.is_deload ? '<div class="deload-banner">🔵 Semaine de décharge — vise environ 40% de charge en moins que d\'habitude</div>' : ""}
    ${rpePromptHtml()}
    ${blockBanner}
    <div class="live-exo-name">${exo.name}</div>
    <div class="live-exo-meta" style="margin-bottom:12px;">${exo.loggedSets.length} séries cibles · ${block ? `${block.rest}s de repos entre les tours` : `${exo.rest_seconds}s de repos`} · ⏱ <span class="live-exo-clock" id="live-exo-clock">${liveClockFmt(liveExoMs(live.currentExoIndex))}</span></div>
    ${liveLastHtml(exo)}
    ${liveSuggestHtml(exo)}
    ${setsHtml}`;

  const isLast = live.currentExoIndex === live.exercises.length - 1;
  footer.innerHTML = `<button class="live-next-btn" onclick="${isLast ? "goToSummary()" : "skipToNextExercise()"}">${isLast ? "Terminer la séance" : "Passer à l'exercice suivant"}</button>`;
}
