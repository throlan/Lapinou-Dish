# État du projet — 14 octobre 2026

## Version de référence

**0.2.50** publiée après la PR 64, fusionnée sur `main` dans le commit `5795583c907dfc6bd2fb649918cd19d5e2c938a4`. Magasins physiques, listes par magasin, suggestions d'achat ail/basilic/gingembre et export Home Assistant sont livrés. **0.2.51** est en développement pour rendre les unités d'achat paramétrables par aliment.

Pour reprendre le projet sur un autre poste : [cahier de reprise](REPRISE.md). Pour le détail des modifications : [journal de session](SESSION-2026-10-13.md).

**Règle impérative : aucune intervention de l'agent sur Unraid, y compris en lecture ou pour une vérification. L'utilisateur gère lui-même son installation et ses mises à jour.**

## Implémenté

- Authentification par mot de passe de foyer et session HTTP-only ; connexion sans actualisation nécessaire.
- Catalogue canonique Ciqual et aliments manuels, alias, conversions documentées, données inconnues conservées, édition et recherche de valeurs manquantes.
- Création/édition de recettes, calcul par batch et rendement, types et moments distincts, filtres, sauvegarde des tags.
- Import de texte/archives en brouillons, OpenAI optionnel et tentative de récupération de description Instagram avec repli texte.
- Calendrier à cinq créneaux, participants explicites, repas multi-recettes, boissons/desserts individuels et duplication complète sur plusieurs dates.
- Préparation entière en grammes estimés, deux ou trois parties indépendantes, coefficients de cuisson, conversions des repas/lots existants et conservation des ingrédients crus.
- Ingrédients en blocs lisibles ; liens en bas ; coefficient individuel affiché pour les féculents sélectionnés.
- Administration : profils compacts et datés, relevés de poids et historiques ; répartition des kcal à 100 %, par défaut 15/40/10/25/10 %.
- Lignes kcal/protéines par personne dans l'éditeur ; calendrier allégé et bilan kcal prévu/objectif en bas de chaque journée.
- Propositions plafonnées et recalcul explicite ; petit-déjeuner limité automatiquement à deux pièces, une portion ou poids correspondant selon le rendement.
- Rééquilibrage de la journée pour les adultes : aperçu, correction du petit-déjeuner, réduction éventuelle du déjeuner/dîner, conservation du repère protéique de ces repas et refus des aperçus obsolètes.
- Stocks de préparations, réservations, productions et annulations transactionnelles ; ingrédients surveillés, minimum/cible/délai ; courses déduisant les stocks disponibles.
- Docker/Compose pour environnement dédié, migrations ordonnées, import Ciqual idempotent et publication CI de l'image.

## Vérification

**170 tests réussis** avec `node --experimental-strip-types --test test/*.test.ts test/*.test.mjs` (Node v24.19.0) sur le travail 0.2.51.

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

En développement local : libellés singulier/pluriel, équivalence chiffrée et note d'estimation réglables par foyer et aliment depuis les détails d'une ligne de courses. Les besoins du même aliment sont réunis si leurs unités disposent d'une conversion documentée ; sinon ils restent visibles séparément avec un avertissement. Le format de paquet manuel existant reste prioritaire. Recettes, stocks et calculs nutritionnels ne sont pas modifiés. Voir [le guide](ONLINE-SHOPPING.md).

## Guides actuels du projet

- [Objectifs kcal et rééquilibrage](MEAL-ENERGY.md)
- [Grammes estimés et parties de service](SERVING-GRAMS.md)
- [Duplication des repas](MEAL-DUPLICATION.md)
- [Desserts individuels](INDIVIDUAL-DESSERTS.md)
- [Ingrédients surveillés](INGREDIENT-STOCK.md)
- [Achats en ligne par boutique](ONLINE-SHOPPING.md)
- [Import OpenAI](OPENAI-RECIPE-IMPORT.md)
