# État du projet — 13 octobre 2026

## Version de référence

**0.2.41**, commit applicatif 37132fbc37f177cfdf27eccc300e072127955abe, fusionné sur main. Les contrôles GitHub et la publication GHCR sont réussis. Les commits documentaires ultérieurs ne changent pas la version applicative.

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

**138 tests réussis** avec la commande Node documentée dans [le cahier de reprise](REPRISE.md), également disponible via npm test.

Les tests PostgreSQL/PGlite exécutent les migrations SQL et les requêtes réelles. Les parcours d'interface ont été vérifiés dans Chrome sur une base locale et des données synthétiques. Cela ne constitue pas une validation de l'installation de l'utilisateur.

## À terminer

1. Réserve kcal hebdomadaire/mensuelle et occasions avec estimation globale par adulte : [brouillon archivé et intégration restante](drafts/ENERGY-RESERVE.md).
2. Journal des consommations réelles, confirmation/ajustement des repas consommés et instantanés nutritionnels historiques.
3. Variantes et composants métier plus complets, au-delà des parties de service déjà implémentées.
4. Continuer les validations sur les données et parcours de l'utilisateur à partir de ses retours, sans accès de l'agent à son serveur.

## Guides actuels

- [Objectifs kcal et rééquilibrage](MEAL-ENERGY.md)
- [Grammes estimés et parties de service](SERVING-GRAMS.md)
- [Duplication des repas](MEAL-DUPLICATION.md)
- [Desserts individuels](INDIVIDUAL-DESSERTS.md)
- [Ingrédients surveillés](INGREDIENT-STOCK.md)
- [Import OpenAI](OPENAI-RECIPE-IMPORT.md)
