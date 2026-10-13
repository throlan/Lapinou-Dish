# Brouillon récupérable : réserve kcal et occasions

**Non livré, non intégré et non validé comme fonctionnalité complète.** L'archive [energy-reserve-wip.patch](energy-reserve-wip.patch) conserve les travaux préparatoires de cette session pour un autre PC. Aucun fichier du patch n'est exécuté dans l'application tant qu'il n'est pas intégré explicitement.

## Besoin accepté

- Réserve individuelle pour les adultes, sans réserve ni restriction automatique appliquée aux adolescents. Elle est calculée sur une fenêtre glissante (30 jours par défaut, durée à rendre configurable si besoin).
- La réserve évolue automatiquement depuis les repas **planifiés** du calendrier. Pour chaque adulte et chaque journée, comparer le total prévu à l'objectif kcal daté : un total inférieur crédite la différence ; un total supérieur débite la différence disponible.
- Exemple : objectif de 1 850 kcal, repas planifiés à 1 760 kcal : +90 kcal. Le lendemain, 1 870 kcal planifiées : −20 kcal ; le solde de 90 devient 70 kcal.
- Une épargne supplémentaire facultative et choisie par l'utilisateur (par exemple 100 kcal pour une journée ou une période) réduit le budget kcal utilisé par le moteur de suggestion et déclenche le recalcul des portions. Elle ne constitue pas un deuxième crédit : le crédit final reste l'écart entre l'objectif initial et le total des repas planifiés. Exemple : objectif 1 850, budget réduit à 1 750, portions recalculées à 1 750 : la réserve reçoit 100 kcal, pas 200.
- Les crédits sont datés et expirent lorsqu'ils sortent de la fenêtre glissante. Lors d'un débit, utiliser d'abord les crédits les plus anciens (FIFO), afin que l'expiration reste déterministe.
- Case Occasion dans le repas : titre libre, sans recettes ni calcul nutritionnel détaillé obligatoire. Elle reçoit une estimation globale de kcal **par adulte** pour comptabiliser, par exemple, un repas festif (raclette, vin, dessert) qui ne rentre pas dans les plafonds habituels.
- Une occasion n'est pas soumise aux limites kcal habituelles du créneau ni au rééquilibrage automatique du jour ; son estimation débite la réserve. Ne pas imposer une saisie postérieure du repas : les calculs portent sur la planification.
- L'aperçu des changements de portions reste explicite et l'application contrôlée par l'utilisateur.

## Décisions fonctionnelles à préserver

- Aucun journal de consommation réelle ni confirmation après repas : l'utilisateur veut garder la gestion légère. Les totaux du calendrier restent des prévisions.
- Ne pas confondre l'épargne supplémentaire choisie (qui réduit le budget utilisé pour proposer les portions) et le crédit obtenu par comparaison du menu planifié à l'objectif quotidien initial.
- La réserve ne doit pas contraindre les repas ordinaires à rester sous l'objectif au prix de portions incohérentes ; les portions restent modifiables et le déficit de réserve doit rester visible.

## Points à décider avant intégration

- Si un dépassement prévu est supérieur au solde disponible : bloquer, avertir et autoriser explicitement, ou afficher une dette temporaire. Le comportement n'a pas encore été choisi.
- Si le coût estimé d'une occasion dépasse le solde : afficher le manque et laisser l'utilisateur décider, sans inventer de crédit.
- Définir la règle exacte de fenêtre (jour courant inclus, expiration au début ou à la fin du 30e jour) et la configuration d'une fenêtre hebdomadaire/mensuelle éventuelle.
- Confirmer comment le calendrier affiche une journée sans objectif kcal ou avec des données nutritionnelles incomplètes ; ne pas convertir des inconnues en zéro.

## Enrichissement des recettes accepté comme direction

- Structurer davantage une recette en composants indépendants (par exemple protéine, légumes, féculent), avec quantités et calculs nutritionnels propres à chaque composant et ajustement par personne.
- Prévoir des variantes explicites (par exemple avec/sans whey) dont les ingrédients et calculs sont distincts.
- Ces pistes sont séparées du chantier de réserve et ne justifient pas une saisie réelle après repas.

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

1. Reprendre le brouillon sur la version 0.2.41+ sans appliquer directement le patch construit sur 0.2.37.
2. Adapter toute proposition de portions aux **cinq créneaux** et aux réglages du foyer ; ne pas coder de parts fixes de repas.
3. Terminer l'intégration dans `web/app.js` : chargement de la réserve, formulaires d'occasion, estimations individuelles et affichage calendrier/accueil/solde/échéances.
4. Distinguer les contributions datées sur 30 jours glissants, leurs expirations, les débits FIFO, le budget réduit par l'épargne supplémentaire et l'estimation des occasions ; éviter les doubles réductions et crédits implicites.
5. Articuler occasions et rééquilibrage quotidien : l'occasion contourne les plafonds et le rééquilibrage, les repas ordinaires gardent les règles publiées.
6. Préserver explicitement les profils mineurs ; définir la confirmation adulte lorsque l'âge manque.
7. Utiliser une date du jour cohérente avec Europe/Paris et gérer les erreurs de base dans les routes d'action.
8. Tester les migrations et règles : fenêtre glissante/expiration, objectif daté, surplus puis déficit (90 puis 70 kcal), épargne choisie et absence de double comptage, occasion, données inconnues, duplication, aperçu obsolète et protections d'âge.
9. Vérifier le parcours dans Chrome sur données synthétiques, puis suivre le workflow GitHub habituel.

La préparation du patch ne constitue ni un déploiement, ni une modification de l'installation de l'utilisateur. Aucune action sur Unraid n'est autorisée.
