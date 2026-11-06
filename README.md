# Renfo

Application personnelle de renforcement, en français, utilisable sur téléphone et ordinateur. Le site fonctionne sans compte applicatif et sans serveur de données : le carnet est enregistré dans IndexedDB sur l’appareil.

## Fonctionnalités

- Catalogue de 24 séances disponibles aussi sur les carnets existants : 15 groupes musculaires, 3 renforcement + mobilité et 6 mobilité. Échauffement lié, étirements adaptés, aperçu des blocs et personnalisation par personne. Les modèles personnels restent séparés du catalogue.

- Séances communes : Les personnes choisies apparaissent ensemble. Chacun conserve ses séries, répétitions, charges, chronos, exercices et commentaires. Le choix de profil filtre uniquement le suivi.
- Onglet Séances avec deux entrées : choisir un programme ou créer en trois étapes (participants, mouvements, réglages personnels).
- Quatre blocs facultatifs et réordonnables : échauffement, renforcement, mobilisation, étirements. Séries classiques ou circuit, routines dosées, exercices interchangeables par participant.
- Un mouvement courant et des commandes personnelles de validation. L’action d’une personne ne valide rien pour les autres. Programme complet et ajustements accessibles à la demande.
- Mode Normal, mode Actif à distance sur PC, interface téléphone compacte, pause commune et minuteurs individuels. Sons et voix facultatifs. Les séries ne sont jamais validées automatiquement par le chrono.
- Démarrer alors qu’une séance est inachevée ouvre un choix explicite : reprendre, terminer puis commencer, annuler. Les anciennes séances actives restent accessibles.
- 81 mouvements illustrés (50 renforcement, 31 préparation) ; 24 routines d’échauffement dosées de 3/5/8/10 min et 7 routines de mobilisation/étirement. Les formats courts et assis précisent leurs limites.
- Bibliothèque avec recherche et filtres repliables. Fiches Geste/Muscles, installation et étapes visibles ; compléments, notes et sources en accordéons, impression complète.
- Bilan musculaire par personne, rôles principaux/assistance/stabilisation, historique, progression, commentaires corporels sur schéma face/dos.
- Repères techniques sourcés, sans diagnostic ni augmentation automatique des charges sur un signal de douleur.
- Sauvegarde locale IndexedDB, export/import validés, fusion, migration des anciens carnets sans perte de séries ni de commentaires.
- Bouton Installer Renfo, invite native lorsque disponible, aide iPhone/Android, icône d’accueil, cache hors ligne, conservation des images inchangées lors des mises à jour.

## Utiliser l’application

**En ligne sur GitHub Pages : [Ouvrir Renfo](https://madec01.github.io/renfo/).**

L’adresse d’accueil ouvre automatiquement l’application dans `dist/`. GitHub Pages publie la branche `main` depuis sa racine ; `.nojekyll` conserve les fichiers statiques tels quels. Les modifications poussées sur cette branche sont publiées automatiquement.

Le stockage du navigateur dépend de l’adresse utilisée. Pour récupérer un carnet commencé sur un autre hébergement, exporter la sauvegarde depuis cet hébergement, puis l’importer dans les réglages de la version GitHub Pages.

Servir le dossier `dist/` avec un serveur statique. Par exemple :

```sh
python3 -m http.server 8000 --directory dist
```

Ouvrir ensuite `http://localhost:8000`. Le bouton « Installer Renfo » sur l’accueil ou dans Réglages guide l’ajout à l’écran d’accueil. Sur iPhone, exporter un carnet déjà utilisé dans Safari puis l’importer dans l’app installée : le stockage peut être séparé. Dans les réglages, « Préparer les images hors ligne » télécharge toutes les illustrations pour les consulter sans connexion.

L’ouverture directe de `dist/index.html` est possible dans les navigateurs qui autorisent le stockage local pour les fichiers ; le service worker et l’installation ne fonctionnent qu’en HTTP local/HTTPS. Pour un usage durable, privilégier un hébergement HTTPS.

## Développer

Pas de dépendance npm nécessaire pour exécuter l’application ou lancer les tests.

```sh
npm test
npm run build
```

`scripts/build.py` assemble les catalogues et les routines, vérifie les références et versionne le cache. Les assets WebP prêts à servir sont déjà dans le dépôt. L’outil optionnel `scripts/optimize-images.cjs` utilise Sharp pour convertir de futurs PNG de gestes en WebP, sans recadrage.

## Structure

- `dist/index.html`, `dist/css/app.css`, `dist/css/v3.css`, `dist/css/library-v3.css` : interface et affichage progressif.
- `dist/js/core.js` : schéma 3, entraînements communs (`workouts`), participations individuelles (`sessions`), étapes stables, horodatages, agrégations et validation d’import.
- `dist/js/install.js` : détection autonome et invite d’installation.
- `dist/js/storage.js` : file d’écriture IndexedDB, repli sur le stockage navigateur.
- `dist/js/body.js` : carte corporelle SVG et zones.
- `dist/js/app.js` : navigation, formulaires et interactions.
- `dist/js/data.js` : catalogue assemblé ; généré par le build.
- `content/` : 81 fiches, références, routines et règles de conseil.
- `dist/assets/exercises/` : 81 illustrations WebP ; aucun fichier utilisateur.
- `tests/core.test.cjs` : vérifications des calculs, instantanés, pauses, circuits et sauvegardes.

## Conventions et limites

La masse par haltère est distincte de la charge totale. Les séries sont séparées quand le comptage est par côté. Un échauffement alterné à durée totale utilise un seul chrono ; certaines mobilisations se comptent en paires gauche + droite. Les étirements et mobilisations n’alimentent pas le volume de renforcement. Les couleurs de la carte sont des rôles qualitatifs, et non des pourcentages d’activation ou une mesure de récupération.

Les profils sont des carnets locaux, sans authentification individuelle ni cloisonnement par mot de passe. Une sauvegarde contient toutes les personnes. La migration du schéma 1 attribue les données existantes à Martin, sans effacer les séries ni les minuteurs. La migration vers le schéma 3 conserve chaque ancienne séance dans un entraînement solo distinct. Les nouvelles séances partagent des identifiants d’étapes, avec paramètres personnels ; elles ne sont pas liées au profil consulté dans le suivi.

Les commentaires restent privés dans le navigateur. Ils ne sont pas transmis aux sources citées, à GitHub ou à un service d’IA. Il n’y a pas de synchronisation automatique entre appareils dans cette version : utiliser export/import pour transférer le carnet. Changer de navigateur ou d’adresse d’hébergement change le stockage utilisé.

Les conseils sont des repères généraux sourcés, avec des limites explicites. Le module n’identifie pas la cause d’une douleur et ne remplace pas une évaluation professionnelle. Les 81 fiches associent une illustration du geste aux consignes détaillées et à une carte corporelle simplifiée ; la nuque est représentée comme une région de mobilisation.

Les navigateurs peuvent suspendre les minuteurs sonores en arrière-plan. Le temps affiché est reconstruit à partir d’horodatages au retour. Les données locales peuvent être supprimées par le navigateur ou l’utilisateur : conserver des exports réguliers.

## Mise à jour de la PWA

Dans Réglages, utiliser « Vérifier les mises à jour », puis fermer tous les onglets et fenêtres Renfo avant de rouvrir. La séance et les profils restent en IndexedDB. Le cache ne change pas pendant une séance ouverte. Les illustrations inchangées déjà téléchargées sont conservées après une mise à jour. Les nouvelles peuvent être préparées hors ligne depuis les réglages.
