# État du projet — 13 octobre 2026, soir

## Version de référence

**0.2.47**, publiée après la PR 58, fusionnée sur `main` dans le commit `ee99abd1922ee1d4780b486522b41cdfbcf4bf28`. Elle comprend les formats de paquets mémorisés par foyer, aliment et unité, la suppression protégée des aliments inutilisés, les liens et quantités de recettes dans les courses, l'arrondi des achats à la pièce entière et le compte épargne kcal.

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

**146 tests réussis** avec `node --experimental-strip-types --test test/*.test.ts test/*.test.mjs` (Node v24.19.0).

Les tests PostgreSQL/PGlite exécutent les migrations SQL et les requêtes réelles. Les parcours d'interface ont été vérifiés dans Chrome sur une base locale et des données synthétiques. Cela ne constitue pas une validation de l'installation de l'utilisateur.

## À terminer

1. Vérifier dans Chrome le correctif de la branche `fix/shopping-list-scroll-handoff` qui empêche la liste de courses de sauter en bas à chaque changement de cellule. Les tests automatisés passent, mais le parcours navigateur reste à confirmer.
2. Après validation du parcours, ouvrir une PR depuis cette branche et suivre les contrôles habituels.
3. Enrichir éventuellement les recettes avec des composants et variantes indépendants au-delà des parties de service existantes ; cette piste n'est pas encore spécifiée en détail.
4. Continuer les validations à partir des retours de l'utilisateur, sans accès de l'agent à son serveur.

Les totaux du calendrier restent prévisionnels. L'utilisateur ne souhaite pas de journal de consommation réelle ni de saisie après repas.

Le brouillon `drafts/ENERGY-RESERVE.md` est historique : le système correspondant a été livré en 0.2.42. Ne pas le compter dans le reste à faire.

## Guides actuels

- [Objectifs kcal et rééquilibrage](MEAL-ENERGY.md)
- [Grammes estimés et parties de service](SERVING-GRAMS.md)
- [Duplication des repas](MEAL-DUPLICATION.md)
- [Desserts individuels](INDIVIDUAL-DESSERTS.md)
- [Ingrédients surveillés](INGREDIENT-STOCK.md)
- [Import OpenAI](OPENAI-RECIPE-IMPORT.md)
