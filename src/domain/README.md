# Lapinou Dish — noyau nutrition

Le noyau est du TypeScript pur, sans dépendance à Norish ni à un service externe.

- `src/domain/types.ts` définit les enregistrements canoniques aliments, lignes de recette, rendement et résultats nutritionnels.
- `src/domain/foods.ts` contient les conversions explicites et le calcul déterministe.
- `test/nutrition.test.ts` couvre recherche par alias, calcul par ingrédient, conversions, données manquantes et rendement.

Lancer `npm test` avec Node 24 ou supérieur.
