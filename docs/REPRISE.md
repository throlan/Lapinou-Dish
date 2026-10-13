# Cahier de reprise — fin de journée du 13 octobre 2026

## Point de départ

- Dépôt : https://github.com/throlan/Lapinou-Dish
- Branche de référence : `main`, commit de la PR 58 : `ee99abd1922ee1d4780b486522b41cdfbcf4bf28`.
- Dernière version applicative publiée : **0.2.47**, après la [PR 58](https://github.com/throlan/Lapinou-Dish/pull/58). Elle comprend le compte épargne kcal (PR 53), la navigation depuis les courses vers les recettes (PR 54–55), les quantités par recette (PR 56), l'arrondi des pièces (PR 57), les conditionnements d'achat et la suppression protégée d'aliments (PR 58).
- Journal détaillé : [SESSION-2026-10-13.md](SESSION-2026-10-13.md). État et tâches restantes : [STATUS.md](STATUS.md).
- Tests de l'état actuel : **146 tests réussis** avec Node v24.19.0.
- Travail à reprendre : la branche distante `fix/shopping-list-scroll-handoff` contient le correctif de défilement et les documents de reprise. Les 146 tests passent, mais le parcours navigateur n'a pas encore été vérifié et il n'y a pas encore de PR.

## Règle d'exploitation impérative

**L'agent ne doit jamais accéder à Unraid, le vérifier, le modifier ou y déployer quoi que ce soit. L'utilisateur effectue lui-même toutes les mises à jour.** Le périmètre autorisé est le développement local, GitHub, les contrôles CI et la vérification de publication de l'image.

## Reprendre sur un autre PC

1. Retrouver ou cloner le dépôt. Lire les éventuels `AGENTS.md`, puis exécuter `git status --short`, `git branch --show-current` et `git log -5 --oneline`.
2. Préserver tout travail local. Ne pas utiliser de reset destructif, suppression de fichiers, nettoyage forcé ou écrasement des modifications.
3. Récupérer `origin/main`. Un checkout propre sur `main` peut être mis à jour par `git pull --ff-only`. Si le checkout contient des changements ou une autre branche, inspecter avant de changer de base.
4. Vérifier la version de `package.json` et lire [l'état du projet](STATUS.md), [le journal de session](SESSION-2026-10-13.md), ce cahier et [le guide kcal](MEAL-ENERGY.md).
5. Travailler avec une base locale dédiée et des données synthétiques. Ne pas importer les données de santé du foyer, secrets ou captures personnelles dans Git.

Le chemin du checkout sur le PC de cette session est `C:\Users\Plex\OneDrive\Documents\GitHub\Lapinou-Dish`. Ce chemin n'est pas supposé identique sur l'autre machine.

## Fonctionnement actuel à préserver

- Catalogue alimentaire canonique ; calculs depuis les ingrédients, densités et conversions documentées. Données manquantes explicitement inconnues.
- Recettes : types Plat, Boisson, Accompagnement, Dessert ; moments séparés et filtres persistants. Les tags et le type se restaurent dans l'éditeur.
- Service : préparation entière, deux parties viande-légumes + féculents, ou trois parties viande/protéines + légumes + féculents. Grammes estimés, sans pesée obligatoire après cuisson. Une lasagne reste un plat mélangé.
- Les ingrédients apparaissent dans des blocs distincts. Les liens de changement et de nutrition sont en bas ; le coefficient individuel apparaît pour un féculent sélectionné, y compris intégré dans un plat mélangé.
- Cinq créneaux : petit-déjeuner, déjeuner, collation après-midi, dîner, collation du soir. Répartition commune au foyer, modifiable dans Administration : **15 / 40 / 10 / 25 / 10 %**, total validé à 100 %.
- Les besoins kcal sont saisis dans les profils datés ; ils ne sont pas recalculés automatiquement à partir de la taille, du poids ou de l'activité.
- Profils compacts et repliables dans Administration ; création de personne également repliable. Le bouton Gérer les profils conduit à cette vue.
- Calendrier allégé : titres centrés sur le plat principal et l'accompagnement, participants, total du repas et duplication. Bilan quotidien kcal prévues / objectif pour chaque personne en bas de chaque jour.
- Éditeur de repas : une ligne par personne, kcal puis protéines, ordre Bibinette, Lapinou, Bibou, Titus. Boissons et desserts individuels sont inclus dans les totaux.
- Les propositions restent modifiables. Les repas sauvegardés ne sont pas recalculés à leur réouverture ou duplication. Le bouton Recalculer les portions est explicite.
- Plafond de proposition du plat en grammes : portion moyenne du batch, arrondie vers le bas à 10 g ; légumes séparés également plafonnés. Petit-déjeuner principal : deux pièces, une portion, ou poids correspondant à deux pièces pour une préparation dérivée en grammes.
- Rééquilibrer : aperçu puis application explicite. Corrige d'abord le petit-déjeuner des adultes, puis réduit si nécessaire les quantités ajustables du déjeuner et du dîner. Boissons/desserts conservés, profils mineurs exclus, âge ou nutrition inconnus signalés. Un aperçu devenu obsolète est refusé.
- Stocks : productions atomiques, déduction unique des ingrédients surveillés, minimum/cible/délai de commande, annulation de lot avec restauration unique. Les courses tiennent compte des réservations et stocks disponibles.
- Import OpenAI optionnel : brouillons à vérifier ; tentative de récupération de description Instagram avec repli sur le texte collé si la lecture est bloquée. Aucune clé à coller dans la conversation ou à committer.

## Travail livré : réserve kcal et occasions

Le système a été livré en **0.2.42** (PR 53). Les décisions détaillées et exemples restent archivés dans [le document de réserve](drafts/ENERGY-RESERVE.md). Règles essentielles à préserver :

- Le solde adulte est calculé depuis les repas planifiés, jour par jour, sur une fenêtre glissante de 30 jours par défaut. Sous l'objectif quotidien daté : crédit de la différence ; au-dessus : débit du solde, en utilisant les crédits les plus anciens d'abord.
- Exemple validé : objectif de 1 850 kcal et menu planifié à 1 760 kcal = +90 kcal ; le lendemain, 1 870 kcal = −20 kcal ; solde : 70 kcal.
- Une épargne supplémentaire choisie par l'utilisateur réduit le budget servant à recalculer les portions. Le crédit réel reste calculé une seule fois depuis l'objectif initial (1 850 − menu à 1 750 = +100, et non +200).
- Une occasion (ex. raclette, vin et dessert) reçoit une estimation globale par adulte, contourne les limites kcal ordinaires et le rééquilibrage, puis débite la réserve. Si le solde ne suffit pas, il peut devenir négatif avec un avertissement ; le repas reste enregistrable.
- Pas de saisie après repas ni de journal du consommé : le calendrier porte des prévisions et doit rester léger.

Les totaux affichés sont des prévisions ; aucune saisie de consommation réelle après repas n'est souhaitée. L'ancienne archive et son patch ne sont pas à réappliquer.

## Travail à reprendre demain

Le correctif de `fix/shopping-list-scroll-handoff` empêche le défilement de la liste de courses de sauter en bas lorsque le format d'un paquet change. Il met à jour la seule ligne concernée au lieu de recréer toute la liste. Les 146 tests et `node --check web/app.js` passent ; il reste à vérifier le comportement dans Chrome avec des données synthétiques, puis à ouvrir une PR selon le workflow habituel.

### Prompt prêt à coller dans Codex sur l'autre PC

```text
Reprends Lapinou Dish à partir de docs/REPRISE.md et docs/STATUS.md. Lis aussi docs/SESSION-2026-10-13.md et les instructions AGENTS.md éventuelles.

La version publiée de référence est 0.2.47 (PR #58). Le correctif de ce soir et les notes de reprise sont sur la branche distante fix/shopping-list-scroll-handoff. Le correctif empêche la page de sauter en bas quand on change le format de paquet d'une ligne de courses, en mettant à jour uniquement cette ligne.

Commence par retrouver le dépôt, afficher git status, la branche, HEAD et les différences locales avant toute mise à jour. Ne réinitialise et n'écrase aucun fichier. Récupère la branche fix/shopping-list-scroll-handoff en préservant tout travail local, puis lance les 146 tests avec `node --experimental-strip-types --test test/*.test.ts test/*.test.mjs`. Avant de prendre le contrôle du navigateur, demande-moi; après mon accord, teste dans Chrome la modification successive de plusieurs champs de conditionnement, en vérifiant que la page reste au même endroit et que les quantités s'actualisent. Si le parcours est bon, ouvre une PR et suis les contrôles GitHub.

Règle absolue : ne jamais accéder à Unraid, le vérifier, le modifier ou y déployer. Je m'occupe moi-même de l'installation. Ne touche pas à Nginx. Ne prends pas le contrôle du navigateur sans me demander d'abord, sauf pour le test ciblé ci-dessus après m'avoir demandé.
```

## Validation et livraison

Node.js **24+**. Commande de tests directement utilisable :

```powershell
node --experimental-strip-types --test test/*.test.ts test/*.test.mjs
```

`npm test` exécute la même commande. Les tests PostgreSQL utilisent PGlite et exécutent les migrations SQL réelles. Les scripts Chrome de cette session sont dans le dossier local voisin `lapinou-qa` : ils ne font pas partie du dépôt transféré.

Workflow appliqué : branche de travail, tests adaptés, vérification navigateur si interface modifiée, commit/push, PR attachée, fusion après contrôles GitHub réussis, vérification de publication de l'image. L'utilisateur met ensuite à jour son installation lui-même.
