# État du projet — 16 octobre 2026

## Version de référence

La version actuelle est **0.2.67**, fusionnée au commit `85f65096cc6ece062eb66162db2c75ab83329b11` par la PR [89](https://github.com/throlan/Lapinou-Dish/pull/89). Les conversions par aliment couvrent les cuillères à café et à soupe, les pincées, les scoops et les pièces. Les besoins convertibles se regroupent en utilisant le format de paquet existant ; l'export Home Assistant retire les anciennes lignes gérées qui ne sont plus nécessaires. Les tests et la publication GHCR ont réussi dans le [workflow 232](https://github.com/throlan/Lapinou-Dish/actions/runs/38911373988). Voir le [journal du 16 octobre](SESSION-2026-10-16.md).

Pour reprendre le projet sur un autre poste : [cahier de reprise](REPRISE.md). Pour le détail des dernières modifications : [journal de session du 16 octobre](SESSION-2026-10-16.md).

Les nouvelles pistes d’évolution (recettes, import, photos, usage mobile, comptes et communauté) sont consignées dans le [cahier des améliorations](AMELIORATIONS.md). Elles restent à prioriser et à préciser.

**Règle impérative : aucune intervention de l'agent sur Unraid, y compris en lecture ou pour une vérification. L'utilisateur gère lui-même son installation et ses mises à jour.**

## Implémenté

- Authentification par mot de passe de foyer et session HTTP-only ; connexion sans actualisation nécessaire.
- Catalogue canonique Ciqual et aliments manuels, alias, conversions documentées, données inconnues conservées, édition et recherche de valeurs manquantes.
- Création/édition de recettes, calcul par batch et rendement, types et moments distincts, filtres et recherche. Liste paginée (12 recettes), détails repliés et réglages de production/moments enregistrables directement sur chaque ligne sans modifier les ingrédients.
- Import de texte/archives en brouillons, OpenAI optionnel et tentative de récupération de description Instagram avec repli texte.
- Calendrier à cinq créneaux, participants explicites, repas multi-recettes, boissons/desserts individuels et duplication complète sur plusieurs dates. Au petit-déjeuner et aux deux collations, les desserts adaptés peuvent aussi être ajoutés comme recette commune et bénéficier du calcul de portions ; au déjeuner et au dîner, le dessert individuel s’ajoute avec « + Dessert ».
- Préparation entière en grammes estimés, deux ou trois parties indépendantes, coefficients de cuisson, conversions des repas/lots existants et conservation des ingrédients crus.
- Ingrédients en blocs lisibles ; liens en bas ; coefficient individuel affiché pour les féculents sélectionnés.
- Administration : profils compacts et datés, relevés de poids et historiques ; répartition des kcal à 100 %, par défaut 15/40/10/25/10 %.
- Lignes kcal/protéines par personne dans l'éditeur ; calendrier allégé et bilan kcal prévu/objectif en bas de chaque journée.
- Propositions plafonnées et recalcul explicite ; petit-déjeuner limité automatiquement à deux pièces, une portion ou poids correspondant selon le rendement.
- Rééquilibrage de la journée pour les adultes : aperçu, correction du petit-déjeuner, réduction éventuelle du déjeuner/dîner, conservation du repère protéique de ces repas et refus des aperçus obsolètes.
- Stocks de produits et de préparations : inventaire initial, achats reçus, productions et repas marqués « Préparé », historique, annulations transactionnelles et protection contre les doubles déductions ; courses déduisant les stocks disponibles.
- Planning des routines de courses modifiable et persistant, avec confirmation visible après enregistrement.
- Courses regroupées par magasin et produit dans des panneaux repliables ; magasins modifiables sans perdre leurs associations d’aliments ni leur cible Home Assistant. « Préparations à faire » ne garde que les recettes avec une production à suivre, avec besoins restants après stock de plats.
- Docker/Compose pour environnement dédié, migrations ordonnées, import Ciqual idempotent et publication CI de l'image.

## Photos persistantes et génération d'illustrations — 0.2.65

Les photos sont stockées dans un dossier configurable (`RECIPE_IMAGE_DIR`) avec PostgreSQL comme repli si aucun dossier n'est déclaré. Le chemin choisi pour le conteneur est `/images`, mappé côté hôte vers `/mnt/user/appdata/lapinoudish/images`. Au démarrage, les anciennes images PostgreSQL sont transférées dans le dossier configuré. L'import et la génération utilisent des variables de modèle distinctes (`OPENAI_RECIPE_MODEL` et `OPENAI_IMAGE_MODEL`). Une erreur `403 model_not_found` signale un accès absent au modèle image du projet associé à la clé API. Détails : [journal du 16 octobre](SESSION-2026-10-16.md).

## Vérification

La suite complète locale et CI est réussie pour la version 0.2.67 (192 tests locaux). Le [workflow 232](https://github.com/throlan/Lapinou-Dish/actions/runs/38911373988) a validé les tests et publié l'image GHCR. Les vérifications Chrome sur données fictives documentées ci-dessous correspondent à la version 0.2.56 et valident la liste paginée sur ordinateur et mobile. Le workflow 214 de la version 0.2.61 est conservé comme repère historique.

Les tests PostgreSQL/PGlite exécutent les migrations SQL et les requêtes réelles. Les parcours d'interface ont été vérifiés dans Chrome sur une base locale et des données synthétiques. Cela ne constitue pas une validation de l'installation de l'utilisateur.

## Composition des assiettes — 0.2.48

Branche **feat/plate-weight-ratios** : proportions en poids estimé servi par foyer, réglables dans Administration. Défauts : 100 % entier ; 70/30 viande-légumes/féculents ; 25/25/50 protéines/féculents/légumes. Totaux validés à 100 %, exemples en grammes et recalcul explicite. Les parties liées conservent leur composition lors de l'ajustement protéique et du rééquilibrage quotidien.

La PR 60 est fusionnée, tests et publication réussis (workflow 171). Détails : [session du 14 octobre](SESSION-2026-10-14.md).

Les liens de commande (PR 59) sont déjà livrés. L'utilisateur a confirmé que les coupures PostgreSQL sont réglées ; elles ne sont plus une tâche à reprendre. Aucune connexion de l'agent à l'installation.

Piste éventuelle : composants et variantes de recette indépendants au-delà des parties de service actuelles ; à préciser seulement si l'utilisateur souhaite poursuivre.

Les totaux du calendrier restent prévisionnels. L'utilisateur ne souhaite pas de journal de consommation réelle ni de saisie après repas.

Le brouillon `drafts/ENERGY-RESERVE.md` est historique : le système correspondant a été livré en 0.2.42. Ne pas le compter dans le reste à faire.

## Achats en ligne — 0.2.49

Développement sur feat/online-shopping-by-store : affectations par foyer de plusieurs aliments à une boutique, réutilisation des liens de commande, listes de courses par marchand et renommage des libellés whey/farines en Achats en ligne. Stocks, paquets, cases acheté et aliments sans boutique préservés. Les affectations sont modifiables dans le panneau ou directement depuis les courses.

La PR 62 a été fusionnée et la publication de l'image a réussi dans le workflow 175. Guide : [ONLINE-SHOPPING.md](ONLINE-SHOPPING.md). Détails dans [la session du 14 octobre](SESSION-2026-10-14.md).

## Magasins physiques et exports — 0.2.50

Livré : URL facultative pour les magasins ; regroupement et filtre par magasin ; copie et fichier texte par magasin ; envoi optionnel vers les listes `todo` Home Assistant. Suggestions d'achat : ail en gousses/têtes, basilic en bouquets, gingembre en racines indicatives de 50–80 g. Alexa ne fournit plus d'API officielle pour écrire directement dans ses listes.

## Unités d'achat personnalisées — 0.2.51

Livré : libellés singulier/pluriel, équivalence chiffrée et note d'estimation réglables par foyer et aliment depuis les détails d'une ligne de courses. Les besoins du même aliment sont réunis si leurs unités disposent d'une conversion documentée ; sinon ils restent visibles séparément avec un avertissement. Le format de paquet manuel existant reste prioritaire. Voir [le guide](ONLINE-SHOPPING.md).

## Stock des produits — 0.2.52

Livré en 0.2.52 (PR 66, workflow 183) : stock initial par aliment, saisi dans l'unité de la ligne de courses ou en grammes ; achats réellement reçus ajoutés au stock avec protection contre les doublons ; retrait des ingrédients lors d'une production ou de la validation « Préparé » sur un repas du calendrier. Un repas utilisant un batch enregistré ne déduit pas ses ingrédients une seconde fois. Annulation et historique des mouvements disponibles. La liste de courses tient compte du stock ; les conversions manquantes sont signalées. Voir [le guide](PRODUCT-INVENTORY.md).

## Suite

Les chantiers proposés sont détaillés dans [AMELIORATIONS.md](AMELIORATIONS.md) et ne sont pas encore planifiés. Prochaine étape conseillée : définir les critères de données nutritionnelles manquantes et le contenu des vignettes, puis préciser les parcours avant de toucher à l’interface.

La fiche « Cuisiner » et le regroupement des préparations ont été livrés sur `main` (PR 79, version 0.2.61). Le dessert commun pour les deux collations est livré via la PR 80. L'utilisateur met lui-même à jour son installation ; l'agent ne la vérifie pas.

## Guides actuels du projet

- [Objectifs kcal et rééquilibrage](MEAL-ENERGY.md)
- [Grammes estimés et parties de service](SERVING-GRAMS.md)
- [Duplication des repas](MEAL-DUPLICATION.md)
- [Desserts individuels](INDIVIDUAL-DESSERTS.md)
- [Ingrédients surveillés](INGREDIENT-STOCK.md)
- [Stock des produits](PRODUCT-INVENTORY.md)
- [Page Courses & stocks](SHOPPING-STOCK-PAGE.md)
- [Achats en ligne par boutique](ONLINE-SHOPPING.md)
- [Import OpenAI](OPENAI-RECIPE-IMPORT.md)
- [Cahier des améliorations proposées](AMELIORATIONS.md)
