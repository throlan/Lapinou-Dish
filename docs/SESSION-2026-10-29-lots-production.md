# Session du 29 octobre 2026 — types de production et lots minimums

## Demande

Ajouter des types de production au suivi, pouvoir fixer un minimum par type de recettes (ex. bagels par 24), inclure les ingrédients de ce lot dans les courses et utiliser le stock excédentaire pour les menus suivants. Le stock des productions existait déjà ; conserver ce mécanisme.

## État réalisé

- Régression du calendrier corrigée : `refreshCalendar` charge maintenant les catégories d’ajouts du foyer. Sans cela, les boutons d’ajout n’apparaissaient qu’après être passé par l’administration. Un test vérifie le chargement lors de l’ouverture du calendrier.

- Migration `20261029_configurable_production_types.sql` : réglages JSON par foyer et autorisation de nouveaux identifiants de type sur les recettes.
- Administration : types personnalisés ajoutables, renommables, supprimables si aucune recette ne les utilise ; minimum et unité réglables aussi pour les types intégrés. Un minimum incompatible avec le rendement/équivalence d’une recette affectée est refusé avec le nom de la recette concernée.
- Les recettes et réglages rapides proposent les types configurés. « Préparations à faire » ajoute des groupes personnalisés. Les réglages sans minimum gardent le calcul actuel.
- Le moteur de besoins réserve le stock dans l’ordre des dates. Un manque inférieur au minimum génère la fabrication minimale ; les matières premières correspondantes sont intégrées dans les courses et le surplus virtuel couvre les menus ultérieurs. Une fois la fabrication enregistrée, les lots réels prennent le relais.
- Test intégré : quatre burgers demandant quatre bagels déclenchent un lot de 24 et 480 g de farine ; après production, 20 bagels restent disponibles, le prochain menu de quatre n’entraîne pas de production ni de nouvel achat.

## Validation

**319 tests complets réussis**, dont les tests de production, préparation, éditeur, suppression de recettes et propositions du calendrier. `git diff --check` avec `core.whitespace=cr-at-eol` et vérifications de syntaxe réussis. Aucun accès à Unraid/Nginx.

Version `package.json` : 0.3.1. Aucun accès à Unraid/Nginx ; le déploiement reste géré par l’utilisateur.

## Suite

Commit/push, créer une PR, fusionner après contrôles réussis et vérifier la publication GHCR. Ne pas déclarer 0.3.1 publiée avant la réussite du workflow sur `main`.
