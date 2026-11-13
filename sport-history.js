// Calosport — page Sport : historique par exercice (dernière fois, 1RM estimé, volume, intensité).

// ---------- historique par exercice ----------
// Pour un exercice donné (reconnu par son nom), regroupe toutes les séries validées par séance :
// 1RM estimé, volume, intensité, détail des séries. Affiché dans le formulaire de séance,
// pendant la séance et dans le détail d'une séance.
const exoHistoryCache = {};   // nom normalisé -> Promise<séances[]> (la plus récente en premier)
const EXO_HISTORY_PAGE = 8;
let exoHistoryShown = EXO_HISTORY_PAGE;
let exoHistoryCurrent = null; // { name, sessions }

function histEsc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function histWeight(kg){
  return (Math.round(kgToDisplayWeight(kg) * 10) / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

// Formule de Brzycki ; au-delà de 15 reps l'estimation n'a plus de sens, on plafonne.
function estimated1rm(kg, reps){
  if (!kg || !reps || kg <= 0 || reps <= 0) return 0;
  return kg * 36 / (37 - Math.min(reps, 15));
}

function loadExerciseHistory(name){
  const key = normalizeExoName(name);
  if (!key || !currentUser) return Promise.resolve([]);
  if (!exoHistoryCache[key]){
    exoHistoryCache[key] = fetchExerciseHistory(name).catch(err => {
      console.error("Historique exercice", err);
      delete exoHistoryCache[key];
      return [];
    });
  }
  return exoHistoryCache[key];
}

async function fetchExerciseHistory(name){
  const pattern = name.trim().replace(/[\\%_]/g, m => "\\" + m);
  const { data, error } = await supabaseClient
    .from("workout_sets")
    .select("set_number, weight_kg, reps, rpe, exercises!inner(id, name, position, workouts!inner(id, name, user_id, scheduled_at, created_at))")
    .eq("exercises.workouts.user_id", currentUser.id)
    .ilike("exercises.name", pattern)
    .eq("completed", true).eq("is_warmup", false);
  if (error) throw error;

  const byWorkout = {};
  (data || []).forEach(s => {
    const ex = s.exercises, w = ex && ex.workouts;
    if (!w || (s.weight_kg == null && s.reps == null)) return;
    if (!byWorkout[w.id]){
      byWorkout[w.id] = { workoutId: w.id, workoutName: w.name || "", date: new Date(w.scheduled_at || w.created_at), sets: [] };
    }
    byWorkout[w.id].sets.push({
      pos: ex.position || 0, n: s.set_number || 0,
      kg: s.weight_kg != null ? parseFloat(s.weight_kg) : null,
      reps: s.reps != null ? parseInt(s.reps) : null,
      rpe: s.rpe != null ? Number(s.rpe) : null
    });
  });

  const sessions = Object.values(byWorkout).sort((a, b) => a.date - b.date);
  let best = 0;
  sessions.forEach(se => {
    se.sets.sort((a, b) => a.pos - b.pos || a.n - b.n);
    se.volume = se.sets.reduce((t, s) => t + (s.kg && s.reps ? s.kg * s.reps : 0), 0);
    se.e1rm = Math.max(0, ...se.sets.map(s => estimated1rm(s.kg, s.reps)));
    se.topKg = Math.max(0, ...se.sets.map(s => s.kg || 0));
    se.isRecord = best > 0 && se.e1rm > best + 0.05;

    const rpes = se.sets.map(s => s.rpe).filter(v => v != null);
    if (rpes.length){
      const avg = rpes.reduce((t, v) => t + v, 0) / rpes.length;
      se.intensity = avg >= 9 ? "Très difficile" : avg >= 8 ? "Difficile" : avg >= 7 ? "Modérée" : "Facile";
      se.intensityClass = avg >= 8 ? "hard" : avg >= 7 ? "mid" : "easy";
    } else if (best > 0 && se.e1rm > 0){
      // Pas de RPE saisi : on compare la meilleure série du jour à ton meilleur niveau d'avant
      const ratio = se.e1rm / best;
      se.intensity = ratio >= 0.95 ? "Difficile" : ratio >= 0.85 ? "Modérée" : "Facile";
      se.intensityClass = ratio >= 0.95 ? "hard" : ratio >= 0.85 ? "mid" : "easy";
      se.intensityEstimated = true;
    } else {
      se.intensity = "—"; se.intensityClass = "";
    }
    best = Math.max(best, se.e1rm);
  });
  return sessions.reverse();
}

function histShortDate(d){
  const opts = { day: "numeric", month: "short" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("fr-FR", opts);
}

// "60 × 12 · 70 × 6 · 70 × 8 kg"
function histSetsSummary(se){
  const unit = weightUnitLabel();
  const parts = se.sets.map(s => s.kg != null ? `${histWeight(s.kg)} × ${s.reps ?? "?"}` : `${s.reps} reps`);
  return parts.join(" · ") + (se.sets.some(s => s.kg != null) ? " " + unit : "");
}

function exoRowName(row){
  const sel = row.querySelector(".exo-select");
  if (!sel || !sel.value) return "";
  if (sel.value === "__custom__") return (row.querySelector(".exo-custom-input").value || "").trim();
  const found = EXERCISE_LIBRARY.find(e => e.id === sel.value);
  return found ? found.name : "";
}

// Formulaire de séance : sous chaque exercice choisi, rappel de la dernière fois
function refreshExoLastLines(){
  const editingId = (document.getElementById("w-id") || {}).value || null;
  document.querySelectorAll("#exo-rows .exo-row").forEach(row => {
    const el = row.querySelector(".exo-last");
    if (!el) return;
    const name = exoRowName(row);
    if (el.dataset.name === name) return;
    el.dataset.name = name;
    if (!name){ el.style.display = "none"; el.innerHTML = ""; return; }
    el.style.display = "block";
    el.textContent = "Recherche de ta dernière séance…";
    loadExerciseHistory(name).then(sessions => {
      if (el.dataset.name !== name) return;
      const past = sessions.filter(s => s.workoutId !== editingId);
      if (!past.length){
        el.innerHTML = "Jamais fait jusqu'ici : l'historique apparaîtra après ta première séance.";
        return;
      }
      el.innerHTML = `Dernière fois (${histShortDate(past[0].date)}) : <b>${histSetsSummary(past[0])}</b>
        <span class="more">Historique (${past.length}) ›</span>`;
    });
  });
}

// Pendant la séance : carte "Dernière fois" sous le nom de l'exercice
function liveLastHtml(exo){
  const last = live && live.lastByName ? live.lastByName[exo.name] : null;
  const attr = `class="live-last" data-name="${histEsc(exo.name)}" onclick="openExerciseHistory(this.dataset.name)"`;
  if (!last) return `<div ${attr}>Première fois sur cet exercice : pas encore d'historique.</div>`;
  const prefill = !exo.prefilled ? ""
    : `<span class="prefill">${live.workout.is_deload ? "Charges pré-remplies à 60 % de cette séance (semaine de décharge)." : "Charges pré-remplies à partir de cette séance."}</span>`;
  return `<div ${attr}>Dernière fois (${histShortDate(last.date)}) : <b>${histSetsSummary(last)}</b>
    ${prefill}<span class="more">Voir tout l'historique ›</span></div>`;
}

async function openExerciseHistory(name){
  if (!name) return;
  const overlay = document.getElementById("exo-history-overlay");
  const body = document.getElementById("exo-history-body");
  document.getElementById("exo-history-title").textContent = name;
  body.innerHTML = `<div class="detail-empty">Chargement…</div>`;
  overlay.classList.add("open");
  const sessions = await loadExerciseHistory(name);
  exoHistoryCurrent = { name, sessions };
  exoHistoryShown = EXO_HISTORY_PAGE;
  renderExerciseHistory();
}

function closeExerciseHistory(){
  document.getElementById("exo-history-overlay").classList.remove("open");
}

function showMoreExerciseHistory(){
  exoHistoryShown += 20;
  renderExerciseHistory();
}

function exoHistoryChart(sessions){
  const pts = sessions.filter(s => s.e1rm > 0).slice().reverse(); // de la plus ancienne à la plus récente
  if (pts.length < 2) return "";
  const vals = pts.map(s => kgToDisplayWeight(s.e1rm));
  const min = Math.min(...vals), max = Math.max(...vals);
  const W = 300, H = 64, pad = 6;
  const x = i => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = v => max === min ? H / 2 : H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const lastX = x(vals.length - 1), lastY = y(vals[vals.length - 1]);
  return `<div class="eh-chart">
    <div class="k"><span>1RM estimé au fil des séances</span><span>${Math.round(min)} → ${Math.round(max)} ${weightUnitLabel()}</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${line}" fill="none" stroke="#D4F252" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="#D4F252"/>
    </svg>
  </div>`;
}

function renderExerciseHistory(){
  const body = document.getElementById("exo-history-body");
  if (!exoHistoryCurrent) return;
  const sessions = exoHistoryCurrent.sessions;
  const unit = weightUnitLabel();

  if (!sessions.length){
    body.innerHTML = `<div class="detail-empty">Aucune série validée pour cet exercice pour l'instant.<br>
      L'historique se remplit dès que tu valides des séries pendant une séance.</div>`;
    return;
  }

  const best1rm = Math.max(...sessions.map(s => s.e1rm));
  const bestKg = Math.max(...sessions.map(s => s.topKg));
  let html = `<div class="eh-sub">${sessions.length} séance${sessions.length > 1 ? "s" : ""} enregistrée${sessions.length > 1 ? "s" : ""}</div>
    <div class="eh-top">
      <div class="item"><div class="v">${sessions.length}</div><div class="k">Séances</div></div>
      <div class="item"><div class="v">${best1rm > 0 ? Math.round(kgToDisplayWeight(best1rm)) + " " + unit : "—"}</div><div class="k">Meilleur 1RM estimé</div></div>
      <div class="item"><div class="v">${bestKg > 0 ? histWeight(bestKg) + " " + unit : "—"}</div><div class="k">Charge max</div></div>
    </div>
    ${exoHistoryChart(sessions)}`;

  let hasEstimate = false;
  sessions.slice(0, exoHistoryShown).forEach(se => {
    if (se.intensityEstimated) hasEstimate = true;
    const dateTxt = se.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    html += `<div class="eh-card">
      <div class="eh-date">${dateTxt}</div>
      ${se.workoutName ? `<div class="eh-wname">${histEsc(se.workoutName)}</div>` : ""}
      ${se.isRecord ? '<div class="eh-record">Record</div>' : ""}
      <div class="eh-stats">
        <div><div class="v gold">${se.e1rm > 0 ? Math.round(kgToDisplayWeight(se.e1rm)) + " " + unit : "—"}</div><div class="k">1RM estimé</div></div>
        <div><div class="v">${se.volume > 0 ? Math.round(kgToDisplayWeight(se.volume)).toLocaleString("fr-FR") + " " + unit : "—"}</div><div class="k">Volume</div></div>
        <div><div class="v ${se.intensityClass}">${se.intensity}${se.intensityEstimated ? "*" : ""}</div><div class="k">Intensité</div></div>
      </div>
      <div class="eh-row head"><div>Série</div><div>Répétitions</div><div>Poids</div></div>
      ${se.sets.map((s, i) => `<div class="eh-row">
        <div class="muted">${i + 1}</div>
        <div>${s.reps ?? "—"}</div>
        <div>${s.kg != null ? histWeight(s.kg) + " " + unit : '<span class="muted">Poids du corps</span>'}</div>
      </div>`).join("")}
    </div>`;
  });

  const remaining = sessions.length - exoHistoryShown;
  if (remaining > 0){
    html += `<button type="button" class="eh-more" onclick="showMoreExerciseHistory()">Afficher les séances plus anciennes (${remaining})</button>`;
  }
  html += `<div class="eh-note">1RM estimé : charge maximale théorique sur une répétition, calculée à partir de ta meilleure série (formule de Brzycki).
    « Record » : la séance a battu ton meilleur 1RM estimé d'avant.
    ${hasEstimate ? "<br>* Intensité estimée en comparant la séance à ton meilleur niveau d'avant, faute de RPE saisi. Renseigne le RPE pendant la séance pour une intensité basée sur ton ressenti." : ""}</div>`;
  body.innerHTML = html;
}
