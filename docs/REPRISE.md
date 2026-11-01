# Cahier de reprise — 1er novembre 2026

## Stock restant des préparations et retour des regroupements — 0.3.7

Dans « Stock des préparations déjà produites », « Corriger la quantité restante » saisit le total physiquement présent, avant les réservations des menus, dans l’unité de la préparation. Les fabrications initiales et déductions d’ingrédients ne sont pas réécrites. Exemple : 20 pièces fabriquées, 10 réellement restantes, 16 réservées → manque de 6. Les besoins, courses, composants et stocks utilisent la correction ; une production ultérieure ou un repas préparé continue d’actualiser ce stock. Les services séparés se comptent indépendamment. Les corrections sont historisées sous verrou du foyer, avec contrôle de quantité périmée et répétition sans double mouvement. Une annulation de lot est refusée si elle rendrait le stock insuffisant après les sorties/corrections.

« Acheter sous… » : le regroupement purée de tomate → coulis a été enregistré sur données fictives avant le correctif ; le défaut constaté est l’absence de confirmation après reconstruction/repli de la liste. Un succès affiche désormais une confirmation visible et ouvre le récapitulatif. Un choix incomplet ne reste plus sans explication ; les refus de conversion, de stock source ou d’historique restent protégés et affichés. Aucune densité ni équivalence n’est inventée et les recettes/nutritions restent distinctes.

Migration additive `20261101_preparation_stock_counts.sql`. **340 tests complets locaux réussis**, dont stock 20→10, réservations, zéro, correction à la hausse, conflit, répétition, isolation du foyer, repas préparé/annulé, services séparés et refus d’annulation de lot. Chrome local sur données fictives à 1440/900/390/320 px : correction du banana bread, regroupement de deux produits en 600 g, formulaire incomplet et conversion impossible expliqués ; aucune erreur JS/HTTP inattendue ni débordement. Le batch cooking multi-semaines 0.3.6 est conservé. Aucun changement des menus, portions ou règle viande/poisson. Aucun accès à Unraid/Nginx. Contrôles GitHub et publication à vérifier après fusion.

## Batch cooking sur plusieurs semaines — 0.3.6 livrée

Dans « Courses & stocks > Préparations à faire », choisir la semaine de départ puis 1, 2 ou 3 semaines, ou toute la période des courses. Une seule liste regroupe chaque recette et ses quantités sur la plage affichée. Au premier affichage, la première semaine contenant un menu de batch est sélectionnée : une semaine partielle vide du 31 octobre au 1er novembre ne décale donc pas les semaines du 2 au 15 novembre 2026. L’option 1 semaine conserve les limites lundi–dimanche, bornées par les dates des courses. Toute la période ignore la semaine de départ ; les durées fixes sont limitées à la fin des courses.

Le navigateur demande un calcul unique de la plage au moteur existant, dans l’ordre des repas, avec un stock partagé et les minima propres aux recettes. Il n’additionne pas les projections hebdomadaires. Les repas antérieurs réservent toujours le stock en premier ; le surplus d’un lot minimum couvre les repas suivants. Après enregistrement d’une production, les besoins et le stock sont rechargés en conservant la sélection. Les libellés distinguent la couverture par stock et par lots prévus lorsqu’un minimum est configuré.

Les autres productions et la liste de courses gardent leur période actuelle ; cette portée est expliquée dans l’interface. Aucun menu, calcul de portions, règle viande/poisson ou migration n’est modifié. **336 tests complets locaux réussis**, dont une semaine partielle vide, deux semaines répétées, stock initial réservé une seule fois, lot minimum, conservation des menus et coordination des requêtes du navigateur. Parcours Chrome local fictif validé à 1440/900/390/320 px, sélection 1/2/3/période complète, production, stock actualisé, sans erreur JS/HTTP ni débordement horizontal. PR #149 fusionnée au commit `2359b2d287488e5b429ff5a7f9d3276a9250484a` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41244538868. Les tags `0.3.6` et `v0.3.6` ont été vérifiés directement dans GHCR et pointent vers `sha256:5f57f1c72002ae863f34ab9b82c8995ce93f54eb667bce1c88ddcdcf5d9d57fb`.

# Féculents des recettes composées — 0.3.5 livrée

Après la livraison 0.3.4, la ligne « Féculents » d’une recette composée était encore traitée comme un accompagnement individuel lors de la proposition automatique. Elle recevait 1 g par défaut, restait hors du calcul des proportions de l’assiette et pouvait être perdue au recalcul. Le formulaire 0.3.5 traite les parties liées comme des composants d’un même plat pour leur affichage, leur calcul par personne et leur enregistrement. Les accompagnements ajoutés séparément restent des choix individuels. Un repas déjà enregistré avec 1 g doit être ouvert et recalculé par l’utilisateur ; ses quantités ne sont pas réécrites silencieusement. Les cartes d’ingrédients retrouvent un fond et des libellés lisibles dans le thème clair. Aucun changement du calcul de viande/poisson. PR #146 fusionnée au commit `86c220c9676cb69c80a85ae68a07edaad704965c` ; contrôles et publication : https://github.com/throlan/Lapinou-Dish/actions/runs/41210728818.

# Parties liées des recettes au calendrier — 0.3.4 livrée

Les parties générées d’une recette composée (protéines, légumes, féculents) sont identifiées dans l’éditeur comme des composants liés à la recette. Elles ne sont plus proposées comme des recettes indépendantes. Leurs quantités par personne restent modifiables.

Le mode trois parties peut devenir deux parties en réaffectant les ingrédients : légumes et protéines ensemble, féculents à part. Une partie retirée est archivée au lieu d’être supprimée ; les menus déjà planifiés et références de stock gardent leur recette et leurs ingrédients historiques. Les nouveaux menus n’expansent que les parties actives. Si la partie est réactivée plus tard, une nouvelle identité est créée pour ne pas réécrire l’ancienne partie historique.

L’utilisateur a demandé de laisser en attente la règle qui devrait augmenter la viande/poisson selon un objectif moyen de 125 g par portion : aucun changement du calcul de quantité de viande n’est demandé pour le moment. Retirer un composant lié retire la recette composée entière du repas. Migration `20261031_archived_serving_parts.sql`. **328 tests complets locaux réussis.** PR #144 fusionnée au commit `79c790dd6f564157410d2020007d5bdcc44c4560`. Tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41208298921. Aucun accès à Unraid/Nginx.

# Cahier de reprise — 29 octobre 2026, lots minimums de production

## Fonction livrée — administration et lots minimums par recette, 0.3.3

PR #142 fusionnée au commit `f997a39eb1a23d12e276e8ac5b815036d77f2421`. L’administration se parcourt par sept onglets accessibles au clavier. À son ouverture, ses types de production sont chargés et rendus avant qu’on puisse les modifier, corrigeant l’erreur `invalid-production-types` lors de l’ajout du premier type.

Les types ne définissent plus le minimum de lot : ils classent seulement les préparations. Chaque recette possède son minimum et son unité, convertis avec son rendement/équivalences, puis appliqués aux ingrédients, aux préparations à faire et au surplus de stock. Exemple : un pain de 350 g équivalent à 1 pain et 10 tranches peut avoir un lot minimum de 1 pain ; bagels 24 pièces et pancakes 36 pièces se configurent indépendamment. La migration reprend l’ancien minimum commun si une seule recette racine était concernée ; si plusieurs recettes partageaient le type, elle laisse leurs nouveaux minima à zéro pour éviter une hypothèse trompeuse. **324 tests locaux réussis.** Publication GHCR réussie : https://github.com/throlan/Lapinou-Dish/actions/runs/40905467035 ; image `ghcr.io/throlan/lapinou-dish:0.3.3`, digest `sha256:dc2ec2fafaf286712f99a4b1dd4e3fd17326e5e05ae9bf6ff1d8debff5026a73`. Aucun accès à Unraid/Nginx.

## Fonction livrée — catégories personnalisées au calendrier, 0.3.2

PR #140 fusionnée au commit `d17030f18ba4546334cf78b6e116b1f1c4863baf`. Une recette de type personnalisé apparaît sous sa catégorie configurée même si celle-ci utilise un rôle standard, par exemple Assaisonnement lié au rôle Sauce. Ce rôle ne force plus les recettes personnalisées à 30 g : elles démarrent à une unité. La catégorie et le rôle ne créent pas de doublon de recette ; des catégories distinctes configurées sur un créneau gardent leurs boutons respectifs. **321 tests locaux et contrôles GitHub réussis.** Publication GHCR vérifiée : https://github.com/throlan/Lapinou-Dish/actions/runs/40858994728 ; image `ghcr.io/throlan/lapinou-dish:0.3.2`, digest `sha256:09d71fc82d9e6862f7a982bdeb5b3d6cdb84a6e9cbeed24cc02661733a25ee5a`. Aucun accès à Unraid/Nginx.

## Fonction livrée — types de production et lots minimums, 0.3.1

Version livrée : **0.3.1**. Administration permet d’ajouter des types de production personnalisés, de les affecter à des recettes et de définir un minimum par type avec son unité (pièces, tranches, portions, g ou ml). Le besoin des menus et le stock réservé déterminent si une fabrication est nécessaire ; si un manque subsiste, la quantité planifiée atteint au moins le minimum. Les ingrédients de la fabrication complète sont inclus dans les courses et le surplus réserve les menus suivants. Après enregistrement d’un lot, le stock de production réel évite les achats et fabrications en double. Une unité minimum doit être définie par le rendement ou les équivalences de toutes les recettes assignées au type ; l’enregistrement la refuse sinon. Sans minimum, le comportement reste inchangé.

Exemple validé en test : un burger utilise un bagel, quatre burgers demandent quatre bagels ; minimum 24 pièces → liste de courses pour les ingrédients de 24 bagels ; après fabrication, le stock disponible est 20 pour ces quatre menus et couvre une prochaine commande de quatre sans nouvelle production. « Productions à suivre » a des types supplémentaires configurables, et l’ajout de productions indépendantes des menus reste disponible via la production supplémentaire existante.

Correctif du calendrier : les catégories configurées du foyer sont maintenant rechargées avec les données de la semaine, afin que leurs boutons d’ajout apparaissent dès l’ouverture du calendrier, sans passage préalable par l’administration.

PR #138 fusionnée au commit `351de3a47b82328efeb301923bb089c38f8970c9` ; 319 tests locaux et tests GitHub réussis. Publication GHCR réussie : https://github.com/throlan/Lapinou-Dish/actions/runs/40856567306. Image `ghcr.io/throlan/lapinou-dish:0.3.1`, digest `sha256:a9c9548561fdfddc3a785fd3857ab6d753d33d60ade91f53318e10ac6285b0bf`.

## Fonction livrée — catégories configurables et choix individuels, 0.3.0

PR #137 fusionnée au commit `5349f9b407400d44b6a0376ffb8f787a48b6883d`; contrôles et publication réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/40849807550. **315 tests locaux réussis** à cette livraison.

Administration configure les ajouts complémentaires par créneau, leur type de recette et leur rôle connu (accompagnement, boisson, sauce ou dessert). Les types personnalisés sont proposés dans les fiches recettes et les filtres. Le plat principal reste commun. Chaque ajout complémentaire est propre à chaque personne ; « Aucun » ou quantité 0 signifie qu’elle n’en prend pas. Les quantités nulles ne sont pas enregistrées ni ajoutées aux courses. Les repas et quantités historiques restent conservés. Migration ajoutant `households.meal_additions` et `planned_meal_items.category_id` ; les anciens rôles sont repris comme catégories.

## Archive de la reprise du 29 octobre

## Travail courant — catégories configurables et choix individuels

Version précédente : **0.3.0**. Administration configure les ajouts complémentaires par créneau, leur type de recette et leur rôle connu (accompagnement, boisson, sauce ou dessert). Les types personnalisés sont proposés dans les fiches recettes et les filtres. Le plat principal reste commun. Chaque ajout complémentaire est propre à chaque personne ; « Aucun » ou quantité 0 signifie qu’elle n’en prend pas. Ces quantités nulles ne sont pas enregistrées ni ajoutées aux courses. Les repas et quantités historiques restent conservés. Migration ajoutant `households.meal_additions` et `planned_meal_items.category_id` ; les anciens rôles sont repris comme catégories.

315 tests complets locaux réussis à l’époque. Aucun accès à Unraid/Nginx. PR #137 est depuis fusionnée et publiée.

## Publication : versions numérotées et retour arrière

Dernière version publiée vérifiée : **0.3.6**. PR #149 fusionnée au commit `2359b2d287488e5b429ff5a7f9d3276a9250484a` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41244538868. Les tags `0.3.6` et `v0.3.6` ont été vérifiés directement dans GHCR et pointent vers `sha256:5f57f1c72002ae863f34ab9b82c8995ce93f54eb667bce1c88ddcdcf5d9d57fb`. Conservation des versions numérotées sans purge automatique, au minimum les cinq dernières ; une republication documentaire ne remplace pas l’image numérotée. Voir [ROLLBACK.md](ROLLBACK.md).

Pour revenir à la 0.2.97 : ghcr.io/throlan/lapinou-dish:0.2.97. La 0.2.98 reste identifiée comme défectueuse au démarrage. Aucun changement de migration entre 0.2.97 et 0.2.99 ; une ancienne image ne restaure pas les données. Ne jamais supprimer les volumes pour changer de version. Aucun accès à Unraid/Nginx.

**314 tests complets locaux réussis**, dont tests du script (alias exacts, idempotence, conservation, erreurs/conflits sans écrasement). Livraison vérifiée : PR #135 fusionnée au commit 7af9a023c961637f780157b6665d31110d22be28 ; tests et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39991969857 . Les dix tags numériques/v des versions 0.2.95 à 0.2.99 ont été vérifiés directement dans GHCR et correspondent aux digests des images d’origine.


## Correctif de démarrage — 0.2.99

Cause reproduite sur le code 0.2.98 : app.js importe food-pagination.js, ajouté pour la pagination du catalogue, mais ce module n’était pas inscrit dans la liste des ressources statiques du serveur. GET /food-pagination.js renvoyait 404 avec un contenu JSON. Le navigateur ne pouvait donc pas exécuter app.js : connexion et tableau de bord restaient au chargement, sans gestionnaires utilisables sur les boutons.

Correction minimale : servir explicitement /food-pagination.js avec le type JavaScript, sans authentification préalable, comme les autres modules de démarrage. Version et clés de cache passent en 0.2.99. Aucun changement métier, calcul, pagination, donnée ou migration.

Un nouveau test parcourt les points d’entrée module du HTML et leurs dépendances locales via le vrai gestionnaire HTTP, avant connexion, avec contrôle du statut et du type MIME. Il échoue sur la 0.2.98 avec /food-pagination.js : 404, puis passe après correction. **311 tests complets locaux réussis**. Validation Chrome locale sur base fictive : connexion initiale et rechargement connecté, tableau de bord rempli, navigation sur les sept pages à 1440/1280/900/390/320 px, pagination haute/basse (25 puis 250 sélectionnés, 87 aliments fictifs), ouverture de la fiche aliment. Aucune erreur JS/HTTP ou ressource manquante ni débordement horizontal. Aucun appareil physique ou accès à l’installation. Dernière version publiée vérifiée avant ce correctif : 0.2.98, documentation PR #133, commit 6547d6a, workflow réussi https://github.com/throlan/Lapinou-Dish/actions/runs/39978043811 . Vérifier la publication du commit fusionné 0.2.99 avant d’annoncer la livraison. Aucun accès à Unraid/Nginx ; l’utilisateur déploie lui-même.

Les chapitres suivants archivent les livraisons précédentes ; la référence courante est **0.3.7**, décrite en tête de document.

## Dernière version livrée — 0.2.98

La nouvelle pagination du catalogue ajoute Précédent/Suivant au-dessus et au-dessous de la liste et le choix de 25/50/100/150/200/250 produits. Le serveur plafonne aussi à 250. Les suppressions simples et groupées gardent la page ; si elle devient vide après suppression, l’affichage se place sur la dernière page valide. Les lignes du catalogue sont compactées sur ordinateur : aliment, recettes liées, provenance, valeurs nutritionnelles et boutons sont alignés sur une ligne, avec boutons moins hauts et noms longs accessibles au survol.

PR #132 fusionnée au commit `be007ef6b030bf22f800cbb703117227b9d2e578`. **310 tests complets réussis**, puis **30 tests ciblés catalogue/API** après la dernière retouche d’affichage. Contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39977314240. L’utilisateur gère le déploiement ; aucun accès à Unraid/Nginx.

## Dernière version livrée — 0.2.97

PR #130 fusionnée au commit `5d90528e2dd26f3b836221959be9a86379988231`. **308 tests locaux réussis** ; contrôles GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39966604840. Les conversions de rendement administrables, les courses en sens inverse, la table catalogue sans scrollbar imbriquée et la suppression groupée avec aperçu/protection sont livrées. L’utilisateur gère son déploiement ; aucun accès à Unraid ou Nginx.

## Fonction livrée — 0.2.97

La page Administration ajoute des conversions de rendement propres au foyer : aliment de départ → aliment obtenu, facteur en grammes obtenus par gramme de départ. La règle alimente les choix de coefficient de cuisson uniquement sur l’ingrédient de départ concerné ; les coefficients déjà sauvegardés ne sont pas modifiés. Pour les courses, une ligne de recette utilisant l’aliment obtenu peut être convertie en sens inverse vers l’aliment de départ. Une préférence explicite « Acheter sous… » prend la priorité. Exemple : 1 g sec → 1,25 g égoutté ; 250 g égouttés donnent 200 g secs. Ne pas appliquer une même valeur à des aliments différents sans conversion explicitement enregistrée.

Dans le catalogue alimentaire, la table n’est plus enfermée dans une zone de défilement interne. La pagination existante reste en place. La sélection groupée permet la page actuelle ou tous les résultats du filtre courant, puis affiche un aperçu des fiches supprimables/protégées. Seules les fiches inutilisées sélectionnées sont supprimées ; les recettes, stocks, regroupements d’achat et conversions les protègent. Le serveur recontrôle les références au moment de la suppression.

La base de cette modification était 0.2.96 / PR #129. La 0.2.97 est maintenant sur `origin/main` et vérifiée côté GitHub/GHCR. Au prochain redémarrage, vérifier le nouvel état Git et ces documents avant tout changement. Jamais d’accès à Unraid ni Nginx ; l’utilisateur déploie lui-même.

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
Reprends Lapinou Dish depuis https://github.com/throlan/Lapinou-Dish. Retrouve le dépôt local par son remote, préserve modifications, branches et stashes puis récupère origin/main sans écrasement, reset destructif ni clean. Lis AGENTS.md s’il existe, docs/REPRISE.md, STATUS.md, PRODUCT.md, AMELIORATIONS.md, TODO.md, ROLLBACK.md et le journal le plus récent.

Référence préparée : application 0.3.7, correction du stock physique des préparations, distinct des réservations et des fabrications initiales ; regroupements d’achat avec confirmation visible et validation expliquée. Migration 20261101_preparation_stock_counts.sql, 340 tests locaux et parcours navigateur fictif réussis. Vérifier sa livraison GitHub/GHCR. Le batch cooking sur plusieurs semaines 0.3.6 est déjà livré. Choix de semaine de départ, 1/2/3 semaines ou toute la période des courses ; une seule liste cumulée par recette, stock partagé et minima de lot appliqués par le moteur existant sur toute la plage, jamais une somme des semaines. Une semaine partielle vide ne décale pas le choix initial. Autres productions et courses gardent leur période. Sélection conservée après production, besoins et stock actualisés. 336 tests complets locaux réussis et parcours Chrome fictif PC/tablette/mobile. PR #149 fusionnée au commit 2359b2d287488e5b429ff5a7f9d3276a9250484a ; contrôles et publication réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41244538868. Vérifie GitHub, package.json, les derniers contrôles et la publication avant de poursuivre ; ne refais pas les fonctions livrées.

Préserver les calculs 0.2.83/0.2.86 (pas ceux des 0.2.84/85), compensation calorique après conversion en unités entières, coefficients individuels, recettes comme ingrédients, unités d’achat, charte Encre framboise et webapp. Les catégories configurables, lots minimums propres aux recettes, composants liés au calendrier et correctif féculent 1 g sont déjà livrés. Ne pas modifier la quantité de viande/poisson : règle en attente. Comptes reportés, correction nutritionnelle à confirmer, nettoyage catalogue en dernier ; une seule collation souhaitée mais non développée. Aucun quota par âge ni ratio 20/40/10/30 appliqué.

Images : tags numériques et v depuis package.json, sans écraser une version publiée ; conservation sans purge automatique, au minimum cinq versions. Ne pas modifier les digests historiques de docker/rollback-images.json. Une republication documentaire conserve l’image numérotée. La 0.2.98 est défectueuse ; 0.2.97 reste disponible, mais les versions 0.3.x ont ajouté des migrations : un retour aussi ancien ne doit pas être supposé compatible. Une image ne restaure pas les données ; vérifier les migrations avant tout retour arrière, sans supprimer de volumes.

Fais un bilan bref puis attends ma demande avant toute modification. Jamais d’accès à Unraid ni Nginx, même en lecture : je déploie. Tests locaux fictifs autorisés. Pour les travaux demandés : tests, commit/push, PR, fusion après contrôles réussis, vérification GitHub/GHCR et documentation de reprise.
```
