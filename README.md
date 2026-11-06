# Renfo

Application personnelle de renforcement, en français, utilisable sur téléphone et ordinateur. Le site fonctionne sans compte applicatif et sans serveur de données : le carnet est enregistré dans IndexedDB sur l’appareil.

## Fonctionnalités

- Modèles de séances modifiables : ordre, blocs, séries, répétitions, durée, charge, repos, circuits et superséries.
- Séance libre ou guidée, pause, reprise après rechargement, chronomètres, historique corrigible, annulation d’une validation.
- 50 exercices de renforcement illustrés, 26 fiches de préparation, 10 propositions d’échauffement et 7 routines de mobilisation/étirements.
- Geste et carte musculaire côte à côte ; fiche détaillée, zoom, sources et impression/PDF.
- Principaux, assistants et stabilisateurs séparés ; bilan calculé sur les séries réellement validées.
- Commentaires corporels sur un schéma face/dos, zones ou points, côté, temporalité, série et charge liées, suivi « mieux / pareil / pire ».
- Repères techniques sourcés, distincts d’un diagnostic ; aucune augmentation automatique de charge à partir d’une douleur ou d’un ressenti.
- Favoris, notes épinglées, exercices personnels, inventaire du matériel, progression par exercice.
- Export/import JSON avec validation, fusion des éléments nouveaux ou remplacement explicite précédé d’un export de secours.
- PWA : icônes, manifeste, cache hors ligne et mise à jour sans remplacer la version pendant une séance ouverte.

## Utiliser l’application

Servir le dossier `dist/` avec un serveur statique. Par exemple :

```sh
python3 -m http.server 8000 --directory dist
```

Ouvrir ensuite `http://localhost:8000`. Le site hébergé en HTTPS peut être ajouté à l’écran d’accueil. Dans les réglages, « Préparer les images hors ligne » télécharge toutes les illustrations pour les consulter sans connexion.

L’ouverture directe de `dist/index.html` est possible dans les navigateurs qui autorisent le stockage local pour les fichiers ; le service worker et l’installation ne fonctionnent qu’en HTTP local/HTTPS. Pour un usage durable, privilégier un hébergement HTTPS.

## Développer

Pas de dépendance npm nécessaire pour exécuter l’application ou lancer les tests.

```sh
npm test
npm run build
```

`scripts/build.py` assemble les catalogues et les routines, vérifie les références et versionne le cache. Les assets WebP prêts à servir sont déjà dans le dépôt. L’outil optionnel `scripts/optimize-images.cjs` utilise Sharp pour convertir de futurs PNG de gestes en WebP, sans recadrage.

## Structure

- `dist/index.html`, `dist/css/app.css` : interface responsive.
- `dist/js/core.js` : séances, séries, horodatages, agrégations et validation d’import.
- `dist/js/storage.js` : file d’écriture IndexedDB, repli sur le stockage navigateur.
- `dist/js/body.js` : carte corporelle SVG et zones.
- `dist/js/app.js` : navigation, formulaires et interactions.
- `dist/js/data.js` : catalogue assemblé ; généré par le build.
- `content/` : 76 fiches, références, routines et règles de conseil.
- `dist/assets/exercises/` : 50 illustrations WebP ; aucun fichier utilisateur.
- `tests/core.test.cjs` : vérifications des calculs, instantanés, pauses, circuits et sauvegardes.

## Conventions et limites

La masse par haltère est distincte de la charge totale. Les séries gauche et droite sont enregistrées séparément. Les étirements et mobilisations n’alimentent pas le volume de renforcement. Les couleurs de la carte sont des rôles qualitatifs, et non des pourcentages d’activation ou une mesure de récupération.

Les commentaires restent privés dans le navigateur. Ils ne sont pas transmis aux sources citées, à GitHub ou à un service d’IA. Il n’y a pas de synchronisation automatique entre appareils dans cette version : utiliser export/import pour transférer le carnet. Changer de navigateur ou d’adresse d’hébergement change le stockage utilisé.

Les conseils sont des repères généraux sourcés, avec des limites explicites. Le module n’identifie pas la cause d’une douleur et ne remplace pas une évaluation professionnelle. Les 26 fiches de préparation utilisent des consignes textuelles et des cartes de zones ; les 50 illustrations de gestes concernent le renforcement.

Les navigateurs peuvent suspendre les minuteurs sonores en arrière-plan. Le temps affiché est reconstruit à partir d’horodatages au retour. Les données locales peuvent être supprimées par le navigateur ou l’utilisateur : conserver des exports réguliers.
