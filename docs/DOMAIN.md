# Modèle métier

## Suivi automatique — 0.17.0

La migration additive 20261119_automatic_activity.sql crée person_automatic_profiles (faits médicaux privés datés), person_automatic_state (empreinte et résultat courant), person_activity_plans (disponibilités datées) et person_activity_sessions (réalisé, annulation conservée). Les cibles calculées sont ajoutées à person_nutrition_goals avec origine estimate, version de modèle et questionnaire contenant entrées/résultat/sources. Les historiques antérieurs ne sont pas modifiés.

Le serveur calcule avec web/automatic-nutrition.js, partagé et déterministe. Verrou par personne dans la transaction de requête ; empreinte du résultat et période mensuelle pour éviter les répétitions. Recalcul après enregistrement des faits/pesées/objectifs/profil et à la lecture des profils pour les anniversaires et données devenues applicables. Les POST d’activité utilisent une clé de requête UUID : même contenu rejoué sans doublon, contenu différent refusé. API et RLS limitent les faits médicaux, programmes et séances à la personne concernée ou au gestionnaire de son foyer.

web/automatic-profile-ui.js est commun à Mon compte et Administration, remplace les formulaires nutritionnels manuels et distingue prévu/réalisé. web/activity-model.js calcule localement la projection réduite Hall ; aucune donnée de santé envoyée à une API extérieure. Les cibles peuvent changer automatiquement ; les rééquilibrages des quantités de menus restent volontaires. Modèles et limites : [ACTIVITE-PROJECTION.md](ACTIVITE-PROJECTION.md).


## Cibles nutritionnelles — 0.15.0

person_nutrition_goals conserve les cibles kcal/protéines confirmées, leurs dates d’effet, origine, méthode, poids de référence et ordre de révision. Les anciennes données restent conservées ; la table initiale nutrition_targets reste historique et n’est pas le support du nouveau formulaire. La vue effective_energy_history réunit les calories historiques et les nouvelles cibles avec priorité déterministe. Les droits du profil sont appliqués dans la passerelle API et par RLS.

web/nutrition-goals.js partage entre Administration et Mon compte l’estimation générale documentée, les bilans mensuels et l’aperçu de validation. Le calendrier et le serveur lisent la cible applicable à la date. Les protéines restent indicatives ; aucune réécriture de menu ni action sur stock. Le bilan suit les anniversaires mensuels de la première pesée et le seuil ±5 kg depuis le poids de référence validé. Aucun calcul ne devient une cible automatiquement.

Ce modèle exprime les concepts métier, pas une liste exacte des tables implémentées. En 0.13.1, comptes, appartenances et rôles par foyer, profils sans compte, variantes par listes de choix, portions individuelles, rééquilibrage journalier, stocks et batch cooking sont livrés. Les entités d’estimation et de cible nutritionnelle décrites ci-dessous incluent encore des intentions : voir les écarts explicites dans [STATUS.md](STATUS.md) et les lots dans [TODO.md](TODO.md). Aucun journal de consommation après repas n’est demandé.

## Entités principales

- **Household** : espace privé et paramètres généraux.
- **Account / Membership** : connexion et permissions; peut être relié à une **Person**, mais une personne dépendante n'a pas besoin de compte.
- **Person** : profil du foyer avec identité d'affichage et préférences; peut exister sans compte de connexion.
- **PersonMeasurement** : relevé saisi par l'utilisateur, avec date et poids en kg. Le poids mesuré est distinct du poids de forme et de l’objectif de poids à ajouter. Les relevés hebdomadaires ne sont jamais générés automatiquement. Actuellement, un relevé à une date déjà utilisée est refusé.
- **ActivityLevelHistory** : niveau d'activité choisi par l'utilisateur et date d'effet; les changements restent consultables.
- **DailyNeedEstimate (à développer)** : besoin quotidien estimé, valeur, date, méthode et instantané des données utilisées (âge/taille/poids/activité disponibles), avec origine et validation explicites. Aucun estimateur Mifflin–St Jeor n’existe encore.
- **NutritionTarget (schéma seulement)** : nutriment, valeur, unité, date d'effet, origine (`manual`, `clinician`, `estimate`), méthode et état de validation. La table existe mais n’est utilisée ni par les écrans ni par les calculs. La cible kcal actuelle vit dans l’historique de profil ; les objectifs protéiques sont des réglages du foyer avec certains secours liés au prénom. Une cible ne remplace ni les mesures ni une estimation de maintien.
- **Food** : fiche canonique globale, identifiant source optionnel, noms et alias, marque, valeurs nutritionnelles partielles pour 100 g, provenance et version.
- **FoodUnitConversion** : unité + aliment + quantité équivalente en grammes + source/preuve; conversion absente signifie impossible, pas équivalence 1:1.
- **Recipe** : titre, instructions, rendements nommés et catégories.
- **RecipeVariant** : choix explicite d'ingrédients optionnels/alternatifs, via des listes réutilisables et un instantané de la combinaison utilisée ; les variantes indépendantes de chaque participant ne sont pas impliquées.
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
6. Les mesures corporelles et niveaux d'activité sont des données saisies par l'utilisateur et datées. Actuellement, une correction de profil à la même date remplace l’entrée ; conserver chaque révision est le premier lot à développer.
7. Une future estimation de besoin quotidien devra conserver sa méthode, ses entrées, sa provenance et sa validation ; elle ne sera pas confondue avec une cible alimentaire.
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
