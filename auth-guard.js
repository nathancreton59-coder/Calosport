// Garde d'authentification — à inclure sur toutes les pages protégées
// (index.html, calories.html, sport.html) après config.js

let currentUser = null;

async function requireAuth(opts = {}) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  currentUser = session.user;

  if (!opts.skipOnboardingCheck) {
    const { data: profile } = await supabaseClient
      .from("profiles").select("onboarding_completed").eq("id", session.user.id).single();
    if (profile && !profile.onboarding_completed){
      window.location.href = "onboarding.html";
      return null;
    }
  }

  return session.user;
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
