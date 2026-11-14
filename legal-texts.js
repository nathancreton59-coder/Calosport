// Calosport — textes légaux (politique de confidentialité et conditions d'utilisation).
// Source unique : affichés dans les réglages, sur legal.html et sur l'écran d'accord.
// Pour modifier un texte, c'est ici, et il faut mettre à jour LEGAL_UPDATED.

const LEGAL_UPDATED = "14 novembre 2026";

const LEGAL_POLICY_HTML = `
  <p class="legal-date">Dernière mise à jour : ${LEGAL_UPDATED}</p>

  <h4>1. Qui est responsable de tes données</h4>
  <p>Calosport est édité à titre non professionnel par son créateur (« l'éditeur »), qui est le responsable du traitement de tes données. Pour toute question ou pour exercer tes droits, contacte-le par le moyen qui t'a permis d'obtenir l'accès à l'application.</p>

  <h4>2. Les données que Calosport enregistre</h4>
  <ul>
    <li><b>Compte</b> : adresse e-mail, mot de passe (enregistré sous forme chiffrée, illisible par l'éditeur), prénom, pseudo si tu en choisis un.</li>
    <li><b>Profil</b> : sexe, âge, taille, poids, niveau d'activité, objectif, préférences d'unités, de thème et de rappels.</li>
    <li><b>Nutrition</b> : repas, aliments et recettes que tu crées, repas favoris, hydratation, compléments.</li>
    <li><b>Sport</b> : séances, exercices, séries, charges, répétitions, ressenti (RPE), exercices favoris.</li>
    <li><b>Progression</b> : pesées, mensurations, photos de progression, sommeil, points d'expérience et succès.</li>
    <li><b>Social</b> : liste d'amis, réactions et commentaires.</li>
  </ul>
  <p>Calosport n'enregistre que ce que tu saisis toi-même. Il n'y a ni publicité, ni traceur publicitaire, ni mesure d'audience, et tes données ne sont ni vendues ni cédées.</p>

  <h4>3. Des données de santé</h4>
  <p>Ton poids, tes mensurations, tes photos, ton sommeil, croisés avec ton alimentation et ton activité, renseignent sur ton état de santé : la loi les considère comme des données sensibles. Calosport ne les traite qu'avec ton accord explicite, demandé séparément à la première utilisation. Tu peux retirer cet accord à tout moment dans Réglages → Confidentialité.</p>

  <h4>4. Pourquoi ces données sont utilisées</h4>
  <ul>
    <li>Te fournir le service : calcul de tes objectifs, suivi, historique, statistiques, rappels affichés dans l'application (base : exécution du service que tu as demandé ; pour les données de santé : ton accord explicite).</li>
    <li>Faire fonctionner les fonctions sociales, si tu ajoutes des amis.</li>
    <li>Assurer la sécurité et le bon fonctionnement de l'application.</li>
  </ul>
  <p>Aucune décision automatisée produisant un effet juridique n'est prise à partir de tes données. Les suggestions (objectif calorique, charge conseillée) sont de simples calculs indicatifs.</p>

  <h4>5. Qui peut voir tes données</h4>
  <ul>
    <li><b>Toi seul</b>, pour tes repas, ton poids, tes mensurations, ton sommeil et tes photos.</li>
    <li><b>Les autres utilisateurs</b> qui recherchent ton pseudo voient ton pseudo et ton prénom. <b>Tes amis</b> voient en plus tes séances terminées (exercices, volume, durée, calories brûlées, records), ton niveau et tes points.</li>
    <li><b>L'éditeur</b> a un accès technique à la base de données pour la maintenance. Il s'engage à ne pas consulter tes données sans nécessité.</li>
    <li><b>Supabase</b>, le prestataire qui héberge la base de données et les photos, sur des serveurs situés dans l'Union européenne (Irlande). Supabase est une société américaine qui agit comme sous-traitant.</li>
    <li><b>L'hébergeur du site</b> reçoit, comme pour tout site web, ton adresse IP lorsque tu charges les pages.</li>
    <li><b>Open Food Facts</b> reçoit le code-barres (et ton adresse IP) lorsque tu scannes un produit, pour en renvoyer les valeurs nutritionnelles. L'image de la caméra est analysée sur ton appareil et n'est pas envoyée.</li>
  </ul>

  <h4>6. Ce qui est stocké sur ton appareil</h4>
  <p>Calosport n'utilise pas de cookies publicitaires. Ton navigateur conserve uniquement ce qui est nécessaire au fonctionnement : ta session de connexion, ton thème d'affichage et quelques réglages d'interface (rappels masqués, date du dernier ajustement d'objectif).</p>

  <h4>7. Combien de temps elles sont conservées</h4>
  <p>Tes données sont conservées tant que ton compte existe. Quand tu supprimes ton compte, elles sont effacées de façon définitive, photos comprises. Un compte resté inactif pendant deux ans pourra être supprimé par l'éditeur.</p>

  <h4>8. Tes droits</h4>
  <p>Tu peux à tout moment :</p>
  <ul>
    <li><b>consulter et corriger</b> tes données directement dans l'application ;</li>
    <li><b>en obtenir une copie</b> : Réglages → Confidentialité → Exporter toutes mes données ;</li>
    <li><b>retirer ton accord</b> sur les données de santé : Réglages → Confidentialité ;</li>
    <li><b>tout effacer</b> : Réglages → Confidentialité → Supprimer mes données ;</li>
    <li>demander la limitation d'un traitement ou t'y opposer, en contactant l'éditeur.</li>
  </ul>
  <p>Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la CNIL (cnil.fr).</p>

  <h4>9. Sécurité</h4>
  <p>Les échanges avec l'application sont chiffrés. Chaque table de la base est protégée par des règles qui n'autorisent un utilisateur à lire et modifier que ses propres données. Les photos sont rangées dans un espace privé propre à chaque compte.</p>

  <h4>10. Mineurs</h4>
  <p>Calosport est réservé aux personnes de 15 ans et plus.</p>

  <h4>11. Évolution de cette politique</h4>
  <p>Cette politique peut évoluer. La date en haut de la page indique la version en vigueur. Si un changement modifie l'usage de tes données de santé, ton accord te sera redemandé.</p>
`;

const LEGAL_TERMS_HTML = `
  <p class="legal-date">Dernière mise à jour : ${LEGAL_UPDATED}</p>
  <h4>1. Ce qu'est Calosport</h4>
  <p>Calosport est une application de suivi de l'alimentation, des séances de sport et de la progression physique. Elle est proposée gratuitement, à titre non professionnel, par son créateur (« l'éditeur »). En créant un compte, tu acceptes les présentes conditions.</p>

  <h4>2. Ton compte</h4>
  <p>Tu dois avoir au moins 15 ans pour créer un compte. Tu t'engages à fournir une adresse e-mail valide, à garder ton mot de passe confidentiel et à ne pas partager ton compte. Tu es responsable de ce qui est fait depuis ton compte. Préviens l'éditeur si tu penses que quelqu'un d'autre y a eu accès.</p>

  <h4>3. Calosport n'est pas un avis médical</h4>
  <p>Les objectifs caloriques, les estimations de dépense, les suggestions de charge, les programmes et les prévisions de poids sont des calculs automatiques à titre indicatif. Ils ne remplacent pas l'avis d'un médecin, d'un diététicien ou d'un professionnel du sport. Demande un avis médical avant de commencer un régime ou un programme d'entraînement, en particulier si tu as un problème de santé, si tu es enceinte ou si tu es mineur. Tu pratiques ton activité physique sous ta seule responsabilité.</p>

  <h4>4. Ce que tu peux et ne peux pas faire</h4>
  <p>L'application est réservée à un usage personnel. Tu t'engages à ne pas :</p>
  <ul>
    <li>tenter d'accéder aux données d'un autre utilisateur ou de contourner les protections de l'application ;</li>
    <li>perturber son fonctionnement, l'utiliser de façon automatisée ou en extraire les données en masse ;</li>
    <li>publier, dans ton pseudo, ton nom ou tes commentaires, un contenu insultant, haineux, à caractère sexuel, trompeur ou contraire à la loi ;</li>
    <li>harceler d'autres utilisateurs ou usurper l'identité de quelqu'un.</li>
  </ul>

  <h4>5. Fonctions sociales</h4>
  <p>Si tu choisis un pseudo, les autres utilisateurs peuvent te trouver en le recherchant et voient alors ton pseudo et ton nom. Quand tu acceptes une demande d'ami, cette personne voit tes séances terminées (exercices, volume, durée, calories brûlées, records), ton niveau et tes points, et peut y réagir ou les commenter. Tes repas, ton poids, tes mensurations, ton sommeil et tes photos ne sont jamais visibles par les autres. Tu peux retirer un ami à tout moment.</p>

  <h4>6. Tes contenus</h4>
  <p>Les données que tu saisis et les photos que tu ajoutes restent les tiennes. Tu autorises seulement l'éditeur à les stocker et à les afficher dans l'application pour te fournir le service. L'éditeur peut supprimer un contenu qui ne respecte pas ces conditions.</p>

  <h4>7. Disponibilité du service</h4>
  <p>Calosport est fourni « en l'état », sans garantie de disponibilité ni d'absence d'erreur. L'application peut évoluer, être interrompue pour maintenance ou être arrêtée. Les valeurs nutritionnelles viennent en partie de sources extérieures (Open Food Facts) et de tes propres saisies : elles peuvent être inexactes. Pense à exporter tes données si tu veux en garder une copie.</p>

  <h4>8. Responsabilité</h4>
  <p>Dans les limites permises par la loi, l'éditeur ne peut pas être tenu responsable d'une blessure, d'un problème de santé ou d'une perte de données liés à l'utilisation de l'application ou aux indications qu'elle fournit. Rien dans ces conditions ne limite les droits que la loi te reconnaît en tant que consommateur.</p>

  <h4>9. Données personnelles</h4>
  <p>L'utilisation de tes données est décrite dans la rubrique « Politique de confidentialité » des réglages. Tu peux exporter toutes tes données et supprimer ton compte depuis la rubrique « Confidentialité ».</p>

  <h4>10. Fin du compte</h4>
  <p>Tu peux supprimer ton compte à tout moment depuis les réglages : tes données sont alors effacées de façon définitive. L'éditeur peut suspendre ou supprimer un compte qui ne respecte pas ces conditions.</p>

  <h4>11. Évolution de ces conditions</h4>
  <p>Ces conditions peuvent être modifiées. La date en haut de cette page indique la dernière version en vigueur.</p>

  <h4>12. Droit applicable et contact</h4>
  <p>Ces conditions sont soumises au droit français. Pour toute question ou réclamation, contacte l'éditeur par le moyen qui t'a permis d'obtenir l'accès à l'application.</p>
    
`;
