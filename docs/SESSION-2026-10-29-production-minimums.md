# Session du 29 octobre 2026 — administration et lots par recette

## Demande

Corriger l’enregistrement des types de production lors du premier ajout, rendre l’administration navigable par rubriques et définir les tailles minimales de fabrication sur chaque recette. Un pain peut être fabriqué entier, des bagels par 24 et des pancakes par 36 ; les ingrédients du lot sont ajoutés aux besoins et le surplus fini reste disponible pour les repas suivants.

## Réalisation en préparation — 0.3.3

- L’administration charge maintenant les types de production lors de son ouverture. Elle est organisée en sept onglets accessibles au clavier.
- Les types de production servent au classement. Le lot minimum et son unité sont enregistrés sur chaque recette.
- Le minimum est converti en rendement au moyen des équivalences explicites de la recette. Une recette de pain avec un rendement de 350 g et les équivalences 1 pièce / 10 tranches peut ainsi être réglée à un pain entier.
- Les préparations calculent les ingrédients du lot complet. Les unités produites non utilisées sont conservées en stock et réservées chronologiquement aux menus suivants.
- La migration reprend l’ancienne taille partagée seulement quand une seule recette racine était associée à ce type. En cas de plusieurs recettes, les minimums restent à zéro pour éviter de propager une valeur commune qui ne conviendrait pas forcément à chaque recette.

## Vérification

- 324 tests locaux réussis, dont migration PostgreSQL de test, administration, équivalences pain/bagels/pancakes, achats du lot, stock et menus suivants.
- `node --check` réussi sur les modules serveur et le JavaScript navigateur.
- `git diff --check` réussi.
- PR, contrôles GitHub, fusion et publication GHCR restent à vérifier.
- Aucun accès à Unraid ou Nginx.

## Suite

Pousser la branche, ouvrir une PR, attendre ses contrôles, puis fusionner selon le workflow du projet et vérifier la publication GHCR. Après la fusion, mettre à jour les documents avec le numéro de PR, le commit, les contrôles et la publication effectivement observés.
