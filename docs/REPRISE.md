# Cahier de reprise — 18 octobre 2026, webapp installable et icône lapin

## Version et publication vérifiées

- Dépôt : https://github.com/throlan/Lapinou-Dish ; branche de référence : `origin/main`.
- Version du code : **0.2.90** : webapp installable (manifeste, icônes et guide) sur la refonte visuelle claire Magazine culinaire · Encre framboise, responsive PC/tablette/mobile, sans changement métier. La 0.2.88 conserve la saisie des achats et du stock compté dans l’unité d’achat (œufs, pots, paquets…), conversion unique vers l’unité de stock. Regroupements et exclusions de la 0.2.87 conservés. Le calcul 0.2.86 reste fondé sur la **base fonctionnelle validée 0.2.83**, sans les calculs abandonnés 0.2.84/85.
- Dernière publication applicative vérifiée avant ce chantier : **0.2.89**, PR #119, commit ec2e342, [contrôles et GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/39125274115). Priorités documentaires fusionnées par la PR #120. Pour 0.2.90, vérifier le workflow du dernier commit de main.
- Validation 0.2.90 : **294 tests locaux réussis**. Chrome local : manifeste sans erreur et aucun motif de non-installabilité ; bouton natif proposé dans le profil jetable. Pas de service worker ni de nouvelle couche de cache hors ligne. Parcours des sept pages dans Chrome local sur base fictive PGlite, largeurs 1440, 1280, 900, 390 et 320 px ; fiches repas/aliment/cuisine et éditeur de recette, navigation mobile et absence de débordement horizontal vérifiés. Impression existante conservée ; tests par émulation de viewport, pas sur appareils physiques.
- Références : [état](STATUS.md), [prochaines tâches](TODO.md), [produit](PRODUCT.md), [améliorations](AMELIORATIONS.md), [journal du 18 octobre](SESSION-2026-10-18.md).

## Interdiction d'accès à l'installation

**Ne jamais accéder à Unraid ni à Nginx, même pour lire, vérifier ou diagnostiquer. L'utilisateur effectue seul le déploiement.** Le périmètre de l'agent couvre le dépôt local, les tests sur données fictives, GitHub et la vérification des publications GHCR.

## Reprendre sur un autre PC

1. Retrouver le dépôt par son remote GitHub ; le chemin local dépend du PC. Ne pas confondre avec les anciens dossiers Norish ni supposer que le chemin de la session précédente existe encore.
2. Lire les éventuels `AGENTS.md`. Examiner l'état Git, la branche, les derniers commits et **tous les stashes**. Préserver les modifications, branches et stashes existants ; aucune réapplication automatique d'un ancien chantier.
3. Récupérer `origin/main` sans écrasement. Sur un main propre, avancer seulement en fast-forward ; sinon inspecter et isoler le travail avant de changer de base. Aucun reset destructif ni nettoyage forcé.
4. Vérifier GitHub, `package.json` et les documents liés ci-dessus. Les journaux antérieurs au 18 octobre sont historiques ; le dernier journal est `SESSION-2026-10-18.md`.
5. Faire un état bref et proposer les prochaines étapes ; **attendre la demande de l'utilisateur avant une nouvelle modification fonctionnelle**.

## Dernières fonctions à ne pas refaire

- PR #92 : duplication d'aliment et diagnostic du stockage des images. Photos personnelles et génération IA existent déjà, avec dossier configurable `RECIPE_IMAGE_DIR` et repli PostgreSQL. Le diagnostic décrit le stockage utilisé par l'application ; l'agent ne vérifie pas l'hôte.
- PR #93 à #95 : recettes liées aux produits des courses, une par ligne, liens ouvrant la recette mère des parties de service.
- PR #96 : filtres de données manquantes, dont nutrition incomplète dans les recettes planifiées depuis le début du mois courant et au-delà, badge des préparations et retour interne.
- PR #97 / 0.2.70 : kcal dans les listes de choix des recettes du calendrier, par pièce/portion ou pour 100 g/ml ; données partielles signalées.
- PR #98 / 0.2.71 : volet fermé « Dans X recettes » sur chaque aliment, liens séparés, zéro explicite et comptage des recettes mères distinctes.
- PR #99 / 0.2.72 : **Salade** et **Sauce**. Le nom demandé est Sauce, pas Vinaigrette. Salades utilisables comme plat ou accompagnement, avec les mêmes services, calculs, courses et stocks. « + Sauce » : 30 g/ml ou une unité par défaut, quantité modifiable par personne, zéro possible, apports inclus et quantité fixe pendant les ajustements automatiques.
- PR #101 / 0.2.73 : plafonnement des suggestions de salade à une portion, couleurs des créneaux et repère kcal comparé sur la semaine.
- PR #102 : apports protéiques quotidiens visibles sous le résumé de chaque jour.
- PR #103 / 0.2.75 : minima protéiques configurables par personne dans Administration.
- PR #104 : calendrier hebdomadaire imprimable en A4 paysage ; seuls les menus et quantités par personne sont imprimés.
- PR #105 / 0.2.76 : version et clés de cache alignées. Tests locaux (219) et publication GHCR réussis.
- PR #107 / 0.2.77 : réglage `RECIPE_IMAGE_DIR=/images` visible dans le template ; sans variable, repli PostgreSQL. Contrôles et publication réussis. L’utilisateur vérifie seul son installation.
- 0.2.78 puis **0.2.79** : Cuisiner utilise les besoins des menus. Depuis la 0.2.79, les services viande-légumes/féculents et viande/légumes/féculents sont calculés indépendamment. Les portions/pièces originales ne sont pas arrondies vers un lot plus grand. Une partie absente ou couverte reste à zéro. Ouverture depuis la recette : rechargement des besoins de la période des courses, aucune proposition de recette complète en repli. Les quantités restent modifiables explicitement.
- **0.2.80** : Hors menus — quantité libre dans la fiche cuisine. Pour une base de 4 portions, 6 portions multiplient tous les ingrédients par 1,5 ; le poids estimé reste un repère. Pour les services séparés, ce mode libre conserve les proportions de la recette source, tandis que Selon les menus garde les quantités indépendantes. Les valeurs sont conservées lors des changements de mode. Une recette hors planning ouvre le mode libre explicitement ; si les besoins des menus sont indisponibles, seule la préparation libre est accessible.
- **0.2.81** : suppression des recettes inutilisées depuis les vignettes et l’éditeur ; indisponible pour une nouvelle recette/copie non enregistrée. Les menus et historiques de production (y compris annulés) protègent la recette et ses parties. Photos en base supprimées avec la recette ; fichiers nettoyés seulement après commit, échec de nettoyage signalé sans prétendre que la suppression en base a échoué.
- **0.2.82** : « + Préparation maison » dans les ingrédients. Rendement natif « tranches » et équivalences par recette de base (ex. 1 pain = 20 tranches). Ne pas inventer un poids de tranche. Les besoins imbriqués sont additionnés avec les menus directs ; seul le manque après stock remonte aux courses et aux fabrications. Une préparation suivie en stock est fabriquée avant l’assemblage du plat ; les sauces non suivies sont faites avec le plat depuis leurs ingrédients. Mouvements de préparations réversibles, sans seconde déduction des matières premières. Cycles et références hors foyer refusés ; les références protègent aussi la suppression. Migration 20261018_recipe_ingredients.sql.
- **0.2.83** : le schéma et le validateur de l’import IA acceptent un rendement en tranches (slice), avec instruction explicite de ne pas le convertir en pains/personnes ni inventer son poids. L’import texte conserve également les tranches. Fiche prête à copier : docs/recettes/pain-de-mie-graines-francine-t110.txt, 20 tranches et huit ingrédients avec quantités fixes. Aucun calcul nutritionnel inventé ; association au catalogue à vérifier dans le brouillon.
- **0.2.86** : moteur de portions et rééquilibrage quotidien restaurés depuis 0.2.83. Le bouton Recalculer applique ensuite un arrondi au plus proche en pièces/tranches selon les équivalences, puis ajuste la partie en grammes pour préserver les kcal proposées. La saisie manuelle compense le delta depuis les quantités précédentes pour la même personne. Aucun forçage des proportions après arrondi, aucun calcul à partir du seul poids des unités, aucun grand bloc d’écarts 0.2.85. Les grammes canoniques alimentent menus/courses/productions. Les anciennes quantités ne sont pas modifiées à l’ouverture.
- **0.2.87** : dans Détails et réglages → Acheter sous… et exclusions, choisir un aliment cible et une équivalence explicite. Le stock, magasin et format du produit cible sont utilisés ; les recettes/nutrition restent distinctes. Addition des besoins avant arrondi, sans doublage du stock. Les exclusions sont permanentes ou propres aux dates exactes de la liste et restent réactivables dans le panneau Regroupements et exclusions, même si la liste est vide. Migration 20261018_shopping_products.sql. Aucun regroupement/exclusion créé automatiquement, notamment pour les blancs d’œufs.
- **0.2.88** : un achat affiché à 26 œufs se saisit comme 26, et non 1300 g. Le comptage existant se fait aussi en œufs, avec équivalence et stock affichés (8 œufs pour 400 g à 50 g/œuf). Même principe pour les règles explicites de pots/unités et les paquets configurés ; le format de paquet reste prioritaire. Les paquets partiellement consommés peuvent être comptés en fractions. Conversion unique lors de l’envoi aux API existantes ; aucun changement du schéma de stock.
- **0.2.89** : charte claire Magazine culinaire · Encre framboise validée par l’utilisateur. Navigation latérale PC, barre haute tablette et navigation basse mobile avec menu Plus. Photos des recettes valorisées, formulaires adaptés et contrastes revus. Tous les champs, réglages et calculs restent conservés ; aucune migration. La feuille originale et son impression A4 restent intactes. La PWA installable est livrée en 0.2.90 ; hors ligne reste distinct.
- **0.2.90** : manifeste stable, ouverture standalone, icônes lapin/cocotte dérivées du logo fourni, bouton Installer l’app (menu Plus sur mobile), invitation native quand disponible et guide iOS/Android/PC. Pas de service worker/cache hors ligne ; API/session et calculs inchangés. Recharger ou rouvrir pour les mises à jour après avoir terminé les saisies. Installation OS physique non effectuée par l’agent.
- La page Importer dédiée, les vignettes de recettes avec photos, les filtres latéraux et les photos persistantes sont déjà en place.

## Règles métier à préserver

- Catalogue canonique et conversions documentées : inconnu ne signifie jamais zéro. Les besoins kcal des profils sont saisis et datés, sans calcul automatique depuis poids/taille/activité.
- Cinq créneaux ; répartition modifiable par foyer, défaut **15/40/10/25/10 %**. Prévisions au calendrier, aucune saisie de consommation après repas.
- Rendement original, préparation entière en grammes estimés, deux ou trois parties ; aucune pesée obligatoire après cuisson. Proportions en poids indépendantes de la répartition kcal.
- Suggestions plafonnées et modifiables, petit-déjeuner limité automatiquement à deux pièces selon le rendement. Réouverture et duplication préservent les quantités ; recalcul explicite.
- Boissons individuelles fixes, quantité initiale 1 au choix, zéro possible ; desserts communs autorisés au petit-déjeuner et aux deux collations. « + Dessert » ouvre le choix individuel dans les repas.
- Rééquilibrage adulte avec aperçu puis application explicite ; mineurs exclus, aperçu périmé refusé. Boissons, desserts individuels et sauces conservés.
- Réserve kcal adulte livrée en 0.2.42 : fenêtre glissante de 30 jours, écarts calculés depuis les menus planifiés, épargne supplémentaire sans double crédit, occasions avec estimation globale hors quotas ordinaires. Le [brouillon de réserve](drafts/ENERGY-RESERVE.md) est une archive, pas une tâche à réappliquer.
- Planifier réserve les stocks sans les consommer physiquement. Productions et repas marqués « Préparé » produisent les mouvements explicites, sans double déduction des ingrédients d'un batch.
- Préparations regroupées par recette mère : Pâtisserie, Pain, Pâtes et Batch cooking par semaine lundi–dimanche. Lien recette et fiche Cuisiner avec rendement ajustable.
- Pas de données personnelles réelles, secrets ou clés API dans Git ni dans les fixtures.

## Vérifier et livrer

Node.js **24+**, dépendances installées depuis `package.json`. Tests :

```powershell
node --experimental-strip-types --test test/*.test.ts test/*.test.mjs
```

`npm test` exécute cette commande. Les tests PGlite appliquent les migrations SQL réelles sur une base jetable. Tester l'interface localement avec des données fictives si elle change.

Après une modification autorisée : branche, tests adaptés, commit/push, PR, contrôles GitHub, fusion puis vérification de publication de l'image. Aucun déploiement sur l'installation. Un échec réseau du shell ne prouve pas une déconnexion du compte GitHub : distinguer réseau local, connexion et état réel des workflows.

## Prompt à copier pour demain

```text
Reprends le développement de Lapinou Dish. Retrouve le dépôt local par son remote https://github.com/throlan/Lapinou-Dish, vérifie son état et préserve toute modification locale, branche et stash avant de récupérer origin/main sans écrasement. Lis AGENTS.md s'il existe, puis docs/REPRISE.md, docs/STATUS.md, docs/PRODUCT.md, docs/AMELIORATIONS.md, docs/TODO.md et le dernier journal dans docs/ (actuellement docs/SESSION-2026-10-18.md).

La version du code est 0.2.90 : webapp installable avec icônes et guide déjà livrée ; refonte visuelle claire Magazine culinaire · Encre framboise, responsive PC/tablette/mobile, sans changement des calculs ni des fonctionnalités. La 0.2.88 a livré la saisie des achats et du stock compté dans les unités d’achat configurées (ex. nombre d’œufs), avec conversion unique en stock. Produits communs et exclusions 0.2.87 déjà livrés. La version 0.2.86 a restauré le calcul de la 0.2.83, dernière référence fonctionnelle validée par l’utilisateur. Les algorithmes 0.2.84/85 sont abandonnés. Après le calcul initial, œufs/tranches sont arrondis au plus proche et la soupe compense l’écart calorique ; même compensation après saisie manuelle. Vérifie main, package.json et les contrôles/publication GitHub/GHCR correspondants. Ne réintroduis pas les calculs rejetés et ne refais pas les fonctions livrées.

Le nettoyage du catalogue alimentaire est en dernière priorité, après consolidation du cahier de recettes. L’ordre décidé est : 1. webapp installable (livrée en 0.2.90), 2. comptes individuels et foyers, 3. correction des données nutritionnelles, 4. communauté publique, 5. nettoyage du catalogue. Le hors-ligne reste distinct. Fais-moi d'abord un état bref de la version, de la publication et des tâches réellement restantes. Attends ma demande avant toute nouvelle modification fonctionnelle.

Règle absolue : n'accède jamais à Unraid ni à Nginx, même pour vérifier ; je gère le déploiement. Les vérifications locales dans un navigateur sur données fictives sont autorisées. Pour les prochains travaux autorisés : tests locaux, commit/push, PR, fusion après réussite des contrôles et vérification de publication GitHub/GHCR.
```
