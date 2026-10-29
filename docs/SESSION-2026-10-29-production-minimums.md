# Session du 29 octobre 2026 — administration et lots par recette

## Demande

Corriger l’enregistrement des types de production lors du premier ajout, rendre l’administration navigable par rubriques et définir les tailles minimales de fabrication sur chaque recette. Un pain peut être fabriqué entier, des bagels par 24 et des pancakes par 36 ; les ingrédients du lot sont ajoutés aux besoins et le surplus fini reste disponible pour les repas suivants.

## Réalisation livrée — 0.3.3

- L’administration charge maintenant les types de production lors de son ouverture. Elle est organisée en sept onglets accessibles au clavier.
- Les types de production servent au classement. Le lot minimum et son unité sont enregistrés sur chaque recette.
- Le minimum est converti en rendement au moyen des équivalences explicites de la recette. Une recette de pain avec un rendement de 350 g et les équivalences 1 pièce / 10 tranches peut ainsi être réglée à un pain entier.
- Les préparations calculent les ingrédients du lot complet. Les unités produites non utilisées sont conservées en stock et réservées chronologiquement aux menus suivants.
- La migration reprend l’ancienne taille partagée seulement quand une seule recette racine était associée à ce type. En cas de plusieurs recettes, les minimums restent à zéro pour éviter de propager une valeur commune qui ne conviendrait pas forcément à chaque recette.

## Vérification

- 324 tests locaux réussis, dont migration PostgreSQL de test, administration, équivalences pain/bagels/pancakes, achats du lot, stock et menus suivants.
- `node --check` réussi sur les modules serveur et le JavaScript navigateur.
- `git diff --check` réussi.
- PR #142 fusionnée au commit `f997a39eb1a23d12e276e8ac5b815036d77f2421` ; contrôles GitHub réussis.
- Publication : https://github.com/throlan/Lapinou-Dish/actions/runs/40905467035. Image `ghcr.io/throlan/lapinou-dish:0.3.3`, digest `sha256:dc2ec2fafaf286712f99a4b1dd4e3fd17326e5e05ae9bf6ff1d8debff5026a73`.
- Aucun accès à Unraid ou Nginx.

## Suite

Garder les tailles de lots configurées recette par recette, en renseignant leurs équivalences explicites pour les mesures utiles (pain/pièce/tranche, bagel/pièce, pancake/pièce). Le prochain chantier fonctionnel reste à choisir avec l’utilisateur.
