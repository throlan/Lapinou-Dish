# Archive de conception : réserve kcal et occasions

**Fonctionnalité livrée dans la version 0.2.42 (PR 53).** Ce document conserve les décisions et le contexte de conception. Les checklists d'intégration plus bas décrivent le travail préparatoire historique et ne sont plus le reste à faire courant. L'archive `energy-reserve-wip.patch` est un ancien brouillon construit sur 0.2.37 et ne doit pas être appliquée.

## Besoin accepté

- Réserve individuelle pour les adultes, sans réserve ni restriction automatique appliquée aux adolescents. Elle est calculée sur une fenêtre glissante (30 jours par défaut, durée à rendre configurable si besoin).
- La réserve évolue automatiquement depuis les repas **planifiés** du calendrier. Pour chaque adulte et chaque journée, comparer le total prévu à l'objectif kcal daté : un total inférieur crédite la différence ; un total supérieur débite la différence disponible.
- Exemple : objectif de 1 850 kcal, repas planifiés à 1 760 kcal : +90 kcal. Le lendemain, 1 870 kcal planifiées : −20 kcal ; le solde de 90 devient 70 kcal.
- Une épargne supplémentaire facultative et choisie par l'utilisateur (par exemple 100 kcal pour une journée ou une période) réduit le budget kcal utilisé par le moteur de suggestion et déclenche le recalcul des portions. Elle ne constitue pas un deuxième crédit : le crédit final reste l'écart entre l'objectif initial et le total des repas planifiés. Exemple : objectif 1 850, budget réduit à 1 750, portions recalculées à 1 750 : la réserve reçoit 100 kcal, pas 200.
- Les crédits sont datés et expirent lorsqu'ils sortent de la fenêtre glissante. Lors d'un débit, utiliser d'abord les crédits les plus anciens (FIFO), afin que l'expiration reste déterministe.
- La fenêtre implémentée est de 30 jours calendaires, jour de référence inclus. Les crédits et débits connus expirent au-delà de cette fenêtre ; la dépense consomme les crédits les plus anciens en premier.
- Case « Repas exceptionnel, hors quotas — utiliser l'épargne » dans le repas : titre libre, sans recettes ni calcul nutritionnel détaillé obligatoire. Elle reçoit une estimation kcal **par personne présente** pour comptabiliser, par exemple, un repas festif (raclette, vin, dessert) qui ne rentre pas dans les plafonds habituels.
- Une occasion n'est pas soumise aux limites kcal habituelles du créneau ni au rééquilibrage automatique du jour ; son estimation débite la réserve. Ne pas imposer une saisie postérieure du repas : les calculs portent sur la planification.
- Si une journée dépasse les crédits disponibles, le solde peut devenir négatif avec un avertissement visible ; l'enregistrement du repas exceptionnel reste possible.
- Une épargne supplémentaire par adulte peut être programmée sur une période de 1 à 30 jours. Elle réduit le budget des portions ordinaires ; le crédit calculé reste `objectif initial - total planifié`, donc il n'y a pas de double crédit.
- Les nouvelles suggestions prennent ce budget réduit en compte. Pour les repas déjà planifiés, le calendrier propose un aperçu de rééquilibrage avant application ; les portions des adolescents restent conservées.

## Décisions fonctionnelles à préserver

- Aucun journal de consommation réelle ni confirmation après repas : l'utilisateur veut garder la gestion légère. Les totaux du calendrier restent des prévisions.
- Ne pas confondre l'épargne supplémentaire choisie (qui réduit le budget utilisé pour proposer les portions) et le crédit obtenu par comparaison du menu planifié à l'objectif quotidien initial.
- La réserve ne doit pas contraindre les repas ordinaires à rester sous l'objectif au prix de portions incohérentes ; les portions restent modifiables et le déficit de réserve doit rester visible.

## Reste à valider avant publication

- Vérifier le parcours complet avec PostgreSQL/PGlite : migration, sauvegarde/édition/duplication d'une occasion, aperçu de rééquilibrage avec épargne et cas d'objectif daté.
- Vérifier l'interface dans Chrome sur des données synthétiques ; les tests visuels et les tests d'intégration PostgreSQL n'ont pas été exécutés dans ce worktree.
- Contrôler que les jours sans menu ou avec des kcal inconnues ne créditent jamais la réserve ; les données inconnues ne deviennent pas des zéros.

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

L'implémentation locale ne constitue ni une publication, ni un déploiement, ni une modification de l'installation de l'utilisateur. Aucune action sur Unraid n'est autorisée.
