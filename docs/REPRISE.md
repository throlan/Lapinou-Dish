# Cahier de reprise — 16 octobre 2026, fin de session

## Version et publication vérifiées

- Dépôt : https://github.com/throlan/Lapinou-Dish ; branche de référence : `origin/main`.
- Application **0.2.72**, livrée par la **PR #99**, commit `191fca91b6e3bd35a9c4ed20d79bea0c0946a1c8`.
- [Workflow de cette livraison](https://github.com/throlan/Lapinou-Dish/actions/runs/38965953820) : tests et publication GHCR réussis, vérifiés le 16 octobre. Ce n'est plus une publication en attente.
- Validation fonctionnelle : **213 tests locaux réussis**, parcours Chrome sur PostgreSQL fictif réussi. Les scripts temporaires de ce parcours ne sont pas nécessaires à la reprise et ne sont pas livrés dans le dépôt.
- Cette mise à jour documentaire ne change pas la version applicative. Vérifier la tête actuelle de GitHub : elle peut être plus récente que le dernier commit fonctionnel ci-dessus.
- Références : [état](STATUS.md), [prochaines tâches](TODO.md), [produit](PRODUCT.md), [améliorations](AMELIORATIONS.md), [journal du 16 octobre](SESSION-2026-10-16.md).

## Interdiction d'accès à l'installation

**Ne jamais accéder à Unraid ni à Nginx, même pour lire, vérifier ou diagnostiquer. L'utilisateur effectue seul le déploiement.** Le périmètre de l'agent couvre le dépôt local, les tests sur données fictives, GitHub et la vérification des publications GHCR.

## Reprendre sur un autre PC

1. Retrouver le dépôt par son remote GitHub ; le chemin local dépend du PC. Ne pas confondre avec les anciens dossiers Norish. Le checkout de cette session est `C:\Users\laure\Documents\Codex\Lapinou-Dish-main-2026-10-16`.
2. Lire les éventuels `AGENTS.md`. Examiner l'état Git, la branche, les derniers commits et **tous les stashes**. Préserver les modifications, branches et stashes existants ; aucune réapplication automatique d'un ancien chantier.
3. Récupérer `origin/main` sans écrasement. Sur un main propre, avancer seulement en fast-forward ; sinon inspecter et isoler le travail avant de changer de base. Aucun reset destructif ni nettoyage forcé.
4. Vérifier GitHub, `package.json` et les documents liés ci-dessus. Les journaux des 13, 14 et 15 octobre sont historiques ; le dernier journal est celui du 16.
5. Faire un état bref et proposer les prochaines étapes ; **attendre la demande de l'utilisateur avant une nouvelle modification fonctionnelle**.

## Dernières fonctions à ne pas refaire

- PR #92 : duplication d'aliment et diagnostic du stockage des images. Photos personnelles et génération IA existent déjà, avec dossier configurable `RECIPE_IMAGE_DIR` et repli PostgreSQL. Le diagnostic décrit le stockage utilisé par l'application ; l'agent ne vérifie pas l'hôte.
- PR #93 à #95 : recettes liées aux produits des courses, une par ligne, liens ouvrant la recette mère des parties de service.
- PR #96 : filtres de données manquantes, dont nutrition incomplète dans les recettes planifiées depuis le début du mois courant et au-delà, badge des préparations et retour interne.
- PR #97 / 0.2.70 : kcal dans les listes de choix des recettes du calendrier, par pièce/portion ou pour 100 g/ml ; données partielles signalées.
- PR #98 / 0.2.71 : volet fermé « Dans X recettes » sur chaque aliment, liens séparés, zéro explicite et comptage des recettes mères distinctes.
- PR #99 / 0.2.72 : **Salade** et **Sauce**. Le nom demandé est Sauce, pas Vinaigrette. Salades utilisables comme plat ou accompagnement, avec les mêmes services, calculs, courses et stocks. « + Sauce » : 30 g/ml ou une unité par défaut, quantité modifiable par personne, zéro possible, apports inclus et quantité fixe pendant les ajustements automatiques.
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
Reprends le développement de Lapinou Dish. Retrouve le dépôt local par son remote https://github.com/throlan/Lapinou-Dish, vérifie son état et préserve toute modification locale, branche et stash avant de récupérer origin/main sans écrasement. Lis AGENTS.md s'il existe, puis docs/REPRISE.md, docs/STATUS.md, docs/PRODUCT.md, docs/AMELIORATIONS.md, docs/TODO.md et le dernier journal dans docs/ (actuellement docs/SESSION-2026-10-16.md).

La dernière version fonctionnelle connue est 0.2.72, PR #99, commit 191fca91b6e3bd35a9c4ed20d79bea0c0946a1c8. Ses tests et sa publication GHCR ont réussi. Une mise à jour documentaire de fin de session suit sur main : récupère aussi celle-ci et vérifie l'état GitHub actuel ainsi que package.json. Ne réimplémente pas les fonctions déjà livrées recensées dans REPRISE.md.

Fais-moi d'abord un état bref de la version, de la publication et des tâches réellement restantes. Propose la suite, puis attends ma demande avant une nouvelle modification fonctionnelle.

Règle absolue : n'accède jamais à Unraid ni à Nginx, même pour vérifier ; je gère le déploiement. Les vérifications locales dans un navigateur sur données fictives sont autorisées. Pour les prochains travaux autorisés : tests locaux, commit/push, PR, fusion après réussite des contrôles et vérification de publication GitHub/GHCR.
```
