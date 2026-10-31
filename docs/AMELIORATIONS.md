# Cahier des améliorations proposées

## Féculents d’une recette composée — livré en 0.3.5

La ligne liée « Féculents » était assimilée à un accompagnement individuel et recevait 1 g. Elle doit être calculée avec le reste de la recette selon les proportions configurées, conservée au recalcul et enregistrée en grammes pour chaque personne. Un véritable accompagnement ajouté à part garde son choix individuel. Restaurer aussi le contraste des cartes d’ingrédients dans le thème clair. Les repas déjà enregistrés demandent un recalcul explicite, sans modification automatique des quantités historiques.

## Parties liées des recettes au calendrier — livré en 0.3.4

Les parties protéines/légumes/féculents d’une recette sont présentées comme des composants liés, sans les proposer comme accompagnements indépendants. La transition de trois parties à protéines/légumes ensemble et féculents séparés archive la partie retirée pour préserver les menus et stocks existants ; les nouveaux repas utilisent les parties actives. Le calcul de la quantité de viande reste inchangé, conformément à la demande de le laisser en attente.

Retirer un composant d’un repas retire la recette composée entière, pas seulement une partie qui deviendrait orpheline. Validation locale : **328 tests complets réussis**. PR #144 fusionnée au commit `79c790dd6f564157410d2020007d5bdcc44c4560` ; contrôles GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41208298921.

## Administration et lots minimums propres aux recettes — livré en 0.3.3

L’administration présente sept rubriques en onglets. Elle charge aussi les types de production dès son ouverture, avant toute édition, pour éviter l’envoi d’une liste incomplète et l’erreur `invalid-production-types`.

Les types de production ne portent plus de quantité minimum : ils regroupent les recettes. Chaque recette définit son lot minimum et son unité. Les équivalences convertissent ce minimum vers le rendement pour produire les ingrédients et réserver le surplus au stock. Exemple : un pain équivalent à 1 pièce et 10 tranches peut être produit par pain entier ; une recette de bagels peut avoir un lot de 24 pièces et des pancakes un lot de 36. La migration reprend une ancienne valeur partagée seulement lorsqu’une recette était seule dans le type ; en cas d’ambiguïté, les minimums sont laissés à zéro pour réglage manuel. PR #142, commit `f997a39eb1a23d12e276e8ac5b815036d77f2421`, **324 tests réussis**, publication GHCR `0.3.3` : https://github.com/throlan/Lapinou-Dish/actions/runs/40905467035 ; digest `sha256:dc2ec2fafaf286712f99a4b1dd4e3fd17326e5e05ae9bf6ff1d8debff5026a73`.

## Catégories personnalisées au calendrier — livré en 0.3.2

Le filtre du calendrier rejetait un type de recette personnalisé même lorsqu’une catégorie l’associait explicitement à un rôle standard, comme « Assaisonnement » avec le rôle « Sauce ». La sélection respecte maintenant le type exact déclaré par cette catégorie. Les recettes personnalisées commencent à une unité au lieu d’hériter du défaut de 30 g des sauces standard. Le rôle et la catégorie ne créent pas deux recettes ; les catégories distinctes activées gardent leurs boutons propres. PR #140, commit `d17030f18ba4546334cf78b6e116b1f1c4863baf`, **321 tests réussis**. Publication GHCR : https://github.com/throlan/Lapinou-Dish/actions/runs/40858994728 ; digest `sha256:09d71fc82d9e6862f7a982bdeb5b3d6cdb84a6e9cbeed24cc02661733a25ee5a`.

## Types de production et lots minimums — livré en 0.3.1

Administration permet d’ajouter des catégories de production, de les affecter à des recettes et de définir un minimum de lot avec une unité. Les besoins sont d’abord couverts par le stock ; le manque restant déclenche au moins le minimum configuré. Les ingrédients du lot complet alimentent les courses, et le surplus planifié couvre les menus ultérieurs. L’unité doit être prise en charge par le rendement ou les équivalences explicites de chaque recette concernée. Les lots réellement enregistrés suivent les stocks existants ; si aucun minimum n’est défini, le calcul précédent au besoin exact s’applique.

Validation : besoin de 4 bagels, lot de 24, ingrédients pour 24, puis 20 unités disponibles pour les menus suivants sans nouvel achat. Correctif calendrier testé pour charger les catégories dès l’ouverture. 319 tests locaux et contrôles GitHub réussis. PR #138 fusionnée ; publication GHCR vérifiée : https://github.com/throlan/Lapinou-Dish/actions/runs/40856567306.

## Catégories de repas et quantités individuelles — livré en 0.3.0

Administration configure les catégories complémentaires, leurs types de recette, leurs rôles de calcul et les créneaux où elles sont proposées. Les types personnalisés alimentent les fiches et filtres du répertoire. Le plat principal reste commun ; chaque ajout se choisit et se quantifie séparément par personne, et zéro équivaut à « aucun ». Les repas historiques et leurs quantités sont conservés.

PR #137 fusionnée au commit `5349f9b407400d44b6a0376ffb8f787a48b6883d`, publication et contrôles réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/40849807550. 315 tests locaux complets réussis à cette version.

## Publication : versions numérotées et retour arrière

Dernière version publiée vérifiée : **0.3.0**, PR #137, commit `5349f9b407400d44b6a0376ffb8f787a48b6883d`, workflow réussi https://github.com/throlan/Lapinou-Dish/actions/runs/40849807550. Le workflow publie les alias numériques et préfixés v depuis package.json, sans réécrire une version déjà publiée. Conservation sans suppression automatique : au minimum les cinq dernières versions publiées restent sélectionnables. Les images 0.2.95 à 0.2.99 ont été retrouvées par tag technique ; digests et révisions vérifiés et enregistrés dans docker/rollback-images.json. Le workflow rétablit leurs alias depuis les digests exacts, sans reconstruire les anciennes images. Voir [ROLLBACK.md](ROLLBACK.md).

Pour revenir à la 0.2.97 : ghcr.io/throlan/lapinou-dish:0.2.97. La 0.2.98 reste identifiée comme défectueuse au démarrage. Aucun changement de migration entre 0.2.97 et 0.2.99 ; une ancienne image ne restaure pas les données. Ne jamais supprimer les volumes pour changer de version. Aucun accès à Unraid/Nginx.

Mise en place validée par tests du script (alias exacts, idempotence, conservation, erreurs/conflits sans écrasement). Vérifier la publication et les manifests GHCR après fusion avant d’annoncer les alias disponibles.


## Maintenance — démarrage 0.2.99

Le module food-pagination.js de la 0.2.98 manquait dans les ressources servies, bloquant l’exécution du module principal. Route statique corrigée, test HTTP de toutes les dépendances ajouté ; les fonctions et priorités restent identiques.

## Catalogue alimentaire : pagination et lignes compactes — livrée 0.2.98

Précédent/Suivant sont disponibles en haut et en bas de la page Aliments. Le sélecteur de taille propose jusqu’à 250 fiches, limite appliquée côté serveur également. Les suppressions gardent la page courante et se replacent seulement si cette page n’existe plus. Sur ordinateur, nom, nombre de recettes liées, source, nutrition et actions sont alignés sur une seule ligne compacte.

Validation : 310 tests complets, puis 30 tests ciblés après la dernière modification de l’affichage. PR #132 fusionnée ; contrôles et publication GHCR réussis au commit `be007ef6b030bf22f800cbb703117227b9d2e578` : https://github.com/throlan/Lapinou-Dish/actions/runs/39977314240.

## Catalogue alimentaire : conversions de rendement et suppression groupée — livrée 0.2.97

Administration permet d’associer un aliment de départ à un aliment obtenu avec un rendement en grammes. Les recettes proposent ce coefficient sur les seules lignes correspondant à l’aliment de départ, sans réécrire les valeurs déjà enregistrées. Aux courses, l’aliment obtenu peut être converti inversement en aliment de départ ; une préférence « Acheter sous… » définie explicitement garde la priorité. Exemple : 1 g sec → 1,25 g égoutté, donc 250 g égouttés → 200 g secs.

Le catalogue n’impose plus une scrollbar verticale imbriquée. On peut sélectionner la page ou tous les résultats filtrés, consulter l’aperçu des éléments supprimables/protégés et supprimer en lot uniquement les aliments inutilisés. Les références de recettes, stocks, produits d’achat et conversions bloquent la suppression.

Validation : **308 tests locaux réussis** ; PR #130 fusionnée et publication GHCR réussie au commit `5d90528e2dd26f3b836221959be9a86379988231` : https://github.com/throlan/Lapinou-Dish/actions/runs/39966604840. Les contrôles de sélection groupée, protections et conversions inverses sont livrés.

## Renommer depuis le répertoire — 0.2.94

Bouton Renommer à côté du titre en grille et liste. Champ local avec Enregistrer le titre et Annuler, Entrée pour valider et Échap pour annuler ; titre obligatoire, espaces retirés aux extrémités et 200 caractères maximum. Les erreurs gardent la saisie, le conflit de version demande une actualisation. Aucun passage par l’éditeur complet.

PATCH limité au nom, sous verrou du foyer et contrôle de version. Les parties dérivées reprennent le titre de leur recette mère avec leur libellé de service, sans changer leurs identifiants, ingrédients, rendements, coefficients, nutrition ou historiques. Un renommage seul est permis pour un repas préparé ; les protections des modifications métier restent en place. Pas de migration.

Validation : **303 tests locaux réussis**, renommage PATCH réel PostgreSQL/PGlite avec repas préparé, parties dérivées, invariants nutritionnels, titre invalide, conflit de version et autre foyer. Chrome local sur données fictives aux cinq formats PC/tablette/mobile : renommage sur la fiche, annulation, clavier, grille/liste et aucune erreur inattendue ni débordement horizontal. Aucun appareil physique ni accès à Unraid/Nginx.


## Coefficients de cuisson par ingrédient — 0.2.93

Suppression des champs globaux Coefficient du plat et Coefficient féculents de l’éditeur et des Réglages rapides. Chaque aliment a son propre coefficient dans les ingrédients de l’éditeur et dans Affectation des ingrédients et cuisson des fiches. Ajout de Semoule — ×2 aux choix partagés, poids inchangé ×1 et autres choix conservés. Plusieurs féculents d’une même recette peuvent utiliser des valeurs différentes. Les préparations maison restent déjà préparées à ×1. Les champs de cuisson sont affichés pour tous les aliments et modes de service, pas seulement les féculents. Le contraste des blocs d’ingrédients est aligné sur la charte claire.

Compatibilité : aucune migration ni réécriture automatique. Une ancienne valeur héritée est résolue selon la priorité existante et affichée sur chaque ligne, même hors des valeurs prédéfinies. À l’enregistrement, elle devient explicite ; les nouveaux formulaires utilisent des valeurs globales neutres internes. Les anciens champs restent pris en charge pour les données et clients historiques. À coefficients identiques, poids, nutrition, quantités des menus et stocks restent identiques. Les protections des historiques et versions s’appliquent toujours. Aucun changement du moteur de portions 0.2.83/0.2.86.

Validation : **303 tests locaux réussis**, dont riz et haricots avec coefficients indépendants dans une même partie, semoule ×2, héritage ancien et personnalisé conservé, préparations maison ×1, enregistrement PATCH et apports inchangés. Chrome local sur base fictive à 1440/1280/900/390/320 px : absence des champs globaux, valeur héritée ×0,8 visible/conservée, sélection ×2 dans les réglages rapides et l’éditeur, persistance après enregistrement, parcours des vues et aucune erreur inattendue ni débordement horizontal. Pas d’appareil physique testé, aucun accès à Unraid/Nginx.


Mis à jour le 23 octobre 2026. Les améliorations livrées jusqu’à la 0.2.96 sont consignées ici comme références ; les pistes restantes sont des propositions à préciser avant leur mise en œuvre. Voir [STATUS.md](STATUS.md) pour l’état actuel et [SESSION-2026-10-23.md](SESSION-2026-10-23.md) pour le journal récent.

## Courses : équivalences des aliments et unités d’achat — en préparation pour la 0.2.96

Les règles « Acheter sous… » permettent de remplacer un aliment de recette par un produit d’achat du catalogue avec unités et coefficient explicites, par exemple 250 g de pois chiches cuits égouttés pour 200 g secs. Les règles sont propres au foyer et ne modifient ni la recette source ni son calcul nutritionnel. Dans la fiche aliment, le foyer peut aussi définir une unité d’achat par défaut : libellés singulier/pluriel, quantité contenue, unité et note. Les mesures d’ingrédients déjà renseignées (g/c. à café, etc.) convertissent le besoin vers les paquets affichés. Le format d’achat saisi directement sur une ligne reste prioritaire. La page Aliments avec modification et suppression protégée existait déjà et n’a pas été refaite.

Validation : 306 tests locaux réussis, y compris l’équivalence 250 g cuits → 200 g secs et la conversion de cuillères en sachet de 500 g.

## Recettes : filtre service, réglages rapides et affichage — 0.2.92

Depuis la 0.2.92, le répertoire ajoute un filtre Type de service (rendement pièces/portions, préparation entière en grammes, deux ou trois parties). Les Réglages rapides repliables de chaque fiche permettent de modifier service, rendement de base (quantité et unité : portions, pièces, tranches, g ou ml), coefficients et affectation des ingrédients pour un service séparé. Aucune affectation n’est déduite du nom d’un aliment. Les ingrédients, équivalences et autres champs sont conservés ; les mêmes validations et protections que l’éditeur complet s’appliquent. Les repas déjà préparés et historiques incompatibles peuvent empêcher une modification, avec explication. Les calculs de portions 0.2.83/0.2.86 restent inchangés.

Choix Grille/Liste, de 1 à 4 recettes par ligne sur PC et 12/24/48/96 recettes par page ; au maximum deux colonnes sur tablette et une sur mobile pour la lisibilité. Filtre service et préférences d’affichage mémorisés dans le navigateur. Rechargement des fiches et apports après enregistrement ; réglages de production et moments conservés.

Validation : **302 tests locaux réussis** ; PATCH réel PostgreSQL/PGlite (validation, versions, foyer, nutrition, services, références parentes, équivalences, historiques et retour arrière transactionnel). Chrome local sur données fictives : filtre, vues, pagination 30 recettes, persistance après rechargement, changement du rendement et du service, affectation des ingrédients, erreur corrigible ; PC 1440/1280, tablette 900 et mobile 390/320 px, sans erreur inattendue ni débordement horizontal. Impression d’origine conservée. Aucun test sur appareil physique, aucun accès à Unraid/Nginx.

## Expérience des recettes

### Séparer l’import des recettes

**Livré** : page Importer dédiée, imports et brouillons à vérifier avant association au catalogue et validation. Les améliorations de détection des doublons et de confort du parcours restent à préciser ; ne pas recréer cette page.

### Afficher les recettes en vignettes avec des filtres latéraux

**Livré** : grille paginée de vignettes avec photos, recherche et filtres latéraux sur ordinateur. Les réglages rapides sont conservés. Restent à évaluer la densité des fiches et le confort mobile des filtres, notamment un panneau repliable ; la grille elle-même n’est plus à créer.

### Améliorer l'affichage des photos dans les recettes

L'ajout, le remplacement, la suppression et la génération à la demande sont livrés. Le stockage persistant est configurable par `RECIPE_IMAGE_DIR`, avec repli PostgreSQL ; le template Unraid relie `/mnt/user/appdata/lapinoudish/images` à `/images` et rend visible le champ de configuration. Le montage seul ne suffit pas si `RECIPE_IMAGE_DIR` est absent ; la confirmation sur l’installation revient à l’utilisateur. Les photos sont affichées dans les vignettes. Reste à décider si le mode cuisine en a besoin. Ne pas intégrer automatiquement les images des publications externes sans vérification des droits et sans action explicite.

### Filtrer les recettes incomplètes

**Livré** : filtres données manquantes, nutrition, instructions et photo ; filtre nutrition incomplète parmi les recettes planifiées depuis le premier jour du mois courant et à venir, et badge dans les préparations à faire. Les liens et les quantités restent indépendants de ces filtres. Prolongement possible : détailler la cause par ingrédient ou conversion et faciliter sa correction. Une donnée inconnue ne devient jamais zéro.

## Publication Instagram dans Cuisiner

**Livré en 0.2.91**, demande ponctuelle avant la suite des priorités : incrustation de la publication correspondant au lien source Instagram, avec vidéo lorsque la publication en contient une et autorise sa lecture. Chargement au clic, arrêt au masquage/fermeture et lien de repli. Le lien seul ne permet pas de détecter sûrement une vidéo ; pas de scraping ni téléchargement. Les restrictions Instagram peuvent empêcher l’intégration. Ceci ne remplace pas la piste distincte des photos personnelles dans la fiche cuisine.

## Usage mobile et webapp

Le calendrier dispose d’une impression hebdomadaire A4 paysage, avec menus et quantités par personne uniquement (PR #104). La page Courses & stocks a reçu une première amélioration mobile en 0.2.68 : résumés Home Assistant plus courts, besoin visible sans déplier les produits et accès rapide aux mesures. **Livré en 0.2.89** : charte claire Magazine culinaire · Encre framboise, navigation latérale PC, haute tablette et basse mobile avec menu Plus. Cartes/photos valorisées et formulaires adaptés en conservant toutes les fonctions et calculs. Sept pages et fiches repas/aliment/cuisine/recette parcourues dans Chrome local à 1440, 1280, 900, 390 et 320 px, sur données fictives. Un retour sur appareils physiques reste utile. **Livré en 0.2.90** : webapp installable avec manifeste stable, icônes lapin/cocotte en formats standard, Apple et adaptatif Android, guide et bouton natif quand le navigateur le propose. Ouverture standalone ; bouton masqué dans ce mode. Mises à jour chargées à la réouverture/actualisation, sans service worker ni cache de données privées. Critères d’installation Chrome vérifiés localement ; retour sur appareils physiques à recueillir. Le mode hors ligne et la synchronisation différée sont des sujets distincts à étudier ensuite, car ils ajoutent des conflits de données et des contraintes de sécurité.

## Calendrier et repères nutritionnels

**Livré** : plafond de suggestion automatique à une portion pour les salades, couleurs de créneaux, comparaison kcal hebdomadaire, protéines quotidiennes par personne, minima configurables dans Administration et impression paysage avec quantités par personne (PR #101 à #105). Ne pas remettre ces fonctions dans les tâches restantes.

## Comptes utilisateurs et foyer — reportés

**Décision du 18 octobre 2026 : reporter ce chantier.** L’utilisateur envisage une application communautaire distribuable et éventuellement hébergée. Le modèle de compte/profil/appartenance au foyer et les droits doivent être conçus ensemble avant développement. La proposition binaire gestionnaire/membre n’est pas validée ; les éléments ci-dessous restent des pistes de cadrage. Aucun code de comptes individuels n’a été ajouté. Ne pas relancer sans nouvelle demande.

Aujourd’hui, l’accès est centré sur le foyer et ses profils de personnes. L’évolution doit distinguer explicitement le compte de connexion de la personne dont les menus et données sont suivis :

- Un compte appartient à un foyer et est associé à un profil de personne de ce foyer. Le foyer peut conserver des profils sans compte, notamment pour les enfants.
- Une personne connectée peut consulter son profil, ses mesures et son historique, modifier les informations autorisées et consulter les menus de la semaine du foyer.
- Prévoir des rôles compréhensibles, au minimum gestionnaire du foyer et membre. Le gestionnaire invite ou retire un membre et gère les profils du foyer ; les droits d’un membre sur les données des autres personnes doivent être définis explicitement.
- Prévoir invitation sécurisée, acceptation, révocation, départ d’un foyer, transfert de gestion et récupération de compte. Éviter le partage d’un mot de passe unique par toute la famille.
- Protéger particulièrement les informations de poids, taille, âge et besoins nutritionnels. Les membres mineurs nécessitent une gestion par un adulte responsable et ne devraient pas recevoir de compte autonome sans décision explicite.
- Définir les règles de conservation, d’export et de suppression du compte et des données du foyer avant la mise en production.

Une première étape raisonnable serait un compte par adulte, une association explicite à une personne du foyer, un rôle gestionnaire/membre et un contrôle d’accès côté serveur à chaque opération. Les invitations et la récupération de compte peuvent suivre dans un second temps.

## Projet communautaire public

Envisager une bibliothèque publique de recettes partageables, consultables et importables, distincte des foyers privés. Une publication doit être volontaire et ne jamais exposer le calendrier, les profils, les mesures, les stocks ou l’identité du foyer. Étudier avant ouverture : attribution et droits sur les recettes et images, modération et signalement, contenu nutritionnel sourcé, versions des recettes, import dans un foyer sans écraser ses fiches existantes, anti-spam et coûts d’hébergement.

Une première expérimentation pourrait se limiter à un catalogue public en lecture seule, alimenté par des recettes explicitement proposées par leurs auteurs et approuvées. Les commentaires, comptes publics, notes et contributions ouvertes sont des extensions à évaluer séparément.

## Prochaines décisions

La liste synthétique à jour est dans [TODO.md](TODO.md). Ordre décidé par l’utilisateur : 1. webapp installable (livrée en 0.2.90), 2. comptes individuels et foyers (reportés, modèle à cadrer avant développement), 3. aide à la correction des données nutritionnelles, 4. communauté publique, 5. nettoyage du catalogue. À la demande de l’utilisateur, le nettoyage du catalogue (filtre des aliments inutilisés puis fusion guidée des doublons) passe en dernière priorité : le cahier de recettes doit d’abord être consolidé. Préserver ensuite les références, stocks, conversions et magasins ; aucune suppression automatique. Le design responsive est livré en 0.2.89. Cet ordre reste une proposition ; attendre la demande de l’utilisateur avant de commencer.

## Recettes utilisées comme composants — réalisé en 0.2.82

« + Préparation maison » permet d’utiliser pain/bagel, sauce, pâtes et accompagnements dans les plats. Unités à la pièce, à la tranche, en portion, g ou ml selon les équivalences explicites ; apports dérivés et besoins des menus étendus aux composants après couverture par le stock. Les composants suivis sont produits avant les plats ; les ingrédients ne sont pas déduits deux fois. Les références, annulations et services indépendants sont protégés. Ce chantier ne doit pas être proposé à nouveau.

## Correction 0.2.86 — retour au calcul validé

Calcul initial 0.2.83 conservé, conversion en unités pratiques et arrondi au plus proche, compensation du delta kcal sur la soupe et même comportement lors des saisies manuelles. Les approches 0.2.84/85 sont abandonnées. Les équivalences renseignées restent la référence, sans masse de tranche inventée.

## Livré — produits d’achat et exclusions, 0.2.87

Acheter sous un produit commun avec équivalence explicite, stock partagé et addition avant arrondi ; sources nutritionnelles distinctes et liens de recettes conservés. Exclusions permanentes ou pour la période, réactivables. Les blancs ne sont pas regroupés automatiquement. La fusion d’aliments du catalogue demeure un chantier distinct.

## Livré — saisie des achats en unités, 0.2.88

Quantités achetées et stock compté suivent les règles d’achat explicites (œufs, pots…) ou le format de paquet prioritaire. Le nombre saisi est converti une seule fois vers l’unité interne ; équivalence et stock en unités affichés.
