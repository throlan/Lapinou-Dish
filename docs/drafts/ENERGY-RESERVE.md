# Brouillon récupérable : réserve kcal et occasions

**Non livré, non intégré et non validé comme fonctionnalité complète.** L'archive [energy-reserve-wip.patch](energy-reserve-wip.patch) conserve les travaux préparatoires de cette session pour un autre PC. Aucun fichier du patch n'est exécuté dans l'application tant qu'il n'est pas intégré explicitement.

## Besoin accepté

- Réserve planifiée hebdomadaire ou mensuelle par adulte, sans restriction automatique pour les adolescents.
- Saisie d'une réserve quotidienne, par exemple 100 kcal, dans une période.
- Case Occasion dans le repas : titre libre, pas de recettes ni calcul nutritionnel détaillé obligatoire.
- Estimation globale des kcal **par adulte**, acceptée explicitement par l'utilisateur pour intégrer l'occasion au budget.
- Aperçu explicite des modifications de portions, avec application contrôlée ; réserve planifiée distincte d'un crédit réellement acquis.

## Provenance du brouillon

- Branche locale initiale : `feature/energy-reserve-occasions`.
- Stash archivé : `85b5dafdbcb388b64f0e8484d9c0f3fa76d23e1a` (`reserve-before-three-components`).
- Base du patch : `1346fad2e4175960d3c700b8501cfd9b48910359` (version 0.2.37).
- Quatre fichiers suivis modifiés et trois fichiers nouveaux, exportés ensemble. Aucun `.env`, secret, clé API, base personnelle ou capture utilisateur n'est inclus.

Le patch correspond à cette ancienne base, **pas à la version 0.2.41**. Ne pas l'appliquer directement sur `main`. L'examiner dans un checkout de travail séparé sur sa base, puis reprendre les changements utiles sur la version courante. Un des stashes plus anciens reste local et ne représente pas un chantier supplémentaire.

## Contenu préparé

- Migration `20261013_weekly_energy_reserve.sql` : périodes par personne, indicateur/titre d'occasion, estimation kcal individuelle.
- `src/server/energy-reserve.mjs` : validation des périodes, âge adulte, chevauchements, cumul occasion/réserve, aperçu et application de modifications.
- Routes `/api/energy-reserves`, suppression, aperçu et application dans `app.mjs`.
- Persistance et duplication des occasions dans `planning.mjs`.
- `web/energy-budget.js` et éléments HTML de configuration/aperçu.
- Paramètres de réserve dans `suggestQuantity`.

## À terminer avant livraison

1. Adapter les parts de réserve aux **cinq créneaux** et aux réglages du foyer. Le brouillon utilise encore quatre créneaux et des parts de déjeuner/dîner/collation codées en dur.
2. Terminer l'intégration dans `web/app.js` : chargement de la réserve, formulaires d'occasion, estimations individuelles, affichage calendrier/accueil/cumul et gestion des valeurs inconnues.
3. Articuler les aperçus avec le rééquilibrage quotidien existant ; éviter les doubles réductions et les crédits implicites.
4. Intégrer les nouveaux modes de service et la présentation compacte publiés après la base du patch.
5. Préserver explicitement les profils mineurs ; définir la confirmation adulte lorsque l'âge manque.
6. Utiliser une date du jour cohérente avec Europe/Paris et gérer les erreurs de base dans les routes d'action.
7. Tester contre les migrations réelles : limites semaine/mois, objectifs datés, chevauchements, occasions incomplètes, duplication, budget négatif, aperçu obsolète, retries, réduction des seuls profils autorisés.
8. Vérifier le parcours dans Chrome sur données synthétiques, puis suivre le workflow GitHub habituel.

La préparation du patch ne constitue ni un déploiement, ni une modification de l'installation de l'utilisateur. Aucune action sur Unraid n'est autorisée.
