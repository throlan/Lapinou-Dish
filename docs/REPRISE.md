# Cahier de reprise — 15 octobre 2026

## Point de départ

- Dépôt : https://github.com/throlan/Lapinou-Dish
- Base de travail : `main`, commit `fd9bf92c41dbc72ef4a40dc6d4f98f95c0bfc20b` après la [PR 76](https://github.com/throlan/Lapinou-Dish/pull/76) ; checkout local propre.
- Dernier code fusionné : **0.2.58**, retour de « Préparation servie ensemble » aux proportions de rendement d'origine. Les **174 tests** locaux et le workflow PR #203 ont réussi. Le workflow principal de publication après fusion reste à vérifier ; dernière image dont la publication est confirmée : **0.2.56** (workflows 197 et 198). Voir le [journal du 15 octobre](SESSION-2026-10-15.md).
- Journaux : [13 octobre](SESSION-2026-10-13.md) et [14 octobre](SESSION-2026-10-14.md). État et tâches restantes : [STATUS.md](STATUS.md).
- Derniers travaux livrés : stock des produits et préparation des repas (0.2.52, PR 66), puis correction de l'enregistrement du planning des courses (0.2.53, PR 67). Aucun accès à Unraid ni à Nginx.
- Dernier travail livré : **0.2.55**, liste des recettes compacte et paginée, recherche, production à suivre et moments adaptés modifiables sur chaque ligne. La PR 71 et le workflow 193 ont réussi. La refonte de Courses & stocks demeure documentée dans [son guide](SHOPPING-STOCK-PAGE.md).
- Dernier correctif : **0.2.56**, édition du nom et de l’adresse web des magasins ; les associations alimentaires et les listes Home Assistant restent liées au même magasin. Les préparations à faire ignorent désormais les recettes dont la production est « Aucune ». Voir la [PR 73](https://github.com/throlan/Lapinou-Dish/pull/73).

## Règle d'exploitation impérative

**L'agent ne doit jamais accéder à Unraid, le vérifier, le modifier ou y déployer quoi que ce soit. L'utilisateur effectue lui-même toutes les mises à jour.** Le périmètre autorisé est le développement local, GitHub, les contrôles CI et la vérification de publication de l'image.

## Reprendre sur un autre PC

1. Retrouver ou cloner le dépôt. Lire les éventuels `AGENTS.md`, puis exécuter `git status --short`, `git branch --show-current` et `git log -5 --oneline`.
2. Préserver tout travail local. Ne pas utiliser de reset destructif, suppression de fichiers, nettoyage forcé ou écrasement des modifications.
3. Récupérer `origin/main`. Un checkout propre sur `main` peut être mis à jour par `git pull --ff-only`. Si le checkout contient des changements ou une autre branche, inspecter avant de changer de base.
4. Vérifier la version de `package.json` et lire [l'état du projet](STATUS.md), [le journal de session du 14 octobre](SESSION-2026-10-14.md), ce cahier et les guides pertinents avant toute modification.
5. Travailler avec une base locale dédiée et des données synthétiques. Ne pas importer les données de santé du foyer, secrets ou captures personnelles dans Git.

Le chemin du checkout de cette session est `C:\Users\Plex\OneDrive\Documents\GitHub\Lapinou-Dish`. Le chemin sera différent sur l'autre PC ; repère le dépôt à partir de son nom et de son dossier Git.

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
- Au petit-déjeuner, les recettes de type Dessert compatibles avec le moment peuvent être ajoutées comme recette commune via « Ajouter une recette » et suivre le calcul automatique des portions. « + Dessert » reste individuel.
- Les propositions restent modifiables. Les repas sauvegardés ne sont pas recalculés à leur réouverture ou duplication. Le bouton Recalculer les portions est explicite.
- Plafond de proposition du plat en grammes : portion moyenne du batch, arrondie vers le bas à 10 g ; légumes séparés également plafonnés. Petit-déjeuner principal : deux pièces, une portion, ou poids correspondant à deux pièces pour une préparation dérivée en grammes.
- Rééquilibrer : aperçu puis application explicite. Corrige d'abord le petit-déjeuner des adultes, puis réduit si nécessaire les quantités ajustables du déjeuner et du dîner. Boissons/desserts conservés, profils mineurs exclus, âge ou nutrition inconnus signalés. Un aperçu devenu obsolète est refusé.
- Stocks : inventaire initial, réception des achats et historique par produit ; les besoins de courses tiennent compte du stock. Une production déduit ses ingrédients une seule fois ; un repas du calendrier marqué « Préparé » déduit une recette directe, mais pas de nouveau les ingrédients d'un batch déjà produit.
- Import OpenAI optionnel : brouillons à vérifier ; tentative de récupération de description Instagram avec repli sur le texte collé si la lecture est bloquée. Aucune clé à coller dans la conversation ou à committer.

## Travail livré : réserve kcal et occasions

Le système a été livré en **0.2.42** (PR 53). Les décisions détaillées et exemples restent archivés dans [le document de réserve](drafts/ENERGY-RESERVE.md). Règles essentielles à préserver :

- Le solde adulte est calculé depuis les repas planifiés, jour par jour, sur une fenêtre glissante de 30 jours par défaut. Sous l'objectif quotidien daté : crédit de la différence ; au-dessus : débit du solde, en utilisant les crédits les plus anciens d'abord.
- Exemple validé : objectif de 1 850 kcal et menu planifié à 1 760 kcal = +90 kcal ; le lendemain, 1 870 kcal = −20 kcal ; solde : 70 kcal.
- Une épargne supplémentaire choisie par l'utilisateur réduit le budget servant à recalculer les portions. Le crédit réel reste calculé une seule fois depuis l'objectif initial (1 850 − menu à 1 750 = +100, et non +200).
- Une occasion (ex. raclette, vin et dessert) reçoit une estimation globale par adulte, contourne les limites kcal ordinaires et le rééquilibrage, puis débite la réserve. Si le solde ne suffit pas, il peut devenir négatif avec un avertissement ; le repas reste enregistrable.
- Pas de saisie après repas ni de journal du consommé : le calendrier porte des prévisions et doit rester léger.

Les totaux affichés sont des prévisions ; aucune saisie de consommation réelle après repas n'est souhaitée. L'ancienne archive et son patch ne sont pas à réappliquer.

## Reprise du travail actuel

Les liens de commande (PR 59) sont fusionnés et publiés ; ne pas les réimplémenter. La version 0.2.48 ajoute les proportions d'assiette : 100 % entier, 70/30 viande-légumes/féculents, 25/25/50 protéines/féculents/légumes. Les valeurs sont des proportions en poids estimé servi, indépendantes des parts kcal de la journée. Les repas sauvegardés et dupliqués sont conservés ; le recalcul est explicite. Les parties liées sont réduites ensemble lors du rééquilibrage quotidien.

À la prochaine reprise : vérifier l'état Git et lire le journal du 14 octobre avant de proposer un nouveau travail. La PR 67 et le workflow 185 sont terminés avec succès. Préserver les stashes historiques ; aucune réapplication automatique. L'utilisateur confirme que les coupures PostgreSQL sont réglées ; aucune correction à reprendre sur ce point. Ne jamais accéder à Unraid ni à Nginx. L'utilisateur a déjà autorisé la vérification locale dans le navigateur sur données fictives.

## Achats en ligne par site marchand — 0.2.49

Le développement demandé a été livré par la PR 62 : sélection de plusieurs aliments et affectation à une boutique existante, modification/retrait, listes par marchand et renommage des libellés en Achats en ligne. Exemples : wheys → Nutripure, farines et certains produits bio → Greenwhiz ; affectations explicites par foyer.

Les sites enregistrés dans Liens de commande sont réutilisés ; les quantités, stocks, paquets et cases acheté restent conservés. Les articles sans boutique restent visibles. La suppression d'un site retire ses affectations sans supprimer les aliments ni leurs besoins. Voir [le guide](ONLINE-SHOPPING.md).

## Magasins et export — 0.2.50

La version 0.2.50 accepte les magasins sans site, présente les courses par magasin sur toute la largeur, permet copie/téléchargement par magasin et un envoi vers une liste Home Assistant `todo` propre à chaque magasin. Les variables `HOME_ASSISTANT_URL` et `HOME_ASSISTANT_TOKEN` doivent être configurées côté application par l'utilisateur ; ne jamais demander la valeur du jeton dans la conversation. L'API Alexa pour les listes a été arrêtée : aucun envoi direct. Les unités d'achat indicatives ail/basilic/gingembre ne touchent pas aux calculs nutritionnels. Voir [le guide](ONLINE-SHOPPING.md).

Les 167 tests et le parcours Chrome local sur données fictives (ordinateur/mobile) passent. PR 64 fusionnée et publication GitHub vérifiée ; aucun accès à Unraid ni à Nginx.

## Unités d'achat paramétrables — 0.2.51

Chaque aliment du foyer peut recevoir un nom d'unité d'achat au singulier et au pluriel, une quantité couverte en g, ml ou pièces, et une note d'estimation. Le réglage est accessible dans les détails de la ligne de courses. Les unités déjà présentes dans plusieurs recettes sont agrégées seulement si le catalogue fournit la conversion nécessaire ; autrement les lignes restent séparées avec un avertissement. Un format de paquet manuel reste prioritaire. Les conversions nutritionnelles ne sont pas déduites de ces réglages. Migration `20261014_purchase_units.sql` ; API authentifiée `GET/PUT/DELETE /api/household-purchase-units`. Voir [le guide](ONLINE-SHOPPING.md).

La PR 65 est fusionnée et la publication GitHub a réussi dans le workflow 181.

## Stock des produits — 0.2.52

Une ligne de courses permet de compter le stock initial dans son unité et de valider séparément la quantité réellement achetée. Le stock est mémorisé en grammes avec conversion documentée ; les achats ajoutent, un inventaire corrige le total. Les besoins d'une période soustraient le stock présent. Les recettes préparées depuis le calendrier déduisent les ingrédients suivis ; les batchs produits les ont déjà déduits et leur service n'effectue aucun second prélèvement. Annulation, historique et protection contre les doubles enregistrements. Les repas simplement planifiés ne constituent pas une sortie réelle. Voir [le guide](PRODUCT-INVENTORY.md).

La PR 66 est fusionnée et la publication GitHub a réussi dans le workflow 183.

## Planning des courses — 0.2.53

Le bouton « Enregistrer le planning » transmet maintenant les six routines à l'API ; son message de succès reste visible après le rafraîchissement. Fréquence et date persistent après rechargement. La PR 67 est fusionnée au commit `8b53d5e` ; tests et publication de l'image réussis dans le workflow 185.

## Validation et livraison du développement

Node.js **24+**. Commande de tests directement utilisable :

```powershell
node --experimental-strip-types --test test/*.test.ts test/*.test.mjs
```

`npm test` exécute la même commande. Les tests PostgreSQL utilisent PGlite et exécutent les migrations SQL réelles. Les scripts Chrome de cette session sont dans le dossier local voisin `lapinou-qa` : ils ne font pas partie du dépôt transféré.

Workflow appliqué : branche de travail, tests adaptés, vérification navigateur si interface modifiée, commit/push, PR attachée, fusion après contrôles GitHub réussis, vérification de publication de l'image. L'utilisateur met ensuite à jour son installation lui-même.

## Prompt de reprise sur un autre PC

> Reprends le développement de Lapinou Dish. Retrouve le dépôt local, vérifie son état et préserve toute modification ou stash existant avant de récupérer `origin/main` sans écrasement. Lis `AGENTS.md` s'il existe, `docs/REPRISE.md`, `docs/STATUS.md` et le dernier journal dans `docs/`. Vérifie la version de `package.json` ainsi que les PR et workflows GitHub récents, puis fais-moi un état court des tâches restantes avant toute nouvelle modification. Règle absolue : n'accède jamais à Unraid ni à Nginx ; je gère moi-même le déploiement. Les vérifications en navigateur local sur données fictives sont autorisées.
