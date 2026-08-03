// Garde d'authentification — à inclure sur toutes les pages protégées
// (index.html, calories.html, sport.html) après config.js

let currentUser = null;

async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  currentUser = session.user;
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
