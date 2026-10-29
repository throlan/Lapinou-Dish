# Session du 29 octobre 2026 — catégories personnalisées et rôle de repas

## Correctif 0.3.2

Le calendrier filtrait certaines recettes personnalisées avec le type du rôle standard. Une recette `custom-assaisonnement` associée à une catégorie Assaisonnement de rôle Sauce n’était donc pas proposée dans le choix individuel. Les filtres appliquent désormais les restrictions de type standard seulement quand aucune catégorie explicite n’est demandée.

Le rôle Sauce appliquait aussi son défaut de 30 g à ces recettes personnalisées. Elles commencent maintenant à une unité, sans changer les défauts historiques des sauces et desserts standards. Le rôle reste une classification et ne duplique pas une recette ; deux catégories configurées séparément peuvent cependant présenter deux boutons distincts.

Validation : **321 tests complets réussis**, tests ciblés réussis, `node --check web/app.js` et vérification du diff réussis. PR #140 fusionnée au commit `d17030f18ba4546334cf78b6e116b1f1c4863baf`. Publication GHCR réussie : https://github.com/throlan/Lapinou-Dish/actions/runs/40858994728. Image `ghcr.io/throlan/lapinou-dish:0.3.2`, digest `sha256:09d71fc82d9e6862f7a982bdeb5b3d6cdb84a6e9cbeed24cc02661733a25ee5a`.

Aucun accès à Unraid ou Nginx. L’utilisateur gère le déploiement.
