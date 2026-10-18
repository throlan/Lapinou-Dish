# Cahier de reprise — 18 octobre 2026, préparations utilisées dans les recettes

## Version et publication vérifiées

- Dépôt : https://github.com/throlan/Lapinou-Dish ; branche de référence : `origin/main`.
- Version de référence du code : **0.2.83**. Correction de l’import IA et texte pour les rendements en tranches. Les préparations maison composant d’autres recettes sont déjà livrées en 0.2.82.
- Dernière livraison antérieure vérifiée : **0.2.82**, PR #112 fusionnée au commit 6fd6a35baf59a46f17d2c4b62fdbd77ad090cdc6, [contrôles et publication GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/39105216269). Pour la 0.2.83, consulter le workflow du dernier commit de main lors de la reprise.
- Validation locale 0.2.83 : **256 tests réussis** ; tests PostgreSQL/PGlite des migrations, bagels à la pièce, pain à la tranche, stock en grammes, services indépendants, annulations et rollback. Interface testée via les fonctions réelles avec DOM synthétique ; aucun nouveau parcours visuel navigateur confirmé.
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

La version de référence du code est 0.2.83 : import IA et texte des rendements en tranches, fiche pain de mie Francine/T110 prête à copier. La version 0.2.82 (PR #112, commit 6fd6a35) est fusionnée et publiée ; les préparations imbriquées sont déjà livrées. Vérifie la tête de main, package.json et les contrôles/publication GitHub/GHCR correspondants. Ne réimplémente pas les fonctions déjà livrées.

Prochaine piste proposée dans TODO.md : filtre des aliments inutilisés, puis étude d’une fusion guidée des doublons avec préservation de toutes les références et de leurs réglages. Fais-moi d'abord un état bref de la version, de la publication et des tâches réellement restantes. Attends ma demande avant toute nouvelle modification fonctionnelle.

Règle absolue : n'accède jamais à Unraid ni à Nginx, même pour vérifier ; je gère le déploiement. Les vérifications locales dans un navigateur sur données fictives sont autorisées. Pour les prochains travaux autorisés : tests locaux, commit/push, PR, fusion après réussite des contrôles et vérification de publication GitHub/GHCR.
```
