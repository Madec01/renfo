# Renfo

Application personnelle de renforcement, en français, utilisable sur téléphone et ordinateur. Le site fonctionne sans compte applicatif et sans serveur de données : le carnet est enregistré dans IndexedDB sur l’appareil.

## Fonctionnalités

- Profils Martin, Séverine et ajout libre de personnes ; historique, notes, favoris, matériel, réglages et séances en cours indépendants.
- Une base commune par séance et des versions personnelles : poids et séries différents, possibilité d’ajouter/retirer/changer les mouvements. Copier une version dans son brouillon ne modifie pas les autres personnes.
- Éditeur organisé en quatre blocs facultatifs : échauffement, renforcement, mobilisation, étirements. Ordre des blocs et mouvements modifiables, routines insérables par famille.
- Mode Normal pour préparer et ajuster ; mode Actif pour suivre à distance, avec illustration, repères, grands compteurs, charge et côté, repos contrasté, plein écran, sons et voix facultatifs.
- Commandes tactiles de 44 px ou plus, séries sous forme de cartes sur mobile ; clavier en mode Actif : espace pour l’action principale, P pour pause/reprise (hors champs de saisie).

- Modèles de séances modifiables : ordre, blocs, séries, répétitions, durée, charge, repos, circuits et superséries.
- Séance libre ou guidée, pause, reprise après rechargement, chronomètres, historique corrigible, annulation d’une validation.
- 76 mouvements illustrés : 50 exercices de renforcement et 26 échauffements, mobilisations et étirements, 10 propositions d’échauffement et 7 routines de mobilisation/étirements.
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
- `dist/assets/exercises/` : 76 illustrations WebP ; aucun fichier utilisateur.
- `tests/core.test.cjs` : vérifications des calculs, instantanés, pauses, circuits et sauvegardes.

## Conventions et limites

La masse par haltère est distincte de la charge totale. Les séries sont séparées quand le comptage est par côté. Un échauffement alterné à durée totale utilise un seul chrono ; certaines mobilisations se comptent en paires gauche + droite. Les étirements et mobilisations n’alimentent pas le volume de renforcement. Les couleurs de la carte sont des rôles qualitatifs, et non des pourcentages d’activation ou une mesure de récupération.

Les profils sont des carnets locaux, sans authentification individuelle ni cloisonnement par mot de passe. Une sauvegarde contient toutes les personnes. La migration du schéma 1 attribue les données existantes à Martin, sans effacer les séries ni les minuteurs. Les versions personnelles sont des copies indépendantes de la base commune ; les modifications ultérieures de la base ne les remplacent pas.

Les commentaires restent privés dans le navigateur. Ils ne sont pas transmis aux sources citées, à GitHub ou à un service d’IA. Il n’y a pas de synchronisation automatique entre appareils dans cette version : utiliser export/import pour transférer le carnet. Changer de navigateur ou d’adresse d’hébergement change le stockage utilisé.

Les conseils sont des repères généraux sourcés, avec des limites explicites. Le module n’identifie pas la cause d’une douleur et ne remplace pas une évaluation professionnelle. Les 76 fiches associent une illustration du geste aux consignes détaillées et à une carte corporelle simplifiée ; la nuque est représentée comme une région de mobilisation.

Les navigateurs peuvent suspendre les minuteurs sonores en arrière-plan. Le temps affiché est reconstruit à partir d’horodatages au retour. Les données locales peuvent être supprimées par le navigateur ou l’utilisateur : conserver des exports réguliers.

## Mise à jour de la PWA

Dans Réglages, utiliser « Vérifier les mises à jour », puis fermer tous les onglets et fenêtres Renfo avant de rouvrir. La séance et les profils restent en IndexedDB. Le cache ne change pas pendant une séance ouverte. Les images supplémentaires peuvent être préparées hors ligne depuis les réglages.
