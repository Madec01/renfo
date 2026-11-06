# Vérifications de Renfo 2.0

- 76 images WebP présentes, dont 26 nouvelles préparations. PNG revus par les agents, conversion sans recadrage ; correspondance exacte avec les 76 identifiants du catalogue.
- 16 tests automatisés : calculs sur séries validées, snapshots historiques, pause/reprise, charges par haltère, circuits, annulation, sauvegardes ; migration V1 vers V2 sans perte, profils indépendants, versions de modèles, ordre des quatre blocs, rejets de séances liées au mauvais profil, comptage total/par côté/par paire, fusion des carnets avec reprise des séances importées.
- Navigateur, ordinateur : accueil lisible, éditeur en quatre blocs, insertion de trois familles de préparation, paramètres personnels persistés. Séverine : 2 séries de squat à 4 kg ; Martin conserve 3 séries à 8 kg.
- Ajout d’un troisième profil vérifié par le formulaire ; retour à Séverine et reprise du bon carnet.
- Mode Actif : gros compteur, charge, consigne et illustration ; démarrage d’un chrono de 3 s, état « Temps atteint » sans validation automatique, validation réelle, repos et passage au mouvement suivant. Pause et minuteur conservés après fermeture/réouverture.
- Mode mobile vérifié dans une fenêtre de contenu de 390 × 844 (375 px utiles hors barre de défilement) : document sans débordement, cartes de séries tactiles, éditeur sans débordement, fiche d’étirement avec illustration chargée et quadriceps mis en évidence. Bascules Normal/Actif sans perte des valeurs.
- Aucun message d’erreur applicatif relevé dans la console pendant ces parcours. Données de QA uniquement dans le navigateur d’essai, jamais dans le dépôt.

Le plein écran, le maintien d’écran et la synthèse vocale dépendent du navigateur. Les sons/voix en arrière-plan et les essais sur appareils physiques iOS/Android restent à vérifier sur ces appareils. Les profils restent locaux et ne créent pas de compte ou de synchronisation interappareils.
