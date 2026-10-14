# État du projet — 14 octobre 2026

## Version de référence

**0.2.49** publiée après la PR 62, fusionnée sur `main` dans le commit `d7aed3bd7ec354f69e124adf8a8d6261b7786397`. Les achats en ligne sont regroupés par boutique. **0.2.50** est en développement local pour ajouter magasins physiques, listes par magasin et export Home Assistant ; sa publication reste à vérifier après livraison.

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

**167 tests réussis** avec `node --experimental-strip-types --test test/*.test.ts test/*.test.mjs` (Node v24.19.0) sur le travail 0.2.50.

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

En développement local : URL facultative pour les magasins ; regroupement et filtre par magasin ; liste plus lisible sur toute la largeur ; copie et fichier texte par magasin ; envoi optionnel vers les listes `todo` Home Assistant avec cible par magasin et secret côté serveur. Suggestions d'achat : ail en gousses/têtes, basilic en bouquets, gingembre en racines indicatives de 50–80 g. Les calculs nutritionnels des recettes restent inchangés. Alexa ne fournit plus d'API officielle pour écrire directement dans ses listes. La livraison GitHub et la publication restent à effectuer/vérifier.

## Guides actuels du projet

- [Objectifs kcal et rééquilibrage](MEAL-ENERGY.md)
- [Grammes estimés et parties de service](SERVING-GRAMS.md)
- [Duplication des repas](MEAL-DUPLICATION.md)
- [Desserts individuels](INDIVIDUAL-DESSERTS.md)
- [Ingrédients surveillés](INGREDIENT-STOCK.md)
- [Achats en ligne par boutique](ONLINE-SHOPPING.md)
- [Import OpenAI](OPENAI-RECIPE-IMPORT.md)
