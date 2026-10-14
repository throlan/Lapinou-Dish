# Objectifs kcal, portions et rééquilibrage

## Profils et répartition

Les profils se trouvent dans **Administration**, sous forme de fiches à déplier. Le besoin quotidien est saisi avec une date d'effet et une origine ; l'application ne le déduit pas automatiquement de la taille, de l'activité ou du poids.

La répartition commune au foyer est modifiable dans la même vue. Le total doit faire 100 %. Valeurs par défaut :

| Créneau | Part du besoin quotidien |
| --- | ---: |
| Petit-déjeuner | 15 % |
| Déjeuner | 40 % |
| Collation après-midi | 10 % |
| Dîner | 25 % |
| Collation du soir | 10 % |

L'objectif d'un repas vaut `besoin quotidien × part du créneau`. Les recettes marquées Collation sont éligibles aux deux collations. Modifier la répartition actualise les objectifs et les prochaines suggestions ; les quantités sauvegardées ne sont pas remplacées automatiquement.

## Affichage

Dans l'éditeur, chaque personne a une ligne avec kcal prévues / objectif du repas et protéines prévues / repère de 40 g. Les choix de boissons et desserts individuels entrent dans les totaux. Les valeurs inconnues restent visibles.

Le calendrier affiche en bas de chaque jour les kcal prévues / objectif quotidien de chaque personne. Les cinq créneaux sont cumulés, avec la version du profil applicable à cette date. Un total incomplet est indiqué comme tel ; il ne représente pas une consommation réelle.

## Propositions de portions

Le calcul réserve au créneau sa part du budget, avec une marge de 100 kcal et la limite du budget quotidien restant. Le badge conserve l'objectif strict, ce qui peut donner un dépassement de créneau même lorsque la journée reste sous son objectif.

Les suggestions respectent les unités naturelles et les plafonds de portions. Le plat en grammes et les légumes séparés sont plafonnés à une portion moyenne du batch, arrondie vers le bas à 10 g. Au petit-déjeuner principal : deux pièces, une portion, ou poids estimé correspondant à deux pièces pour une préparation dérivée d'un rendement en pièces. La recherche des 40 g de protéines ne peut pas dépasser ces plafonds.

La saisie manuelle reste libre. Pour un repas existant, **Recalculer les portions** relance explicitement les suggestions ; la réouverture et la duplication conservent les quantités enregistrées.

## Rééquilibrer une journée

Le bouton **Rééquilibrer** apparaît lorsque le total dépasse l'objectif ou lorsqu'un petit-déjeuner dépasse son plafond de proposition. Il ouvre un aperçu avant toute modification.

Pour un profil adulte, actif, avec date de naissance, objectif et nutrition connus :

1. Le plat principal du petit-déjeuner est ramené à son plafond si nécessaire.
2. Si le total quotidien dépasse encore l'objectif, le calcul répartit les réductions sur les portions ajustables du déjeuner et du dîner.
3. Les réductions préservent 40 g de protéines à chacun de ces repas, ou l'apport initial si celui-ci était déjà inférieur. Les quantités restent positives et respectent les pas d'unité.

Les boissons, desserts et collations ne sont pas réduits. Les profils mineurs, inactifs, sans âge ou sans objectif ne sont pas ajustés. Les données inconnues empêchent une réduction automatique fondée sur un total partiel. Les limites rencontrées et le dépassement restant sont affichés ; le calcul ne garantit pas toujours de rejoindre exactement l'objectif.

**Appliquer ces quantités** sauvegarde les propositions dans une transaction. Un changement de planning, recette, nutrition ou profil depuis l'aperçu impose un nouveau calcul. Réappliquer un ancien aperçu ne réduit pas une deuxième fois les portions.

Le rééquilibrage change les prévisions et les réservations liées aux repas, pas les stocks physiques ni les mouvements d'ingrédients déjà enregistrés. Les parties liées d'une assiette sont réduites ensemble pour conserver leurs proportions saisies. La composition des nouvelles propositions se règle séparément dans Administration : voir [les proportions en grammes](SERVING-GRAMS.md). Aucun journal de consommation réelle n'est souhaité.

## Repères techniques

- Répartition partagée et validation : `web/meal-config.js` ; API `GET/PUT /api/meal-settings`.
- Propositions, plafonds et cumuls : `web/portion-planner.js`.
- Rééquilibrage : `src/server/daily-rebalance.mjs` ; API `GET /api/planning/rebalance-preview` et `POST /api/planning/rebalance`.
- Aperçu signé par empreinte SHA-256 de ses entrées et propositions ; application transactionnelle avec verrou du foyer et isolation sérialisable.
- Tests : `test/meal-settings.test.mjs`, `test/meal-energy-summary.test.mjs`, `test/automatic-main-portions.test.mjs`, `test/daily-rebalance.test.mjs`.
