# Architecture checkpoint

## Mise à jour du 13 octobre 2026 — accueil, courses et bases surveillées

L'accueil charge la semaine commençant le lundi et la liste de courses exécute ses requêtes sans noms de colonnes ambigus. Les aliments du foyer peuvent être surveillés avec inventaire en grammes, minimum, cible et délai de commande. Les nouvelles productions déduisent les ingrédients suivis dans la même transaction que l'ajout du lot fini. Les alertes tiennent compte des repas prévus et les courses déduisent stocks finis et ingrédients surveillés.

94 tests passent, dont des tests PostgreSQL embarqués exécutant les migrations et les requêtes réelles. Le parcours a aussi été vérifié dans Chrome sur données synthétiques : connexion, accueil un mardi, courses, inventaire, production de 24 muffins et alerte de commande. L'installation Unraid reste gérée exclusivement par l'utilisateur.

Voir [le guide des ingrédients surveillés](INGREDIENT-STOCK.md). Le journal de consommation réelle reste à développer. Les sections ci-dessous décrivent le checkpoint initial et ne constituent plus la liste exhaustive des fonctionnalités actuelles.

## Implemented

- Independent repository and product/domain documents.
- Canonical `Food` records and alias-based lookup; recipe lines refer to `foodId` only.
- Explicit mass, density, and food-specific unit conversion rules.
- Deterministic nutrient calculation for batch and per-yield-unit values.
- Missing data remains unknown and is tracked per nutrient; an unresolved ingredient blocks totals rather than being silently omitted.
- PostgreSQL schema for household people, dated targets, foods/aliases/nutrients, recipe yields/variants/components/lines, and reviewable import drafts.
- Attributed Ciqual 2025 reference dataset copied as data only (3,484 foods); no Norish runtime code or schema is included.
- Repeatable Ciqual SQL seed generation with stable IDs (3,484 foods, 17,420 nutrient values, canonical and English search aliases).
- Initial PostgreSQL migration runner and API for household setup, paginated canonical food search, manual food creation/edit with audit history, and structured recipe creation/read.
- Saved recipes can be listed and edited; ingredient lines are replaced transactionally and nutrition is recalculated from the current canonical food records.
- Recipe intake can save pasted captions/text and Tandoor or Norish ZIP archives as reviewable drafts. Ingredient names and claimed nutrition remain source material; a draft only becomes a recipe after every line is linked to canonical foods, and saved recipe totals are calculated from those foods.
- Recipe review now searches the catalog immediately using each imported ingredient label, so suggestions appear without editing the imported text.
- Food search matches significant words in an imported label despite accents, plural forms, or wording order; recipe review explains when no catalog result exists.
- An unmatched imported ingredient can create a canonical catalog record with unknown nutrition, so the recipe line can be saved without guessed values. The food catalogue can be filtered to required nutrition values that still need completion.
- Recipe review keeps the imported label only while no catalog match is selected; once matched, only the canonical food remains visible. Incomplete nutrition results identify the ingredient and whether its conversion or nutrient values are missing.
- Common egg, onion and garlic aliases and estimated piece weights are added to the shared Ciqual catalog. Search ranks foods that support the selected recipe unit. Reconstituted beef broth has common aliases and a documented estimated density for ml-based quantities.
- Missing nutrient values on an edited food can be searched against Ciqual 2025. The user sees the candidate values and explicitly applies them; only null nutrient fields are filled, known values and zeros are preserved, and the source reference is recorded.
- Recipe ingredient rows now show the canonical match without repeating the imported label; the search box returns through an explicit “Changer l’aliment” action. Incomplete foods have a visible “Compléter” shortcut that opens their Ciqual suggestions.
- Imported recipe instructions and source links are stored on the recipe record. ZIP import skips entries without ingredients so planning notes do not become recipes.
- Desktop-first working UI for catalog editing and recipe nutrition calculated from linked foods.
- Reference units and nutrient vocabulary for recipes and nutrition calculations.
- Password-protected app sessions, login throttling, security headers, and a public health check for container monitoring.
- Docker Compose test setup, production container, ordered startup migrations, idempotent Ciqual import, GitHub Actions container workflow, and Unraid templates.

## Verification

`node --experimental-strip-types --test test/*.test.ts test/*.test.mjs` — 39 tests passing. PostgreSQL integration is not yet exercised on this workstation; Docker, PostgreSQL client, and npm are unavailable here.

## Next

1. Install the templates on Unraid and verify the first-start migrations and Ciqual import.
2. Verify migrations, Ciqual import, food edits and recipe calculations against a real PostgreSQL 16 instance (Docker Compose or Unraid).
3. Add URL content extraction for social sources where the source makes captions or transcripts available; Instagram and YouTube links currently need their caption/transcript pasted with the link.
4. Add recipe variants/components and clear per-ingredient missing-data details.
5. Add meal planning and connect recipes to the desktop calendar.
6. Validate the Unraid templates and update process on the target server before treating the deployment as production-ready.
