# Modèle métier

Ce modèle exprime les concepts métier, pas une liste exacte des tables implémentées. Account/Membership et les variantes indépendantes sont des évolutions à cadrer ; l’accès actuel utilise une session de foyer. Voir [STATUS.md](STATUS.md) pour le livré. Aucun journal de consommation après repas n’est demandé.

## Entités principales

- **Household** : espace privé et paramètres généraux.
- **Account / Membership** : connexion et permissions; peut être relié à une **Person**, mais une personne dépendante n'a pas besoin de compte.
- **Person** : profil du foyer avec identité d'affichage et préférences; peut exister sans compte de connexion.
- **PersonMeasurement** : relevé saisi par l'utilisateur, avec date et poids en kg; la taille en cm est historisée à chaque mise à jour. Les relevés hebdomadaires ne sont jamais générés automatiquement.
- **ActivityLevelHistory** : niveau d'activité choisi par l'utilisateur et date d'effet; les changements restent consultables.
- **DailyNeedEstimate** : besoin quotidien estimé, valeur, date, méthode et instantané des données utilisées (âge/taille/poids/activité disponibles), avec origine et validation explicites.
- **NutritionTarget** : nutriment, valeur, unité, date d'effet, origine (`manual`, `clinician`, `estimate`), méthode et état de validation. Une cible ne remplace ni les mesures ni une estimation de maintien.
- **Food** : fiche canonique globale, identifiant source optionnel, noms et alias, marque, valeurs nutritionnelles partielles pour 100 g, provenance et version.
- **FoodUnitConversion** : unité + aliment + quantité équivalente en grammes + source/preuve; conversion absente signifie impossible, pas équivalence 1:1.
- **Recipe** : titre, instructions, rendements nommés et catégories.
- **RecipeVariant** : choix explicite d'ingrédients optionnels/alternatifs (ex. sans whey / avec whey).
- **RecipeComponent** : catégorie logique d'un composant séparable (protéine, riz, légume, sauce); optionnelle pour recette mélangée.
- **RecipeLine** : `food_id`, quantité décimale, `unit_id`, état de l'aliment, composant, variante et ordre. Pas de nom alimentaire libre faisant autorité.
- **MealPlan / PlannedMeal / PlannedItem** : date, créneau, personnes présentes et recettes/composants prévus.
- **PlannedAmount** : quantité par personne et par élément/composant, avec unité claire. Les portions sont des quantités, pas une valeur implicite héritée d'un autre système.
- **ProductionSession / ProductionRun** : recettes/variantes, rendement cible et réel, étapes et date de fabrication.
- **StockLot / StockMovement** : lot produit/acheté, quantité disponible, état, emplacement et mouvements explicites de production, consommation, perte ou correction.
- **ShoppingList / ShoppingLine** : besoin agrégé, unité d'achat, format de paquet, quantité proposée, stock déduit et état de validation.
- **ImportDraft / ImportDraftLine** : texte/source d'origine et suggestions non validées. À validation, les lignes deviennent des références canoniques `RecipeLine`.

## Source de vérité et calculs

1. `Food` est la seule source des noms canoniques et nutriments des aliments.
2. `RecipeLine` est la seule source de la composition et des quantités d'une recette.
3. Un calcul nutritionnel est une fonction déterministe des lignes, de leurs conversions documentées, de la variante et du rendement demandé.
4. Une valeur inconnue produit un résultat partiel/incomplet. Aucune inconnue n'est convertie en zéro.
5. Les apports sont prévisionnels, calculés depuis le calendrier ; aucun journal nutritionnel du consommé n’est tenu.
6. Les mesures corporelles et niveaux d'activité sont des données saisies par l'utilisateur et datées; une modification ajoute une entrée, elle ne réécrit pas l'historique.
7. Une estimation de besoin quotidien conserve sa méthode, ses entrées, sa provenance et sa validation; elle n'est pas confondue avec une cible alimentaire.
8. Le stock se calcule par mouvements explicites. Planifier réserve sans sortie physique ; une production ou un repas marqué « Préparé » déduit les ingrédients sans double prélèvement pour un batch déjà produit.
9. Les unités restent qualifiées par état: g cru, g sec, g cuit ne sont jamais substitués silencieusement.

## Relations structurantes

```text
Food 1 ── * RecipeLine * ── 1 Recipe
Recipe 1 ── * RecipeVariant
Recipe 1 ── * RecipeComponent (optional)
PlannedMeal 1 ── * PlannedItem ── 1 Recipe
PlannedItem 1 ── * PlannedAmount ── 1 Person
ProductionRun 1 ── * StockLot 1 ── * StockMovement
```

## Invariants à tester

- Unicité des références: recette + aliment/unité/composant/variante peuvent être répétées si la recette l'explicite, mais doublons accidentels sont signalés.
- Chaque ligne active référence un aliment; les imports non résolus restent des brouillons et ne sont pas comptés dans un calcul complet.
- La somme des quantités attribuées + restes correspond au rendement produit/prévu dans la même unité de rendement.
- Une quantité volumique ne donne une masse qu'avec conversion générique valide ou facteur spécifique documenté.
- Une édition de fiche alimentaire recalcule l'affichage actuel des recettes; les quantités sauvegardées des repas restent conservées, sans recalcul implicite des portions.
- Les profils/mesures n'apparaissent ni dans des événements publics, ni des journaux ordinaires, ni dans des fixtures réelles.
- Un relevé de poids est explicite, saisi par l'utilisateur et daté; aucune mesure manquante n'est extrapolée.
- Les estimations et objectifs restent distincts; les changements de profil ne réécrivent ni les relevés passés ni les mesures historisées.
