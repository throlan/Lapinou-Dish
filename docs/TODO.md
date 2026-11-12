# Prochaines tâches — 12 novembre 2026

## Éditeur de recette en fenêtre et onglets — 0.8.0

La création, la modification, la duplication et la vérification d’un brouillon importé ouvrent maintenant une fenêtre modale centrée, au lieu de descendre sous la liste. Quatre onglets regroupent les champs : Informations (nom, description, type, moments, source), Ingrédients (rendement, service et lignes), Préparation (temps, difficulté, étapes et validation de relecture) et Réglages (production, lot minimum, équivalences et avis).

En-tête, navigation et enregistrement restent visibles pendant le défilement du contenu. Les saisies sont conservées entre les onglets. La validation ouvre l’onglet du premier champ invalide, y compris les champs dans un volet replié. Les onglets se pilotent aussi au clavier. Fermer une saisie modifiée demande de confirmer l’abandon ; un enregistrement en cours bloque les modifications et les doubles envois. Après fermeture, la position dans la liste et le focus sont restaurés.

Les fiches aliments s’ouvrent au-dessus de la recette sans perdre sa saisie. Une préparation maison liée se consulte dans la fiche Cuisiner au-dessus de l’éditeur. Les imports conservent leur texte original. Tous les champs, les droits, les calculs, les menus, les productions et les historiques sont conservés. Aucun changement de schéma ni accès à Unraid ou Nginx ; déploiement par l’utilisateur uniquement.

Validation : parcours Chrome sur données fictives (modification, création, brouillon importé, saisies entre onglets, champ invalide masqué, fiche aliment imbriquée, abandon protégé et position de la liste). Inspection visuelle à 1280, 900, 390 et 320 px ; pas d’appareil physique. 416 tests complets réussis. Les contrôles GitHub et la vérification de publication sont consignés dans la PR de cette version.

## À vérifier après déploiement — avis facultatifs 0.7.2

Dans Modifier une recette, la case « Autoriser les avis » permet de désactiver la notation pour cette recette dans le foyer actif, par exemple un café ou un skyr. Elle est activée par défaut ; aucune désactivation n’est déduite du nom. Les personnes autorisées à modifier la recette peuvent changer ce réglage. Une recette désactivée ne figure plus dans les suggestions à noter, le classement local, les filtres par avis ni les étoiles de la fiche Cuisiner. Le serveur refuse aussi un nouveau vote direct.

Les notes déjà enregistrées sont conservées et redeviennent visibles après réactivation. Le choix reste privé au foyer, n’est pas exporté avec une publication et n’est pas imposé au foyer qui importe une recette. Une duplication conserve le choix de la recette source ; un nouveau brouillon démarre avec les avis activés. Migration additive `20261112_recipe_rating_enabled.sql`, sans réécriture des menus, stocks, quantités ni avis existants.

Validation : 412 tests complets réussis. Chrome local sur données fictives : désactivation dans le vrai formulaire, enregistrement, réouverture avec choix conservé et disparition des avis ; inspection visuelle à 1280 et 390 px. Les contrôles et la vérification de publication sont consignés dans la PR de cette version. Aucun accès à Unraid ni Nginx ; l’utilisateur seul déploie.

## Notation des recettes historiques — 0.7.1

Certaines recettes historiques (notamment les boissons ajoutées par la migration 0009) possèdent un identifiant PostgreSQL issu d’un MD5, sans bits de version/variante RFC. La notation les refusait avec le message trompeur « Choisis une note entière entre 1 et 5 ». La validation du seul identifiant recette des votes accepte désormais ces UUID au format canonique. Les notes restent des entiers de 1 à 5 ; participation au repas, date, foyer et identité du compte restent contrôlés. Plusieurs recettes peuvent être notées à la suite, puis la note modifiée ou retirée sans double vote.

Aucune migration, réécriture des identifiants, modification des calculs, des menus, des stocks ou des historiques. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur uniquement. Validation : 410 tests complets réussis, dont une reproduction qui échouait avant correction. Vérification dans Chrome local temporaire : quatre recettes fictives notées successivement, modification et retrait d’une note, trois votes restants confirmés côté serveur. Publication de la 0.7.1 vérifiée après fusion (voir PR #192).

## À vérifier après déploiement — 0.7.0

Vérifier les cartes, badges et filtres sur les appareils réels. Pour les recettes historiques sans créateur enregistré, seuls les administrateurs/gestionnaires disposent des actions de gestion ; aucune attribution n’est inventée. Les contrôles et la publication de cette version sont consignés dans la PR fonctionnelle.


## Relecture des recettes — 0.6.0

Utiliser le filtre Non validées pour reprendre les quelque 200 recettes, compléter les temps, la difficulté et les étapes, puis cocher Recette validée. Le repère ne bloque pas les ajustements ultérieurs. Valider l’ergonomie de la fiche Cuisiner après déploiement par l’utilisateur.

## À vérifier après déploiement de la 0.5.0

Valider les rattachements compte–profil et les rôles dans le nouvel écran, sélectionner les recettes à partager ou à inclure dans un package, puis utiliser les notes dans les repas passés. Les aliments sont désormais communs sans publication individuelle ; les corrections attendent l’administrateur. Les invitations par courriel et la récupération autonome de compte restent ultérieures.

## Validation des comptes — 0.4.1

Après déploiement par l’utilisateur, reprendre le foyer et le profil existants lors de la création du premier administrateur. Vérifier les associations compte–profil, puis composer le premier package officiel à partir des publications choisies. Les invitations par courriel et la récupération autonome de compte restent hors de cette première livraison ; les mots de passe se réinitialisent depuis un autre compte administrateur. Voir REPRISE.md et ROLLBACK.md.


## Après les filtres du catalogue 0.3.21

Faire examiner les listes CSV filtrées selon les besoins, notamment les aliments utilisés en recette si un export de cet usage est disponible. Les catégories exclues du coefficient de cuisson restent dans le catalogue et les autres champs de revue ; leur exclusion peut être annulée à tout moment. Vérifier les valeurs propres au produit avant de confirmer un lot.

## Après la revue complète du catalogue

L'utilisateur sélectionnera les estimations qu'il souhaite appliquer dans Administration. Peser les scoops, pincées et produits particuliers avant d'ajouter leurs masses ; vérifier les méthodes de cuisson propres au foyer et les étiquettes des références manuelles. Les valeurs non pertinentes restent vides. Aucun traitement supplémentaire des 1 058 fiches n'est nécessaire pour présenter le catalogue ; les propositions restent révisables.

## Après l'état de cuisson par ingrédient

Faire examiner progressivement les lignes historiques dans l'éditeur et les coefficients contradictoires, sans conversion automatique ni changement des quantités de menus déjà validées. Pour les ingrédients ajoutés déjà cuits, sélectionner la fiche nutritionnelle correspondant à leur forme cuite. Poursuivre ensuite l'audit du catalogue décrit ci-dessous.

## Catalogue après le nouveau lot 0.3.18

Poursuivre l'examen des fiches non couvertes par les 58 fiches déjà documentées. Arbitrer un par un les écarts, notamment les graines de pavot (2,8/8,8 g dans la source USDA contre 3/9 g saisis), et préciser les formes de safran, estragon, sarriette et lin brun avant toute saisie. L'export CSV ne permet pas de déterminer quels aliments sont utilisés dans les recettes ; obtenir ce relevé avant de prioriser par usage. Préserver la fiche manuelle supplémentaire de l'export à 1 058 lignes sans deviner sa différence avec l'export à 1 057 lignes.

## Catalogue : propositions sourcées — 0.3.17

Dans Aliments, « Examiner les propositions sourcées » rapproche les références Ciqual exactes et affiche la valeur actuelle, les méthodes et les limites. Une proposition pour un champ vide peut être reportée volontairement dans la saisie, puis enregistrée en lot après aperçu, avec sa provenance par ligne. Les écarts sur valeurs existantes renvoient à la fiche individuelle. Aucun remplissage automatique. [Audit de l’export et conflits](CATALOGUE-SUGGESTIONS.md) : 1 057 fiches inventoriées, 44 examinées en détail, 64 lignes dont 39 écarts pour 38 couples fiche/champ. L’examen des autres références et les pesées du foyer restent à faire.

Après 0.3.16 : faire examiner les 49 références hors Ciqual et les conflits de rendement avant toute correction de données. Ne pas déduire une densité ou un poids de cuillère pour des aliments qui ne sont pas mesurés ainsi. Préparer des suggestions de rendement par aliment et méthode avec source ; conserver les valeurs propres déjà renseignées et les quantités des menus historiques.

Poursuivre l'audit des 1 058 aliments exportés : 1 009 codes Ciqual rapprochés du classement officiel et 49 références hors Ciqual. Proposer des rendements de cuisson par aliment et méthode, en préservant notamment le riz basmati ×2,5 existant. Examiner les conflits avant toute modification groupée ; la whey vanille garde son poids de scoop déjà saisi à 25 g jusqu'à une pesée de l'utilisateur. Le classement et l'édition groupée sont livrés en 0.3.16.

Exporter le catalogue réel depuis la page Aliments en 0.3.14, puis faire transmettre le CSV par l’utilisateur. Sur ce fichier, inventorier les champs manquants, proposer des catégories alimentaires distinctes des catégories de courses et documenter chaque valeur recherchée (source, portée, fiabilité). Préparer ensuite l’édition groupée avec aperçu et validation explicite ; ne modifier aucune fiche sur une hypothèse générique.

0.3.13 livrée par la PR [#162](https://github.com/throlan/Lapinou-Dish/pull/162) : 356 tests complets locaux et contrôle ciblé supplémentaire réussis ; [publication GHCR vérifiée](https://github.com/throlan/Lapinou-Dish/actions/runs/41855028940). Après déploiement par l'utilisateur, recueillir son retour sur les catégories communes/individuelles, les conflits de coefficients et l'aperçu de rééquilibrage. Il résout au cas par cas les éventuels coefficients contradictoires depuis la fiche aliment. Aucun réglage nutritionnel individuel ni quota selon l'âge n'est inventé. La règle visant 125 g de viande/poisson par portion demeure en attente.

Présentation adaptative validée et implémentée en 0.3.12 : charte fondée sur le logo, photos dans les cartes, navigation téléphone/tablette/PC et choix du jour sur petit écran. Vérifier les retours d’usage après publication avant d’ajuster la densité des écrans.

0.3.11 livrée : Courses & stocks répartis en cinq onglets, période commune visible, saisies conservées. 353 tests locaux ; PR #159 fusionnée au commit `36dc404a107b658c3bf0c89297f9e7e2abab5ee3`. Contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41821597464. Tags `0.3.11` et `v0.3.11` vérifiés, digest `sha256:36534f81dc4e4648789f2c7e42104559f4499e59a3fa7cc7edeb02df718b7089`.



0.3.10 livrée : accueil hebdomadaire, fiche de repas préparé, quatre créneaux actifs, fiche aliment commune et préparations supplémentaires planifiées. Pourcentages kcal toujours modifiables dans Administration ; 20/40/10/30 est le choix actuel, pas une valeur codée en dur pour le foyer. 353 tests locaux, PR #157 fusionnée au commit `0db84ae2cb12d0922c9e59ecb11d4662e5af12ad`, contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41811943655. Tags `0.3.10` et `v0.3.10` vérifiés, digest `sha256:b46eaf9e3f60e68c5ca35bb06ee1322a1db9176ccf3ddcaa2c92ff2aa4c5314a`. Le calcul viande/poisson reste en attente de règle utilisateur.

Repas prêts et sorties de stock après la journée réalisés en 0.3.9 : réservations chronologiques ou ciblées sur une plage, retrait une fois après minuit (Paris), rattrapage au redémarrage, annulation possible et couverture partielle explicite. Voir REPRISE.md. 351 tests locaux complets et Chrome fictif réussis. PR #155 fusionnée au commit `571d72bab17c4970f838a6799234e95d40495077` ; contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41302800569. Tags `0.3.9` et `v0.3.9` vérifiés, digest commun `sha256:bf2735d821b157d05562fbc6d9ed28e3ead111e4de5bb12d92640a38b678ea32`. Les cinq versions 0.3.5 à 0.3.9 sont présentes ; les digests antérieurs sont conservés. Ce suivi ne modifie ni les menus ni le calcul des portions.

Production non bloquée par stocks suivis insuffisants et correction des parties archivées réalisées en 0.3.8 ; 342 tests locaux et parcours Chrome fictif réussis. PR #153 fusionnée au commit `7fcc8ed34d3277c27a6f7c4c479107ebbef755bb` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41293831666. Tags `0.3.8` et `v0.3.8` vérifiés, digest commun `sha256:e7d2a7a5377943b7a3ee38d89ef58d5ffb96b059bb1a35da71de71def2bc7453`. Aucun changement de la règle viande/poisson.

Stock restant des préparations et confirmation des regroupements réalisés en 0.3.7 ; voir REPRISE.md. Les quantités réellement restantes se corrigent sans annuler la fabrication. 340 tests complets locaux et navigateur fictif réussis. PR #151 fusionnée au commit `cf5f69f18ab9f9aabc0027a2bd12b5dd2cd0fb61` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41285703265. Tags `0.3.7` et `v0.3.7` vérifiés, digest commun `sha256:406f87c2cf3b61bce67e29f2b61b6d8c7b3588a47af62fc7258e330b083bd651`.

Batch cooking groupé réalisé en 0.3.6 : choix de semaine de départ et de durée (1/2/3 semaines ou toute la période des courses), recette unique avec quantités cumulées calculées sur une plage et un stock partagés. Les autres productions/courses conservent leurs dates. 336 tests complets locaux et parcours Chrome fictif PC/tablette/mobile réussis. PR #149 fusionnée au commit `2359b2d287488e5b429ff5a7f9d3276a9250484a` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41244538868. Les tags `0.3.6` et `v0.3.6` ont été vérifiés directement dans GHCR et pointent vers `sha256:5f57f1c72002ae863f34ab9b82c8995ce93f54eb667bce1c88ddcdcf5d9d57fb`. Ce chantier n’est plus à redévelopper. La règle viande/poisson reste en attente.

0.3.5 livrée : le féculent lié ne démarre plus à 1 g ; il participe aux proportions de l’assiette et ses grammes sont conservés jusqu’à l’enregistrement. Le contraste des ingrédients du thème clair est restauré. PR #146 fusionnée ; contrôles et publication GHCR : https://github.com/throlan/Lapinou-Dish/actions/runs/41210728818. Pour un repas déjà enregistré avec 1 g, utiliser « Recalculer les portions » après la mise à jour.

0.3.4 livrée : les composants d’une recette décomposée sont liés dans le calendrier. La transition vers protéines/légumes ensemble et féculents séparés conserve les anciennes parties pour les repas et stocks historiques. Retirer un composant retire la recette composée entière du repas. 328 tests locaux, contrôles GitHub et publication GHCR réussis. PR #144 fusionnée : https://github.com/throlan/Lapinou-Dish/actions/runs/41208298921.

À la demande de l’utilisateur, ne pas encore modifier le calcul des quantités de viande/poisson pour atteindre une moyenne de 125 g par portion ; la règle souhaitée reste à préciser.

0.3.3 livrée : administration en sept onglets, chargement des types de production à l’ouverture, minimum de lot propre à chaque recette avec conversion par rendement/équivalences. PR #142 fusionnée (`f997a39`), 324 tests et publication GHCR réussis.

0.3.2 livrée : recettes personnalisées visibles sous leur catégorie calendrier liée à un rôle standard ; défaut de quantité indépendant du rôle Sauce. PR #140 fusionnée, 321 tests et publication GHCR réussis.

0.3.1 livrée : types de production personnalisés, minimum de fabrication par type avec unité, ingrédients du lot complet dans les courses et réutilisation du surplus pour les menus suivants. Correctif calendrier : les catégories configurées sont chargées avant l’ouverture d’un repas. 319 tests réussis ; PR #138 fusionnée et publication GHCR vérifiée.

0.3.0 livrée : catégories complémentaires configurables par créneau, types personnalisés de recettes depuis Administration et choix/quantité individuels pour chaque personne. Le principal reste partagé ; 0 signifie « aucun » pour les ajouts. PR #137 fusionnée, publication réussie et 315 tests locaux.

0.2.99 : correction du chargement bloqué par le module food-pagination.js non servi. 311 tests locaux, dont parcours HTTP de toutes les dépendances module. Les fonctions catalogue 0.2.97/0.2.98 sont conservées. Vérifier la publication du correctif après fusion.

Mise à jour livrée en 0.2.97 : catalogue sans scrollbar imbriquée, suppression groupée avec aperçu/protections, conversions de rendement par aliment dans Administration et conversion inverse automatique aux courses. 308 tests locaux réussis ; PR #130 fusionnée et publication GHCR vérifiée. Ces travaux ne sont plus à reprendre.

Mise à jour livrée en 0.2.98 : pagination en haut et en bas, choix jusqu’à 250 aliments, conservation de la page après suppression, et lignes compactes sur ordinateur. 310 tests complets réussis, PR #132 fusionnée et publication GHCR vérifiée. Ces améliorations sont terminées.

Référence préparée : **0.2.96**, réglages d’unité d’achat par aliment et équivalences entre aliments explicites dans les courses ; 306 tests locaux réussis. Vérifier les contrôles GitHub et la publication après fusion. Les fonctions des versions 0.2.92 à 0.2.94 restent livrées. La 0.2.88 conserve la saisie en unités d’achat et stock compté cohérents, après les produits communs et exclusions 0.2.87. Le calcul 0.2.86 (base 0.2.83) reste conservé ; les calculs 0.2.84/85 sont abandonnés. Aucun nouveau chantier sans demande de l’utilisateur.

## Pistes à choisir et préciser

1. **Webapp — livrée en 0.2.90** : installation, icônes et guide iOS/Android/PC en place, critères vérifiés dans Chrome local. Recueillir le retour sur appareils physiques. Le hors-ligne et la synchronisation restent des chantiers distincts, sans demande de lancement.
2. **Comptes individuels et foyer — reportés** : décision de l’utilisateur après discussion du futur usage communautaire et d’une distribution/hébergement. Le modèle de comptes, profils, appartenances et droits reste à cadrer ; le choix gestionnaire/membre proposé initialement n’est pas validé. Aucun développement d’authentification individuelle n’a commencé. L’accès actuel reste une session par mot de passe du foyer. Ne pas reprendre ce chantier sans nouvelle demande.
3. **Correction des données nutritionnelles** : les filtres et badges existent. Améliorer l'explication des causes de calcul incomplet et l'accès aux ingrédients/conversions à corriger ; définir les critères avant développement.
4. **Communauté publique** : cadrer bibliothèque volontaire, droits et attribution des images/recettes, modération et isolation des données privées avant toute ouverture.
5. **Nettoyage du catalogue alimentaire — dernière priorité, après consolidation du cahier de recettes** : le compteur et les liens « Dans X recettes » sont livrés. Première étape proposée : filtre « inutilisés ». Ensuite, envisager une fusion guidée des doublons, avec aperçu des références et conservation des recettes, conversions, associations magasins et stocks. Ne pas supprimer automatiquement des aliments.

Détails et variantes dans [AMELIORATIONS.md](AMELIORATIONS.md). Les variantes indépendantes de recettes et l'affichage de photos en mode cuisine restent des pistes à confirmer, sans priorité décidée.

## Décisions récentes à conserver

- La gestion des utilisateurs est différée ; les autres pistes restent à choisir, sans lancement automatique.
- Une seule collation est souhaitée, l’après-midi. La suppression du créneau du soir n’est pas implémentée : cadrer la transition et préserver les menus historiques avant de modifier les cinq créneaux actuels.
- Les répartitions horaires restent actuellement communes au foyer, avec objectifs kcal propres à chaque personne. Aucun quota par âge ni nouvelle répartition nutritionnelle n’a été ajouté à la suite de la recherche documentaire.

## Déjà livré — ne pas remettre dans le reste à faire

- Publication avec versions numérotées et conservation des images pour retour arrière : voir ROLLBACK.md. Application 0.2.99 inchangée ; vérifier les alias restaurés après livraison de ce workflow.

- 0.2.94 : renommage direct des recettes depuis les fiches grille/liste, avec conservation des ingrédients/calculs et actualisation du titre des parties.

- 0.2.93 : coefficients individuels dans l’éditeur et les fiches, Semoule ×2, retrait des champs globaux visibles ; anciens coefficients appliqués conservés. 303 tests locaux et parcours Chrome fictif.

- 0.2.92 : filtre par service, service et rendement dans les réglages rapides, grille/liste, colonnes et taille des pages configurables. 302 tests locaux et parcours Chrome sur données fictives.

- Instagram dans Cuisiner (0.2.91) : publication de la source chargée au clic, vidéo si disponible, lecteur arrêté à la fermeture et lien d’origine conservé. Lecture dépendante d’Instagram ; aucune vidéo téléchargée.

- Webapp installable : manifeste, icônes lapin/cocotte, guide et invitation native quand disponible, ouverture standalone. Aucune couche de cache hors ligne ; mises à jour à la réouverture/actualisation.

- Charte Magazine culinaire · Encre framboise claire et responsive, navigation adaptée aux trois formats, cartes photos et formulaires conservant tous les réglages. Impression A4 d’origine préservée.

- Produits d’achat communs avec équivalence explicite, stock partagé, recettes et nutrition distinctes ; exclusions réversibles permanentes ou pour les dates de la liste. Aucun choix automatique pour les blancs d’œufs. Ceci ne fusionne pas les aliments du catalogue.

- Import IA et texte d’un rendement en tranches, conservé du brouillon à la recette. Fiche pain de mie aux graines Francine/T110 prête à copier.

- Recettes comme composants : bagels à la pièce, pain à la tranche avec équivalence explicite, sauces/pâtes/accompagnements, nutrition dynamique, besoins des menus et matières premières calculés après stock des composants ; assemblage et annulations sans double déduction.

- Bouton Supprimer sur les vignettes de recettes et dans l’éditeur : suppression d’une recette inutilisée, de ses parties et photos, confirmation et protection des menus/historiques de production.
- Page Importer distincte, brouillons à vérifier ; vignettes de recettes, photos et filtres latéraux.
- Photos personnelles et génération IA, stockage configurable, diagnostic et champ de dossier visible dans le template (PR #107).
- Cuisine hors menus : quantité libre en portions/pièces ou unités d’origine, sans ajustement aux objectifs des profils ; équivalence en poids estimé et conservation des valeurs lors du changement de mode.
- Fiche Cuisiner selon les menus : quantités nécessaires des menus pour tous les services, ingrédients ajustés séparément et production atomique des parties. Pas de recette complète proposée en repli ni d’arrondi aux unités entières de fabrication. Le calcul des pièces entières reste dans le choix des portions des menus, pas dans la fiche cuisine.
- Filtres données manquantes / nutrition / recettes planifiées ce mois et après ; badges des préparations et retour interne.
- Duplication d'aliment ; liens de recettes depuis les courses et depuis chaque aliment.
- Calories dans les choix de recettes du calendrier.
- Plafond à une portion pour les salades suggérées automatiquement ; couleurs des créneaux, repère hebdomadaire kcal et minima protéiques quotidiens configurables par personne dans Administration.
- Calendrier hebdomadaire imprimable en paysage, menus et quantités par personne uniquement.
- Catégories Salade et Sauce ; ajout de sauce par personne avec quantité fixe modifiable et zéro autorisé.
- Regroupement des préparations par recette et semaine, fiche Cuisiner, stocks et achats par magasin.
- Réserve kcal et occasions, livrées depuis 0.2.42. Aucun journal de consommation après repas à ajouter.

## Règles de reprise et livraison

Préserver modifications locales et stashes ; lire [REPRISE.md](REPRISE.md) et [STATUS.md](STATUS.md). Développer et vérifier localement sur données fictives, puis PR, contrôles, fusion et vérification de publication. **Jamais d'accès à Unraid ou à Nginx.**
