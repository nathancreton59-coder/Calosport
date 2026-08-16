// Calcul des besoins nutritionnels — formule de Mifflin-St Jeor
// Partagé entre onboarding.html et settings.html

const ACTIVITY_FACTORS = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.65,
  eleve: 1.725,
  tres_eleve: 1.9,
};

const ACTIVITY_LABELS = {
  sedentaire: "Pas de sport",
  leger: "Activité légère (1 à 3 séances/semaine)",
  modere: "Activité modérée (3 à 5 séances/semaine)",
  eleve: "Activité élevée (6 à 7 séances/semaine)",
  tres_eleve: "Très élevée (sport quotidien + travail physique)",
};

// Bornes recommandées pour l'ajustement calorique selon l'objectif
const SECHE_MIN = 550, SECHE_MAX = 700, SECHE_DEFAULT = 550;
const PDM_RANGES = {
  propre:    { min: 150, max: 250, default: 200, label: "Prise de masse propre" },
  classique: { min: 250, max: 350, default: 300, label: "Prise de masse classique" },
  agressive: { min: 350, max: 500, default: 400, label: "Prise de masse agressive" },
};

function computeNutritionPlan({ sex, weight, height, age, activityLevel, goal, goalAdjustment, proteinPerKg, fatPerKg }){
  const s = sex === "homme" ? 5 : -161;
  const mb = 10 * weight + 6.25 * height - 5 * age + s;
  const factor = ACTIVITY_FACTORS[activityLevel] || 1.2;
  const tdee = mb * factor;

  let calorieGoal = tdee;
  if (goal === "seche") calorieGoal = tdee - goalAdjustment;
  else if (goal === "prise_masse") calorieGoal = tdee + goalAdjustment;
  calorieGoal = Math.max(1200, calorieGoal); // garde-fou

  const proteinG = proteinPerKg * weight;
  const fatG = fatPerKg * weight;
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsKcal = Math.max(0, calorieGoal - proteinKcal - fatKcal);
  const carbsG = carbsKcal / 4;

  return {
    mb: Math.round(mb),
    tdee: Math.round(tdee),
    calorieGoal: Math.round(calorieGoal),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
  };
}
