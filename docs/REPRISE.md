# Cahier de reprise — 23 octobre 2026, unités d’achat et équivalences en courses

## Dernière modification en préparation — 0.2.96

Dans le catalogue **Aliments**, la fiche modifiable permet de régler l’unité d’achat habituelle du foyer (libellé singulier/pluriel, quantité et unité par sachet/paquet, note). Exemple : l’aliment reste en cuillères à café dans les recettes ; renseigner 2 g par cuillère et un sachet de 500 g affiche les sachets nécessaires dans les courses. Les équivalences entre aliments cuits et secs restent des regroupements explicites dans les préférences d’achat : ex. pois chiches cuits égouttés → pois chiches secs, coefficient 0,8. Les recettes, leur nutrition et leurs ingrédients restent inchangés. Catalogue dédié Aliments, édition complète et suppression protégée déjà disponibles ; aucun remplacement de cette page n’est à refaire. Version `package.json` : 0.2.96. **306 tests locaux réussis**, dont conversions cuillères/sachets et pois chiches cuits/secs. Branche de travail basée sur origin/main au commit 75761384252b13d7a5e25e20496b07d9c85506d3 (PR #128). PR et publication GHCR de la 0.2.96 à vérifier après livraison.

## Renommer depuis le répertoire — 0.2.94

Bouton Renommer à côté du titre en grille et liste. Champ local avec Enregistrer le titre et Annuler, Entrée pour valider et Échap pour annuler ; titre obligatoire, espaces retirés aux extrémités et 200 caractères maximum. Les erreurs gardent la saisie, le conflit de version demande une actualisation. Aucun passage par l’éditeur complet.

PATCH limité au nom, sous verrou du foyer et contrôle de version. Les parties dérivées reprennent le titre de leur recette mère avec leur libellé de service, sans changer leurs identifiants, ingrédients, rendements, coefficients, nutrition ou historiques. Un renommage seul est permis pour un repas préparé ; les protections des modifications métier restent en place. Pas de migration.

Validation : **303 tests locaux réussis**, renommage PATCH réel PostgreSQL/PGlite avec repas préparé, parties dérivées, invariants nutritionnels, titre invalide, conflit de version et autre foyer. Chrome local sur données fictives aux cinq formats PC/tablette/mobile : renommage sur la fiche, annulation, clavier, grille/liste et aucune erreur inattendue ni débordement horizontal. Aucun appareil physique ni accès à Unraid/Nginx.


## Coefficients de cuisson par ingrédient — 0.2.93

Suppression des champs globaux Coefficient du plat et Coefficient féculents de l’éditeur et des Réglages rapides. Chaque aliment a son propre coefficient dans les ingrédients de l’éditeur et dans Affectation des ingrédients et cuisson des fiches. Ajout de Semoule — ×2 aux choix partagés, poids inchangé ×1 et autres choix conservés. Plusieurs féculents d’une même recette peuvent utiliser des valeurs différentes. Les préparations maison restent déjà préparées à ×1. Les champs de cuisson sont affichés pour tous les aliments et modes de service, pas seulement les féculents. Le contraste des blocs d’ingrédients est aligné sur la charte claire.

Compatibilité : aucune migration ni réécriture automatique. Une ancienne valeur héritée est résolue selon la priorité existante et affichée sur chaque ligne, même hors des valeurs prédéfinies. À l’enregistrement, elle devient explicite ; les nouveaux formulaires utilisent des valeurs globales neutres internes. Les anciens champs restent pris en charge pour les données et clients historiques. À coefficients identiques, poids, nutrition, quantités des menus et stocks restent identiques. Les protections des historiques et versions s’appliquent toujours. Aucun changement du moteur de portions 0.2.83/0.2.86.

Validation : **303 tests locaux réussis**, dont riz et haricots avec coefficients indépendants dans une même partie, semoule ×2, héritage ancien et personnalisé conservé, préparations maison ×1, enregistrement PATCH et apports inchangés. Chrome local sur base fictive à 1440/1280/900/390/320 px : absence des champs globaux, valeur héritée ×0,8 visible/conservée, sélection ×2 dans les réglages rapides et l’éditeur, persistance après enregistrement, parcours des vues et aucune erreur inattendue ni débordement horizontal. Pas d’appareil physique testé, aucun accès à Unraid/Nginx.


## Recettes : filtre service, réglages rapides et affichage — 0.2.92

Depuis la 0.2.92, le répertoire ajoute un filtre Type de service (rendement pièces/portions, préparation entière en grammes, deux ou trois parties). Les Réglages rapides repliables de chaque fiche permettent de modifier service, rendement de base (quantité et unité : portions, pièces, tranches, g ou ml), coefficients et affectation des ingrédients pour un service séparé. Aucune affectation n’est déduite du nom d’un aliment. Les ingrédients, équivalences et autres champs sont conservés ; les mêmes validations et protections que l’éditeur complet s’appliquent. Les repas déjà préparés et historiques incompatibles peuvent empêcher une modification, avec explication. Les calculs de portions 0.2.83/0.2.86 restent inchangés.

Choix Grille/Liste, de 1 à 4 recettes par ligne sur PC et 12/24/48/96 recettes par page ; au maximum deux colonnes sur tablette et une sur mobile pour la lisibilité. Filtre service et préférences d’affichage mémorisés dans le navigateur. Rechargement des fiches et apports après enregistrement ; réglages de production et moments conservés.

Validation : **302 tests locaux réussis** ; PATCH réel PostgreSQL/PGlite (validation, versions, foyer, nutrition, services, références parentes, équivalences, historiques et retour arrière transactionnel). Chrome local sur données fictives : filtre, vues, pagination 30 recettes, persistance après rechargement, changement du rendement et du service, affectation des ingrédients, erreur corrigible ; PC 1440/1280, tablette 900 et mobile 390/320 px, sans erreur inattendue ni débordement horizontal. Impression d’origine conservée. Aucun test sur appareil physique, aucun accès à Unraid/Nginx.

Les sections ci-dessous conservent le contexte des versions précédentes ; la référence courante est **0.2.94**. Dernière publication vérifiée avant ce chantier : PR #123, commit 836735f, tests et publication GHCR réussis. Vérifier le workflow du commit fusionné de la 0.2.92 après livraison.

## Version et publication vérifiées

- Dépôt : https://github.com/throlan/Lapinou-Dish ; branche de référence : `origin/main`.
- Version du code : **0.2.91** : publication Instagram intégrable dans Cuisiner depuis le lien source, à la demande, puis webapp installable (manifeste, icônes et guide) sur la refonte visuelle claire Magazine culinaire · Encre framboise, responsive PC/tablette/mobile, sans changement métier. La 0.2.88 conserve la saisie des achats et du stock compté dans l’unité d’achat (œufs, pots, paquets…), conversion unique vers l’unité de stock. Regroupements et exclusions de la 0.2.87 conservés. Le calcul 0.2.86 reste fondé sur la **base fonctionnelle validée 0.2.83**, sans les calculs abandonnés 0.2.84/85.
- Dernière publication applicative vérifiée avant ce chantier : **0.2.91**, PR #122, commit c3bf80e, [contrôles et GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/39129593328). La présente mise à jour ne change que les documents et conserve la version applicative.
- Validation 0.2.91 : **298 tests locaux réussis**. Lecteur testé sur publication fictive interceptée : chargement seulement au clic, arrêt au masquage/fermeture/Escape et aucune incrustation sans source Instagram compatible. Lecture d’une publication réelle non confirmée ; dépend des autorisations et restrictions Instagram. Chrome local : manifeste sans erreur et aucun motif de non-installabilité ; bouton natif proposé dans le profil jetable. Pas de service worker ni de nouvelle couche de cache hors ligne. Parcours des sept pages dans Chrome local sur base fictive PGlite, largeurs 1440, 1280, 900, 390 et 320 px ; fiches repas/aliment/cuisine et éditeur de recette, navigation mobile et absence de débordement horizontal vérifiés. Impression existante conservée ; tests par émulation de viewport, pas sur appareils physiques.
- Références : [état](STATUS.md), [prochaines tâches](TODO.md), [produit](PRODUCT.md), [améliorations](AMELIORATIONS.md), [journal du 23 octobre](SESSION-2026-10-23.md).

## Interdiction d'accès à l'installation

**Ne jamais accéder à Unraid ni à Nginx, même pour lire, vérifier ou diagnostiquer. L'utilisateur effectue seul le déploiement.** Le périmètre de l'agent couvre le dépôt local, les tests sur données fictives, GitHub et la vérification des publications GHCR.

## Reprendre sur un autre PC

1. Retrouver le dépôt par son remote GitHub ; le chemin local dépend du PC. Ne pas confondre avec les anciens dossiers Norish ni supposer que le chemin de la session précédente existe encore.
2. Lire les éventuels `AGENTS.md`. Examiner l'état Git, la branche, les derniers commits et **tous les stashes**. Préserver les modifications, branches et stashes existants ; aucune réapplication automatique d'un ancien chantier.
3. Récupérer `origin/main` sans écrasement. Sur un main propre, avancer seulement en fast-forward ; sinon inspecter et isoler le travail avant de changer de base. Aucun reset destructif ni nettoyage forcé.
4. Vérifier GitHub, `package.json` et les documents liés ci-dessus. Le dernier journal est `SESSION-2026-10-23.md` ; les précédents sont historiques.
5. Faire un état bref et proposer les prochaines étapes ; **attendre la demande de l'utilisateur avant une nouvelle modification fonctionnelle**.

## Décisions de périmètre récentes

- Comptes individuels reportés explicitement après discussion du projet communautaire/hébergé ; aucune implémentation commencée et aucun modèle de droits validé.
- Une seule collation souhaitée, l’après-midi : évolution à planifier, pas encore implémentée. Les cinq créneaux et menus existants doivent être préservés tant que la transition n’est pas développée.
- La recherche nutritionnelle n’a pas changé les pourcentages ni ajouté de quotas selon l’âge. Ne pas prendre un repère de discussion pour un réglage validé.

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
- **0.2.91** : Cuisiner affiche un volet Publication et vidéo Instagram pour une source HTTPS Instagram de type p/reel/tv. Chargement au clic dans une iframe isolée, lien de repli permanent, lecteur retiré à la fermeture et au masquage. Pas de téléchargement, de scraping, de détection certaine vidéo/photo ni de clé API. Les recettes sans source ou avec une autre source gardent leur fiche habituelle.
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

## Prompt à copier pour reprendre le projet

```text
Reprends Lapinou Dish depuis son remote https://github.com/throlan/Lapinou-Dish. Retrouve le dépôt local, préserve toutes les modifications, branches et stashes puis récupère origin/main sans écrasement, reset destructif ni clean. Lis AGENTS.md s’il existe, docs/REPRISE.md, docs/STATUS.md, docs/PRODUCT.md, docs/AMELIORATIONS.md, docs/TODO.md et le dernier journal docs/SESSION-2026-10-23.md.

La version en préparation est 0.2.96 : unité d’achat habituelle réglable sur la fiche aliment, conversions de recette vers paquets et équivalences explicites entre produits (par exemple pois chiches cuits égouttés → secs, coefficient 0,8). La page Aliments avec édition et suppression protégée existait déjà. Les 306 tests locaux passent. Vérifie GitHub, package.json, la PR, les contrôles et la publication GHCR avant d’annoncer la livraison. La 0.2.95 est la dernière version publiée connue, PR #127, commit 50ab3db3d3c5f4b5b13849705d66b791483ab7fb.

Ne recommence aucune fonction déjà livrée et respecte les décisions en attente consignées dans le cahier de reprise et le TODO. Aucun accès à Unraid ni à Nginx, même en lecture ; je gère le déploiement. Les tests locaux sur données fictives sont autorisés. Pour les travaux autorisés : tests adaptés, commit/push, PR, fusion après réussite des contrôles, puis vérification de publication GitHub/GHCR.
```
