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

// ---------- theme (mode clair / sombre / automatique) ----------
// Un petit script inline en tête de chaque page lit déjà le cache localStorage
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
