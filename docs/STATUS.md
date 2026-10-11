# Architecture checkpoint

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
- Recipe editing displays a selected canonical food only once; incomplete nutrition results identify the ingredient and whether its conversion or nutrient values are missing.
- Imported recipe instructions and source links are stored on the recipe record. ZIP import skips entries without ingredients so planning notes do not become recipes.
- Desktop-first working UI for catalog editing and recipe nutrition calculated from linked foods.
- Reference units and nutrient vocabulary for recipes and nutrition calculations.
- Password-protected app sessions, login throttling, security headers, and a public health check for container monitoring.
- Docker Compose test setup, production container, ordered startup migrations, idempotent Ciqual import, GitHub Actions container workflow, and Unraid templates.

## Verification

`node --experimental-strip-types --test test/*.test.ts test/*.test.mjs` — 33 tests passing. JavaScript syntax checks pass. PostgreSQL integration is not yet exercised on this workstation; Docker, PostgreSQL client, and npm are unavailable here.

## Next

1. Install the templates on Unraid and verify the first-start migrations and Ciqual import.
2. Verify migrations, Ciqual import, food edits and recipe calculations against a real PostgreSQL 16 instance (Docker Compose or Unraid).
3. Add URL content extraction for social sources where the source makes captions or transcripts available; Instagram and YouTube links currently need their caption/transcript pasted with the link.
4. Add recipe variants/components and clear per-ingredient missing-data details.
5. Add meal planning and connect recipes to the desktop calendar.
6. Validate the Unraid templates and update process on the target server before treating the deployment as production-ready.
