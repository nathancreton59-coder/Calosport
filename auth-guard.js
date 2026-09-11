// Garde d'authentification — à inclure sur toutes les pages protégées
// (index.html, calories.html, sport.html) après config.js

let currentUser = null;
window.userUnits = { weight: "kg", energy: "kcal", distance: "km" };

async function requireAuth(opts = {}) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  currentUser = session.user;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("onboarding_completed, weight_unit, energy_unit, distance_unit, theme_preference")
    .eq("id", session.user.id).single();

  if (profile){
    window.userUnits = {
      weight: profile.weight_unit || "kg",
      energy: profile.energy_unit || "kcal",
      distance: profile.distance_unit || "km",
    };
    applyTheme(profile.theme_preference || "dark");
  }

  if (!opts.skipOnboardingCheck && profile && !profile.onboarding_completed){
    window.location.href = "onboarding.html";
    return null;
  }

  return session.user;
}

// ---------- préférences d'unités (kg/lb, kcal/kJ, km/mi) ----------
// Les données restent TOUJOURS stockées en kg / kcal / km en base.
// Ces fonctions ne convertissent que ce qui est affiché ou saisi par l'utilisateur.
const KG_TO_LB = 2.2046226218;
const KCAL_TO_KJ = 4.184;
const KM_TO_MI = 0.621371;

function weightUnitLabel(){ return window.userUnits.weight === "lb" ? "lb" : "kg"; }
function energyUnitLabel(){ return window.userUnits.energy === "kj" ? "kJ" : "kcal"; }
function distanceUnitLabel(){ return window.userUnits.distance === "mi" ? "mi" : "km"; }

function kgToDisplayWeight(kg){
  if (kg == null || isNaN(kg)) return kg;
  return window.userUnits.weight === "lb" ? kg * KG_TO_LB : kg;
}
function displayWeightToKg(val){
  if (val == null || isNaN(val)) return val;
  return window.userUnits.weight === "lb" ? val / KG_TO_LB : val;
}
function kcalToDisplayEnergy(kcal){
  if (kcal == null || isNaN(kcal)) return kcal;
  return window.userUnits.energy === "kj" ? kcal * KCAL_TO_KJ : kcal;
}
function displayEnergyToKcal(val){
  if (val == null || isNaN(val)) return val;
  return window.userUnits.energy === "kj" ? val / KCAL_TO_KJ : val;
}
function kmToDisplayDistance(km){
  if (km == null || isNaN(km)) return km;
  return window.userUnits.distance === "mi" ? km * KM_TO_MI : km;
}

// Formatte un poids en kg (valeur brute stockée) dans l'unité choisie par l'utilisateur.
function formatWeight(kg, decimals){
  if (kg == null || isNaN(kg)) return "—";
  const d = decimals != null ? decimals : 1;
  return kgToDisplayWeight(kg).toFixed(d) + " " + weightUnitLabel();
}
// Formatte une énergie en kcal (valeur brute stockée) dans l'unité choisie par l'utilisateur.
function formatEnergy(kcal){
  if (kcal == null || isNaN(kcal)) return "—";
  return Math.round(kcalToDisplayEnergy(kcal)).toLocaleString("fr-FR") + " " + energyUnitLabel();
}

// Réagit si l'utilisateur se déconnecte depuis un autre onglet
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    window.location.href = "login.html";
  }
});

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Petits utilitaires de dates réutilisés sur plusieurs pages
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Heure réelle affichée en haut de chaque écran (au lieu d'une heure fixe)
function updateStatusTime() {
  const el = document.getElementById("status-time");
  if (!el) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  el.textContent = `${h}:${m}`;
}
updateStatusTime();
setInterval(updateStatusTime, 15000);

// ---------- XP & niveaux ----------
// Niveau 1 = "Nouveau", puis 10 paliers façon LoL à 3 sous-niveaux chacun (30 niveaux),
// puis "Prestige N" au-delà sans limite.
const XP_TIERS = ["Bois", "Fer", "Bronze", "Argent", "Or", "Platine", "Diamant", "Champion", "Grand Champion", "Olympien"];
const XP_TIER_COLORS = ["#8B5E34", "#8A93A0", "#B5651D", "#B0B7C3", "#E5B93B", "#4FD1C5", "#6FA8FF", "#B794F4", "#FF7A59", "#D4F252"];
const XP_PRESTIGE_COLOR = "#F2D06B";

// XP cumulé nécessaire pour ATTEINDRE le niveau n (n=1 -> 0 XP).
function xpForLevel(n){
  if (n <= 1) return 0;
  return Math.round(100 * Math.pow(n, 1.5));
}

// Déduit le niveau courant à partir de l'XP total cumulé.
function levelFromXp(xp){
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

// Infos d'affichage (nom, couleur, sous-niveau) pour un niveau donné.
function getLevelInfo(level){
  if (level <= 1) return { name: "Nouveau", tier: "nouveau", sub: null, color: "#8A93A0" };
  const idx = level - 2; // 0-based parmi les 30 niveaux à paliers
  if (idx < XP_TIERS.length * 3){
    const tierIdx = Math.floor(idx / 3);
    const sub = (idx % 3) + 1;
    return { name: `${XP_TIERS[tierIdx]} ${sub}`, tier: XP_TIERS[tierIdx], sub, color: XP_TIER_COLORS[tierIdx] };
  }
  const prestige = idx - XP_TIERS.length * 3 + 1;
  return { name: `Prestige ${prestige}`, tier: "prestige", sub: null, color: XP_PRESTIGE_COLOR };
}

// Résumé complet prêt à afficher (niveau courant, progression vers le suivant).
function getXpProgress(xpTotal){
  const level = levelFromXp(xpTotal || 0);
  const currentFloor = xpForLevel(level);
  const nextCeil = xpForLevel(level + 1);
  const info = getLevelInfo(level);
  const nextInfo = getLevelInfo(level + 1);
  return {
    level, xpTotal: xpTotal || 0,
    name: info.name, color: info.color,
    nextName: nextInfo.name,
    xpIntoLevel: (xpTotal || 0) - currentFloor,
    xpForNextLevel: nextCeil - currentFloor,
    pct: Math.max(0, Math.min(100, Math.round(((xpTotal - currentFloor) / (nextCeil - currentFloor)) * 100))),
  };
}

// Attribue de l'XP une seule fois par (source, related_key) — la dédup est gérée
// côté base (contrainte unique), donc un appel en double ici est sans risque.
async function awardXp(source, relatedKey, amount){
  try {
    const { data, error } = await supabaseClient.rpc("award_xp", {
      p_source: source, p_related_key: relatedKey, p_amount: amount
    });
    if (error){ console.error("awardXp", source, error); return false; }
    return !!data;
  } catch (e){
    console.error("awardXp", source, e);
    return false;
  }
}

// ---------- quêtes ----------
// S'appuient entièrement sur les événements déjà enregistrés dans xp_events —
// aucune table supplémentaire nécessaire. "target" = nombre de jours distincts
// (identifiés par related_key) requis dans la période pour valider la quête.
const QUEST_DEFS = [
  { code: "daily_workout", type: "daily", title: "Termine une séance", xp: 20, source: "workout_completed", target: 1 },
  { code: "daily_calorie", type: "daily", title: "Reste dans ton objectif calorique", xp: 15, source: "calorie_goal", target: 1 },
  { code: "daily_water", type: "daily", title: "Bois ton objectif d'eau", xp: 10, source: "water_goal", target: 1 },
  { code: "weekly_3_workouts", type: "weekly", title: "Termine 3 séances", xp: 80, source: "workout_completed", target: 3 },
  { code: "weekly_pr", type: "weekly", title: "Bats un record personnel", xp: 50, source: "personal_record", target: 1 },
  { code: "weekly_5_calorie", type: "weekly", title: "5 jours dans ton objectif calorique", xp: 60, source: "calorie_goal", target: 5 },
  { code: "weekly_5_water", type: "weekly", title: "Bois ton eau 5 jours", xp: 50, source: "water_goal", target: 5 },
];

// Date (lundi) du début de la semaine en cours, utilisée comme clé de période.
function getWeekKey(){
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// Calcule l'état de toutes les quêtes et attribue automatiquement l'XP bonus
// des quêtes qui viennent d'être validées (la contrainte unique de xp_events
// empêche tout doublon même si cette fonction est appelée plusieurs fois).
async function evaluateQuests(){
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekKey = getWeekKey();

  const { data: todayEvents } = await supabaseClient
    .from("xp_events").select("source, related_key")
    .eq("user_id", currentUser.id)
    .gte("created_at", todayStr + "T00:00:00")
    .lte("created_at", todayStr + "T23:59:59.999");

  const { data: weekEvents } = await supabaseClient
    .from("xp_events").select("source, related_key")
    .eq("user_id", currentUser.id)
    .gte("created_at", weekKey + "T00:00:00");

  const results = [];
  for (const q of QUEST_DEFS){
    const periodKey = q.type === "daily" ? todayStr : weekKey;
    const periodEvents = q.type === "daily" ? (todayEvents || []) : (weekEvents || []);
    const matching = periodEvents.filter(e => e.source === q.source);
    const uniqueCount = new Set(matching.map(e => e.related_key)).size;

    const questKey = `${q.code}:${periodKey}`;
    let completed = periodEvents.some(e => e.source === "quest" && e.related_key === questKey);
    if (!completed && uniqueCount >= q.target){
      await awardXp("quest", questKey, q.xp);
      completed = true;
    }
    results.push({ ...q, current: Math.min(uniqueCount, q.target), completed });
  }
  return results;
}


// pour appliquer le thème avant l'affichage (évite le flash). Cette fonction,
// appelée après le chargement du profil, applique la préférence réelle et
// met le cache à jour pour la prochaine visite / les autres pages.
function resolveTheme(pref){
  if (pref === "auto"){
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return pref === "light" ? "light" : "dark";
}

function applyTheme(pref){
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", resolved);
  try {
    localStorage.setItem("calosport-theme-pref", pref);
    localStorage.setItem("calosport-theme-resolved", resolved);
  } catch (e){ /* stockage indisponible, tant pis pour le cache anti-flash */ }
}

async function setThemePreference(pref){
  applyTheme(pref);
  if (currentUser){
    await supabaseClient.from("profiles").update({ theme_preference: pref }).eq("id", currentUser.id);
  }
}

// Si l'OS change de thème en direct et que la préférence est "auto", on suit.
if (window.matchMedia){
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    const cachedPref = (() => { try { return localStorage.getItem("calosport-theme-pref"); } catch(e){ return null; } })();
    if (cachedPref === "auto") applyTheme("auto");
  });
}
