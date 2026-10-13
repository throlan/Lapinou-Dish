# Cahier de reprise — 13 octobre 2026

## Point de départ

- Dépôt : https://github.com/throlan/Lapinou-Dish
- Branche de référence : `main`.
- Dernière version applicative publiée et vérifiée : **0.2.41**.
- Commit applicatif : `37132fbc37f177cfdf27eccc300e072127955abe` ([PR 51](https://github.com/throlan/Lapinou-Dish/pull/51)). Les commits de documentation ultérieurs ne changent pas cette version.
- Validation : **138 tests réussis**, parcours Chrome sur données synthétiques, contrôles GitHub et publication GHCR réussis.

## Règle d'exploitation impérative

**L'agent ne doit jamais accéder à Unraid, le vérifier, le modifier ou y déployer quoi que ce soit. L'utilisateur effectue lui-même toutes les mises à jour.** Le périmètre autorisé est le développement local, GitHub, les contrôles CI et la vérification de publication de l'image.

## Reprendre sur un autre PC

1. Retrouver ou cloner le dépôt. Lire les éventuels `AGENTS.md`, puis exécuter `git status --short`, `git branch --show-current` et `git log -5 --oneline`.
2. Préserver tout travail local. Ne pas utiliser de reset destructif, suppression de fichiers, nettoyage forcé ou écrasement des modifications.
3. Récupérer `origin/main`. Un checkout propre sur `main` peut être mis à jour par `git pull --ff-only`. Si le checkout contient des changements ou une autre branche, inspecter avant de changer de base.
4. Vérifier la version de `package.json` et lire [l'état du projet](STATUS.md), [le journal de session](SESSION-2026-10-13.md) et [le guide kcal](MEAL-ENERGY.md).
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

## Travail restant : réserve kcal et occasions

L'utilisateur a précisé le fonctionnement attendu de la réserve et des occasions ; ce chantier n'est **pas livré** en 0.2.41. Les décisions détaillées et exemples sont consignés dans [le brouillon de réserve](drafts/ENERGY-RESERVE.md). Règles essentielles :

- Le solde adulte est calculé depuis les repas planifiés, jour par jour, sur une fenêtre glissante de 30 jours par défaut. Sous l'objectif quotidien daté : crédit de la différence ; au-dessus : débit du solde, en utilisant les crédits les plus anciens d'abord.
- Exemple validé : objectif de 1 850 kcal et menu planifié à 1 760 kcal = +90 kcal ; le lendemain, 1 870 kcal = −20 kcal ; solde : 70 kcal.
- Une épargne supplémentaire choisie par l'utilisateur réduit le budget servant à recalculer les portions. Le crédit réel reste calculé une seule fois depuis l'objectif initial (1 850 − menu à 1 750 = +100, et non +200).
- Une occasion (ex. raclette, vin et dessert) reçoit une estimation globale par adulte, contourne les limites kcal ordinaires et le rééquilibrage, puis débite la réserve. Les règles de dépassement d'un solde insuffisant restent à décider.
- Pas de saisie après repas ni de journal du consommé : le calendrier porte des prévisions et doit rester léger.

Le chantier inclut l'intégration au calendrier et aux cinq créneaux, un aperçu contrôlé des recalculs, les tests et une vérification navigateur sur données synthétiques. Le brouillon existant a été préparé sur 0.2.37 : ne pas l'appliquer directement à la version 0.2.41.

Un brouillon de code est archivé dans [drafts/ENERGY-RESERVE.md](drafts/ENERGY-RESERVE.md) avec un patch récupérable sur l'autre PC. Il n'est pas intégré à l'application et ne doit pas être présenté comme terminé. Voir ce document pour les décisions et le travail restant détaillés.

Les totaux affichés actuellement sont des prévisions ; aucune saisie de consommation réelle après repas n'est souhaitée.

## Validation et livraison

Node.js **24+**. Commande de tests directement utilisable :

```powershell
node --experimental-strip-types --test test/*.test.ts test/*.test.mjs
```

`npm test` exécute la même commande. Les tests PostgreSQL utilisent PGlite et exécutent les migrations SQL réelles. Les scripts Chrome de cette session sont dans le dossier local voisin `lapinou-qa` : ils ne font pas partie du dépôt transféré.

Workflow appliqué : branche de travail, tests adaptés, vérification navigateur si interface modifiée, commit/push, PR attachée, fusion après contrôles GitHub réussis, vérification de publication de l'image. L'utilisateur met ensuite à jour son installation lui-même.
