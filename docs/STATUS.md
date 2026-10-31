# État du projet — 31 octobre 2026

## Batch cooking sur plusieurs semaines — 0.3.6

Dans « Courses & stocks > Préparations à faire », choisir la semaine de départ puis 1, 2 ou 3 semaines, ou toute la période des courses. Une seule liste regroupe chaque recette et ses quantités sur la plage affichée. Au premier affichage, la première semaine contenant un menu de batch est sélectionnée : une semaine partielle vide du 31 octobre au 1er novembre ne décale donc pas les semaines du 2 au 15 novembre 2026. L’option 1 semaine conserve les limites lundi–dimanche, bornées par les dates des courses. Toute la période ignore la semaine de départ ; les durées fixes sont limitées à la fin des courses.

Le navigateur demande un calcul unique de la plage au moteur existant, dans l’ordre des repas, avec un stock partagé et les minima propres aux recettes. Il n’additionne pas les projections hebdomadaires. Les repas antérieurs réservent toujours le stock en premier ; le surplus d’un lot minimum couvre les repas suivants. Après enregistrement d’une production, les besoins et le stock sont rechargés en conservant la sélection. Les libellés distinguent la couverture par stock et par lots prévus lorsqu’un minimum est configuré.

Les autres productions et la liste de courses gardent leur période actuelle ; cette portée est expliquée dans l’interface. Aucun menu, calcul de portions, règle viande/poisson ou migration n’est modifié. **336 tests complets locaux réussis**, dont une semaine partielle vide, deux semaines répétées, stock initial réservé une seule fois, lot minimum, conservation des menus et coordination des requêtes du navigateur. Parcours Chrome local fictif validé à 1440/900/390/320 px, sélection 1/2/3/période complète, production, stock actualisé, sans erreur JS/HTTP ni débordement horizontal. Contrôles GitHub et publication à vérifier après fusion.

## Féculents liés au plat et lisibilité de l’éditeur — 0.3.5 livrée

Le correctif fait participer les féculents d’une recette composée au calcul des portions avec la proportion configurée dans Administration. Il maintient leur quantité par personne lors de la lecture du formulaire et de l’enregistrement du repas. Un accompagnement réellement ajouté séparément reste individuel. Les cartes d’ingrédients du thème clair utilisent à nouveau un fond et une couleur de texte cohérents. Les repas déjà enregistrés gardent leurs quantités jusqu’à un recalcul explicite. Le calcul de viande/poisson reste inchangé. PR #146 fusionnée ; contrôles et publication GHCR : https://github.com/throlan/Lapinou-Dish/actions/runs/41210728818.

## Parties liées des recettes au calendrier — 0.3.4 livrée

Le calendrier marque les lignes générées depuis une même recette comme ses composants (protéines, légumes ou féculents), plutôt que comme de nouveaux choix d’accompagnement indépendants. Les quantités par personne restent visibles et modifiables. Le catalogue ne propose plus les parties dérivées comme des recettes autonomes.

Le passage du mode trois parties au mode protéines/légumes ensemble et féculents séparés archive la partie retirée. Les repas déjà enregistrés continuent de pointer vers leurs anciennes parties ; les nouveaux repas utilisent uniquement les parties actives. La réactivation ultérieure crée une nouvelle partie afin de préserver l’historique.

La demande de calculer séparément 125 g de viande ou poisson par portion est mise de côté à la demande de l’utilisateur ; le calcul des quantités reste inchangé. Retirer un composant lié retire la recette composée entière du repas. Migration `20261031_archived_serving_parts.sql`. **328 tests complets locaux réussis.** PR #144 fusionnée au commit `79c790dd6f564157410d2020007d5bdcc44c4560`. Contrôles GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41208298921. Aucun accès à Unraid/Nginx.

## Administration par rubriques et minimums par recette — 0.3.3 livrée

Le premier chargement de l’administration affiche maintenant les types existants ; auparavant leur liste n’était pas chargée à l’entrée, si bien qu’ajouter « Bagel » envoyait une liste incomplète et renvoyait `invalid-production-types`. La page est répartie en sept onglets accessibles au clavier pour réduire le défilement.

Les types de production classent les recettes ; le lot minimum est propre à chaque recette. Une équivalence explicite permet par exemple de produire 1 pain entier (350 g = 10 tranches), 24 bagels ou 36 pancakes et de calculer les ingrédients du lot ainsi que le surplus de stock. La migration reprend l’ancien minimum partagé uniquement lorsqu’une seule recette racine utilisait ce type ; en cas de plusieurs recettes, le réglage reste à zéro pour éviter d’imposer un lot commun inadapté. PR #142 fusionnée au commit `f997a39eb1a23d12e276e8ac5b815036d77f2421`. **324 tests locaux et contrôles GitHub réussis.** Image `ghcr.io/throlan/lapinou-dish:0.3.3`, digest `sha256:dc2ec2fafaf286712f99a4b1dd4e3fd17326e5e05ae9bf6ff1d8debff5026a73`. Publication : https://github.com/throlan/Lapinou-Dish/actions/runs/40905467035.

## Catégories personnalisées au calendrier — 0.3.2 livrée

Une recette de type personnalisé associée à une catégorie ayant le rôle « Sauce » était masquée par le filtre qui exigeait le type standard `sauce`. Le filtre respecte maintenant le type personnalisé déclaré par la catégorie. En outre, les recettes personnalisées ne récupèrent pas le défaut de 30 g du rôle Sauce : elles commencent à 1 unité. Le rôle et la catégorie ne créent pas de copie de recette. **321 tests locaux et contrôles GitHub réussis.** PR #140 fusionnée au commit `d17030f18ba4546334cf78b6e116b1f1c4863baf`. Publication GHCR vérifiée : https://github.com/throlan/Lapinou-Dish/actions/runs/40858994728 ; digest `sha256:09d71fc82d9e6862f7a982bdeb5b3d6cdb84a6e9cbeed24cc02661733a25ee5a`.

## Types de production et lots minimums — 0.3.1 livrée

Administration peut définir de nouveaux types de production, les attribuer aux recettes et définir pour chacun un lot minimum et son unité. Exemple : un minimum de 24 pièces pour les bagels transforme un besoin de 4 en fabrication de 24 ; les ingrédients des 24 pièces apparaissent dans les courses. Le surplus virtuel couvre les menus suivants, puis le stock réellement enregistré couvre les besoins après fabrication. Les unités configurées doivent exister dans le rendement ou les équivalences de chaque recette concernée ; l’administration refuse un réglage incompatible.

Le suivi des productions et les stocks de lots existaient déjà : les nouvelles productions sont créées en ajoutant un type puis en l’affectant à une recette. Les types personnalisés sont affichés dans « Préparations à faire ». La migration ajoute les réglages au foyer et autorise les identifiants de production personnalisés. Le comportement sans minimum conserve les calculs existants.

Le calendrier recharge maintenant aussi les catégories configurées du foyer ; sans cette lecture, les boutons de propositions n’étaient visibles qu’après être passé par l’administration. Le cas est couvert par un test.

Validation : **319 tests complets locaux réussis**, dont le scénario PostgreSQL/PGlite 4 burgers → 24 bagels et 480 g de farine, puis 20 bagels restants et aucun nouvel achat. Un test vérifie aussi le chargement des catégories d’ajouts dès l’ouverture du calendrier. Aucun accès à Unraid/Nginx.

PR #138 fusionnée au commit `351de3a47b82328efeb301923bb089c38f8970c9` ; contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/40856567306. L’image 0.3.1 est publiée avec le digest `sha256:a9c9548561fdfddc3a785fd3857ab6d753d33d60ade91f53318e10ac6285b0bf`.

## Catégories configurables et choix individuels — 0.3.0

PR #137 fusionnée au commit `5349f9b407400d44b6a0376ffb8f787a48b6883d`. Les contrôles et la publication GHCR ont réussi : https://github.com/throlan/Lapinou-Dish/actions/runs/40849807550. L’administration définit les catégories d’ajouts, leurs types de recettes, rôles et créneaux. Chaque ajout autre que le plat principal se choisit par personne ; zéro signifie « aucun ». **315 tests complets** passaient avant le chantier courant.

## Publication : versions numérotées et retour arrière

Dernière version publiée vérifiée : **0.3.0**, PR #137, commit `5349f9b407400d44b6a0376ffb8f787a48b6883d`; tests et publication réussis via le workflow ci-dessus. Le workflow publie les alias numériques et préfixés v depuis package.json, sans réécrire une version déjà publiée. Conservation sans suppression automatique : au minimum les cinq dernières versions publiées restent sélectionnables. Les images 0.2.95 à 0.2.99 ont été retrouvées par tag technique ; digests et révisions vérifiés et enregistrés dans docker/rollback-images.json. Le workflow rétablit leurs alias depuis les digests exacts, sans reconstruire les anciennes images. Voir [ROLLBACK.md](ROLLBACK.md).

Pour revenir à la 0.2.97 : ghcr.io/throlan/lapinou-dish:0.2.97. La 0.2.98 reste identifiée comme défectueuse au démarrage. Aucun changement de migration entre 0.2.97 et 0.2.99 ; une ancienne image ne restaure pas les données. Ne jamais supprimer les volumes pour changer de version. Aucun accès à Unraid/Nginx.

**314 tests complets locaux réussis**, dont tests du script (alias exacts, idempotence, conservation, erreurs/conflits sans écrasement). Livraison vérifiée : PR #135 fusionnée au commit 7af9a023c961637f780157b6665d31110d22be28 ; tests et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39991969857 . Les dix tags numériques/v des versions 0.2.95 à 0.2.99 ont été vérifiés directement dans GHCR et correspondent aux digests des images d’origine.


## Correctif de démarrage — 0.2.99

Cause reproduite sur le code 0.2.98 : app.js importe food-pagination.js, ajouté pour la pagination du catalogue, mais ce module n’était pas inscrit dans la liste des ressources statiques du serveur. GET /food-pagination.js renvoyait 404 avec un contenu JSON. Le navigateur ne pouvait donc pas exécuter app.js : connexion et tableau de bord restaient au chargement, sans gestionnaires utilisables sur les boutons.

Correction minimale : servir explicitement /food-pagination.js avec le type JavaScript, sans authentification préalable, comme les autres modules de démarrage. Version et clés de cache passent en 0.2.99. Aucun changement métier, calcul, pagination, donnée ou migration.

Un nouveau test parcourt les points d’entrée module du HTML et leurs dépendances locales via le vrai gestionnaire HTTP, avant connexion, avec contrôle du statut et du type MIME. Il échoue sur la 0.2.98 avec /food-pagination.js : 404, puis passe après correction. **311 tests complets locaux réussis**. Validation Chrome locale sur base fictive : connexion initiale et rechargement connecté, tableau de bord rempli, navigation sur les sept pages à 1440/1280/900/390/320 px, pagination haute/basse (25 puis 250 sélectionnés, 87 aliments fictifs), ouverture de la fiche aliment. Aucune erreur JS/HTTP ou ressource manquante ni débordement horizontal. Aucun appareil physique ou accès à l’installation. Dernière version publiée vérifiée avant ce correctif : 0.2.98, documentation PR #133, commit 6547d6a, workflow réussi https://github.com/throlan/Lapinou-Dish/actions/runs/39978043811 . Vérifier la publication du commit fusionné 0.2.99 avant d’annoncer la livraison. Aucun accès à Unraid/Nginx ; l’utilisateur déploie lui-même.

Les chapitres suivants décrivent les livraisons précédentes ; la référence courante du code est **0.2.99**.

## Catalogue alimentaire : pagination et lignes compactes — livrée 0.2.98

Le catalogue propose les boutons Précédent/Suivant au-dessus et au-dessous de la table, ainsi qu’un choix de 25 à 250 aliments par page. Les suppressions simples et groupées gardent la page affichée ; si sa dernière ligne disparaît, la liste revient à la dernière page encore valide. Sur ordinateur, chaque aliment tient sur une ligne compacte : nom, recettes liées, provenance, nutrition et actions. Le nombre de recettes est dans une colonne dédiée, les noms longs restent accessibles au survol.

Validation : **310 tests complets réussis**, puis 30 tests ciblés catalogue/API après la dernière retouche. PR #132 fusionnée au commit `be007ef6b030bf22f800cbb703117227b9d2e578` ; tests et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39977314240. Aucun accès à Unraid/Nginx.

## Catalogue alimentaire : conversions et gestion groupée — livrée 0.2.97

En cours : Administration permet d’associer un aliment de départ à l’aliment obtenu et d’indiquer le rendement en grammes (ex. 1 g sec → 1,25 g égoutté). La valeur est proposée comme coefficient de cuisson uniquement pour cet aliment ; les recettes déjà enregistrées ne sont pas réécrites. Pour les courses, l’aliment obtenu se convertit à l’inverse vers le produit de départ, sauf si une préférence explicite « Acheter sous… » est déjà définie. Le catalogue défile avec la page et garde sa pagination. Une sélection par page ou sur tous les résultats filtrés ouvre un aperçu ; recettes, stocks, regroupements d’achat et conversions protègent les fiches référencées. Suppression groupée uniquement des fiches inutilisées sélectionnées.

Validation : **308 tests locaux réussis** ; contrôles de la PR et tests du commit fusionné réussis. Publication GHCR réussie après PR #130, commit `5d90528e2dd26f3b836221959be9a86379988231` : https://github.com/throlan/Lapinou-Dish/actions/runs/39966604840. Pas de vérification visuelle navigateur ni d’accès à Unraid/Nginx pendant cette passe.

## Courses : équivalences d’achat configurables — 0.2.96

Depuis la fiche aliment dans la page Aliments, chaque foyer peut définir l’unité de vente habituelle, sa quantité et l’unité couverte, ainsi que des libellés singulier/pluriel et une note. Les conversions de recette déjà documentées (par exemple grammes par cuillère) sont utilisées pour afficher le nombre d’unités d’achat dans les courses ; la quantité nécessaire reste visible en détail. Un format de paquet saisi sur la ligne de courses garde la priorité. Les réglages sont propres au foyer. Les conversions entre deux aliments se définissent séparément dans « Acheter sous… » et appliquent le coefficient seulement aux courses et au stock commun, sans changer les recettes ni leur nutrition. Exemple vérifié : 250 g de pois chiches cuits égouttés → 200 g secs avec le coefficient 0,8. La page catalogue Aliments, ses champs modifiables et sa suppression protégée existaient déjà.

Validation : **306 tests locaux réussis**, incluant 3 c. à café de poudre à 2 g chacune achetée en sachet de 500 g (1 sachet), équivalence pois chiches 250 g → 200 g et conservation de la recette d’origine. Aucun accès à Unraid/Nginx.

## Import IA — traduction française des brouillons, 0.2.95

L'analyse OpenAI rédige désormais en français le titre, la description, les noms d'aliments, les instructions, avertissements et variantes, quelle que soit la langue source. Les citations exactes des ingrédients et le texte complet d'origine restent conservés pour vérification. Les 304 tests locaux et la publication GHCR ont réussi après la fusion de la PR #127 : https://github.com/throlan/Lapinou-Dish/actions/runs/39615679377.

## Renommer depuis le répertoire — 0.2.94

Bouton Renommer à côté du titre en grille et liste. Champ local avec Enregistrer le titre et Annuler, Entrée pour valider et Échap pour annuler ; titre obligatoire, espaces retirés aux extrémités et 200 caractères maximum. Les erreurs gardent la saisie, le conflit de version demande une actualisation. Aucun passage par l’éditeur complet.

PATCH limité au nom, sous verrou du foyer et contrôle de version. Les parties dérivées reprennent le titre de leur recette mère avec leur libellé de service, sans changer leurs identifiants, ingrédients, rendements, coefficients, nutrition ou historiques. Un renommage seul est permis pour un repas préparé ; les protections des modifications métier restent en place. Pas de migration.

Validation : **303 tests locaux réussis**, renommage PATCH réel PostgreSQL/PGlite avec repas préparé, parties dérivées, invariants nutritionnels, titre invalide, conflit de version et autre foyer. Chrome local sur données fictives aux cinq formats PC/tablette/mobile : renommage sur la fiche, annulation, clavier, grille/liste et aucune erreur inattendue ni débordement horizontal. Aucun appareil physique ni accès à Unraid/Nginx.


## Coefficients de cuisson par ingrédient — 0.2.93

Suppression des champs globaux Coefficient du plat et Coefficient féculents de l’éditeur et des Réglages rapides. Chaque aliment a son propre coefficient dans les ingrédients de l’éditeur et dans Affectation des ingrédients et cuisson des fiches. Ajout de Semoule — ×2 aux choix partagés, poids inchangé ×1 et autres choix conservés. Plusieurs féculents d’une même recette peuvent utiliser des valeurs différentes. Les préparations maison restent déjà préparées à ×1. Les champs de cuisson sont affichés pour tous les aliments et modes de service, pas seulement les féculents. Le contraste des blocs d’ingrédients est aligné sur la charte claire.

Compatibilité : aucune migration ni réécriture automatique. Une ancienne valeur héritée est résolue selon la priorité existante et affichée sur chaque ligne, même hors des valeurs prédéfinies. À l’enregistrement, elle devient explicite ; les nouveaux formulaires utilisent des valeurs globales neutres internes. Les anciens champs restent pris en charge pour les données et clients historiques. À coefficients identiques, poids, nutrition, quantités des menus et stocks restent identiques. Les protections des historiques et versions s’appliquent toujours. Aucun changement du moteur de portions 0.2.83/0.2.86.

Validation : **303 tests locaux réussis**, dont riz et haricots avec coefficients indépendants dans une même partie, semoule ×2, héritage ancien et personnalisé conservé, préparations maison ×1, enregistrement PATCH et apports inchangés. Chrome local sur base fictive à 1440/1280/900/390/320 px : absence des champs globaux, valeur héritée ×0,8 visible/conservée, sélection ×2 dans les réglages rapides et l’éditeur, persistance après enregistrement, parcours des vues et aucune erreur inattendue ni débordement horizontal. Pas d’appareil physique testé, aucun accès à Unraid/Nginx.


## Recettes : filtre service, réglages rapides et affichage — 0.2.92

Depuis la 0.2.92, le répertoire ajoute un filtre Type de service (rendement pièces/portions, préparation entière en grammes, deux ou trois parties). Les Réglages rapides repliables de chaque fiche permettent de modifier service, rendement de base (quantité et unité : portions, pièces, tranches, g ou ml), coefficients et affectation des ingrédients pour un service séparé. Aucune affectation n’est déduite du nom d’un aliment. Les ingrédients, équivalences et autres champs sont conservés ; les mêmes validations et protections que l’éditeur complet s’appliquent. Les repas déjà préparés et historiques incompatibles peuvent empêcher une modification, avec explication. Les calculs de portions 0.2.83/0.2.86 restent inchangés.

Choix Grille/Liste, de 1 à 4 recettes par ligne sur PC et 12/24/48/96 recettes par page ; au maximum deux colonnes sur tablette et une sur mobile pour la lisibilité. Filtre service et préférences d’affichage mémorisés dans le navigateur. Rechargement des fiches et apports après enregistrement ; réglages de production et moments conservés.

Validation : **302 tests locaux réussis** ; PATCH réel PostgreSQL/PGlite (validation, versions, foyer, nutrition, services, références parentes, équivalences, historiques et retour arrière transactionnel). Chrome local sur données fictives : filtre, vues, pagination 30 recettes, persistance après rechargement, changement du rendement et du service, affectation des ingrédients, erreur corrigible ; PC 1440/1280, tablette 900 et mobile 390/320 px, sans erreur inattendue ni débordement horizontal. Impression d’origine conservée. Aucun test sur appareil physique, aucun accès à Unraid/Nginx.

Les sections ci-dessous conservent le contexte des versions précédentes ; la référence courante est **0.2.94**. Dernière publication vérifiée avant ce chantier : PR #123, commit 836735f, tests et publication GHCR réussis. Vérifier le workflow du commit fusionné de la 0.2.92 après livraison.

## Version de référence

Application **0.2.91** : volet Instagram dans Cuisiner à partir de la source, lecteur à la demande et lien de repli, sur la webapp installable, icône lapin/cocotte et guide d’installation, sur la charte claire Magazine culinaire · Encre framboise, navigation et formulaires responsive PC/tablette/mobile, photos valorisées. Fonctionnalités et calculs inchangés. La 0.2.88 conserve les achats et stock compté saisis dans l’unité d’achat affichée lorsqu’elle est configurée (ex. 26 œufs, 1 œuf = 50 g), stock affiché aussi dans cette unité, conversion unique vers les API de stock existantes. Les regroupements/exclusions de la 0.2.87 et le calcul 0.2.86 sont conservés. **298 tests locaux réussis**. Chargement/arrêt du volet Instagram vérifiés sur publication fictive interceptée, sans lecture réelle confirmée. Manifeste et critères d’installation Chrome vérifiés sans erreur dans un profil local jetable, invitation native disponible ; installation OS réelle non effectuée. Sept pages et fiches principales vérifiées dans Chrome local sur données fictives à 1440, 1280, 900, 390 et 320 px (émulation, pas appareils physiques). Dernière publication applicative vérifiée avant ce chantier : 0.2.91, PR #122, commit c3bf80e, [contrôles et GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/39129593328).

Pour reprendre le projet sur un autre poste : [cahier de reprise](REPRISE.md). Pour le détail des dernières modifications : [journal de session du 23 octobre](SESSION-2026-10-23.md).

Les tâches réellement restantes et les fonctions déjà livrées sont séparées dans [TODO.md](TODO.md). Les pistes détaillées restent dans [AMELIORATIONS.md](AMELIORATIONS.md) ; aucune nouvelle modification fonctionnelle ne doit démarrer sans demande de l’utilisateur.

**Règle impérative : aucune intervention de l'agent sur Unraid ni sur Nginx, y compris en lecture ou pour une vérification. L'utilisateur gère lui-même son installation et ses mises à jour.**

## Décisions de suite

Gestion des comptes individuels explicitement reportée : modèle communautaire/hébergé et droits non validés, aucun code ajouté. Une seule collation l’après-midi est souhaitée mais sa transition depuis les cinq créneaux n’est pas implémentée. La recherche sur la répartition des repas n’a changé ni réglages ni quotas selon l’âge. Aucun autre chantier ne démarre automatiquement.

## Implémenté

- Cuisiner 0.2.91 : source Instagram HTTPS p/reel/tv reconnue, publication chargée au clic dans un lecteur isolé (vidéo si la publication en contient une). Masquage/fermeture/Escape retirent le lecteur. Lien Instagram toujours disponible en repli. Les publications privées/supprimées ou refusant l’intégration restent dépendantes d’Instagram ; aucune copie locale ni garantie de lecture. Recettes et autres sources inchangées.

- Webapp installable 0.2.90 : manifeste stable, icônes standards/Apple/Android adaptatives et favicon, installation native proposée si disponible, instructions iOS/Android/PC sinon. Bouton dans la navigation PC/tablette et menu Plus mobile ; masqué en standalone. Pas de service worker, cache hors ligne, copie de données ni changement de session/API. Mise à jour par rechargement/réouverture. Le lapin est adapté du logo fourni par l’utilisateur via image_gen.

- Design clair Magazine culinaire · Encre framboise : navigation latérale PC (≥1200 px), haute tablette (768–1199 px), basse mobile (<768 px) avec menu Plus. Sept destinations conservées, cartes photos, titres éditoriaux et contrôles tactiles. Adaptation des formulaires, calendrier, courses et fiches cuisine ; impression A4 d’origine préservée. Aucun changement des données, calculs, API métier ou stocks. PWA livrée en 0.2.90 ; hors ligne non inclus.

- Import IA/texte : rendement en tranches conservé jusque dans la recette enregistrée ; fiche pain de mie Francine/T110 avec huit ingrédients fixes disponible dans docs/recettes/.

- Composants de recettes : pain, sauce, pâtes et accompagnements réutilisables via « + Préparation maison » ; unités natives et équivalences par recette complète, dont tranche. Apports calculés récursivement ; fabrication selon les besoins réels et mutualisation du stock avec les menus directs. Les composants suivis sont à fabriquer avant le plat ; leur utilisation ne déduit pas leurs ingrédients une seconde fois. Annulation réversible et protections des cycles, foyers, unités historiques et recettes référencées.

- Authentification par mot de passe de foyer et session HTTP-only ; connexion sans actualisation nécessaire.
- Catalogue canonique Ciqual et aliments manuels, alias, conversions documentées, données inconnues conservées, édition et recherche de valeurs manquantes.
- Duplication des aliments et volet « Dans X recettes » avec liens vers les recettes mères distinctes.
- Filtres de données manquantes et de nutrition incomplète planifiée depuis le début du mois courant ; badges dans les préparations, retour interne et kcal dans les choix de recettes du calendrier.
- Suppression explicite et confirmée des recettes inutilisées, depuis une vignette ou l’éditeur ; les parties et photos associées sont retirées. Refus si un menu ou un historique de production utilise la recette ou une partie ; contrôle du foyer et de la version courante. Les fichiers photo sont nettoyés après commit, avec avertissement si ce nettoyage échoue.
- Création/édition de recettes, calcul par batch et rendement, types et moments distincts, filtres et recherche. Grille de vignettes paginée (12 recettes), photos, filtres latéraux, détails repliés et réglages de production/moments enregistrables directement sur chaque ligne sans modifier les ingrédients.
- Page Importer distincte ; import de texte/archives en brouillons, OpenAI optionnel et tentative de récupération de description Instagram avec repli texte.
- Calendrier à cinq créneaux, participants explicites, repas multi-recettes, boissons/desserts individuels et duplication complète sur plusieurs dates. Au petit-déjeuner et aux deux collations, les desserts adaptés peuvent aussi être ajoutés comme recette commune et bénéficier du calcul de portions ; au déjeuner et au dîner, le dessert individuel s’ajoute avec « + Dessert ».
- Calendrier imprimable en A4 paysage sur sept colonnes ; l’impression affiche seulement les menus et les quantités pour chaque personne.
- Préparation entière en grammes estimés, deux ou trois parties indépendantes, coefficients de cuisson, conversions des repas/lots existants et conservation des ingrédients crus.
- Ingrédients en blocs lisibles ; liens en bas ; coefficient individuel affiché pour les féculents sélectionnés.
- Administration : profils compacts et datés, relevés de poids et historiques ; répartition des kcal à 100 %, par défaut 15/40/10/25/10 %.
- Minima quotidiens de protéines configurables par personne dans Administration et affichés sous les prévisions kcal de chaque jour ; le récapitulatif par personne utilise le repère hebdomadaire daté.
- Lignes kcal/protéines par personne dans l'éditeur ; calendrier allégé et bilan kcal prévu/objectif en bas de chaque journée.
- Propositions plafonnées et recalcul explicite ; petit-déjeuner limité automatiquement à deux pièces, une portion ou poids correspondant selon le rendement.
- Les propositions automatiques plafonnent les salades à une portion par personne ; couleurs de créneaux dédiées et repère kcal hebdomadaire dans le calendrier.
- Rééquilibrage de la journée pour les adultes : aperçu, correction du petit-déjeuner, réduction éventuelle du déjeuner/dîner, conservation du repère protéique de ces repas et refus des aperçus obsolètes.
- Fiche Cuisiner : deux modes explicites, Selon les menus et Hors menus — quantité libre. Le mode libre permet notamment de préparer 6 ou 8 portions d’une recette de base pour 4, sans ajustement nutritionnel personnel, avec poids estimé comme repère. Les valeurs des deux modes restent indépendantes.
- Selon les menus : besoins cumulés des menus dans les unités servies, stock disponible déduit, pas d’arrondi aux portions entières de la recette source. Deux/trois services : quantité et ingrédients propres à chaque partie. Enregistrement atomique, aucune production implicite d’une partie à zéro, et aucun lot complet proposé si les besoins sont absents.
- Stocks de produits et de préparations : inventaire initial, achats reçus, productions et repas marqués « Préparé », historique, annulations transactionnelles et protection contre les doubles déductions ; courses déduisant les stocks disponibles.
- Planning des routines de courses modifiable et persistant, avec confirmation visible après enregistrement.
- Courses regroupées par magasin et produit dans des panneaux repliables ; magasins modifiables sans perdre leurs associations d’aliments ni leur cible Home Assistant. « Préparations à faire » ne garde que les recettes avec une production à suivre, avec besoins restants après stock de plats.
- Docker/Compose pour environnement dédié, migrations ordonnées, import Ciqual idempotent et publication CI de l'image.

## Photos persistantes et génération d'illustrations — 0.2.65

Les photos sont stockées dans un dossier configurable (`RECIPE_IMAGE_DIR`) avec PostgreSQL comme repli si aucun dossier n'est déclaré. La version 0.2.77 rend visible le champ « Recipe image folder » dans le template pour éviter un montage `/images` sans variable correspondante ; le résultat sur l’installation est à confirmer par l’utilisateur. Le chemin choisi pour le conteneur est `/images`, mappé côté hôte vers `/mnt/user/appdata/lapinoudish/images`. Au démarrage, les anciennes images PostgreSQL sont transférées dans le dossier configuré. L'import et la génération utilisent des variables de modèle distinctes (`OPENAI_RECIPE_MODEL` et `OPENAI_IMAGE_MODEL`). Une erreur `403 model_not_found` signale un accès absent au modèle image du projet associé à la clé API. Détails : [journal du 16 octobre](SESSION-2026-10-16.md).

## Vérification

Validation 0.2.88 : **287 tests locaux réussis**. Cas 26 œufs/1300 g, stock 8 œufs/400 g, saisies réelles de 30 œufs et comptage de 12, conversion unique des requêtes, paquets prioritaires et comptage de demi-paquet, absence de conversion inventée, plus régressions des regroupements et du stock PostgreSQL/PGlite. Aucun nouveau parcours visuel navigateur confirmé. Aucune migration supplémentaire.

Les tests PostgreSQL/PGlite exécutent les migrations SQL et les requêtes réelles. Les parcours d'interface ont été vérifiés dans Chrome sur une base locale et des données synthétiques. Cela ne constitue pas une validation de l'installation de l'utilisateur.

## Composition des assiettes — 0.2.48

Branche **feat/plate-weight-ratios** : proportions en poids estimé servi par foyer, réglables dans Administration. Défauts : 100 % entier ; 70/30 viande-légumes/féculents ; 25/25/50 protéines/féculents/légumes. Totaux validés à 100 %, exemples en grammes et recalcul explicite. Les parties liées conservent leur composition lors de l'ajustement protéique et du rééquilibrage quotidien.

La PR 60 est fusionnée, tests et publication réussis (workflow 171). Détails : [session du 14 octobre](SESSION-2026-10-14.md).

Les liens de commande (PR 59) sont déjà livrés. L'utilisateur a confirmé que les coupures PostgreSQL sont réglées ; elles ne sont plus une tâche à reprendre. Aucune connexion de l'agent à l'installation.

Piste éventuelle : composants et variantes de recette indépendants au-delà des parties de service actuelles ; à préciser seulement si l'utilisateur souhaite poursuivre.

Les totaux du calendrier restent prévisionnels. L'utilisateur ne souhaite pas de journal de consommation réelle ni de saisie après repas.

Le brouillon `drafts/ENERGY-RESERVE.md` est historique : le système correspondant a été livré en 0.2.42. Ne pas le compter dans le reste à faire.

## Achats en ligne — 0.2.49

Développement sur feat/online-shopping-by-store : affectations par foyer de plusieurs aliments à une boutique, réutilisation des liens de commande, listes de courses par marchand et renommage des libellés whey/farines en Achats en ligne. Stocks, paquets, cases acheté et aliments sans boutique préservés. Les affectations sont modifiables dans le panneau ou directement depuis les courses.

La PR 62 a été fusionnée et la publication de l'image a réussi dans le workflow 175. Guide : [ONLINE-SHOPPING.md](ONLINE-SHOPPING.md). Détails dans [la session du 14 octobre](SESSION-2026-10-14.md).

## Magasins physiques et exports — 0.2.50

Livré : URL facultative pour les magasins ; regroupement et filtre par magasin ; copie et fichier texte par magasin ; envoi optionnel vers les listes `todo` Home Assistant. Suggestions d'achat : ail en gousses/têtes, basilic en bouquets, gingembre en racines indicatives de 50–80 g. Alexa ne fournit plus d'API officielle pour écrire directement dans ses listes.

## Unités d'achat personnalisées — 0.2.51

Livré : libellés singulier/pluriel, équivalence chiffrée et note d'estimation réglables par foyer et aliment depuis les détails d'une ligne de courses. Les besoins du même aliment sont réunis si leurs unités disposent d'une conversion documentée ; sinon ils restent visibles séparément avec un avertissement. Le format de paquet manuel existant reste prioritaire. Voir [le guide](ONLINE-SHOPPING.md).

## Stock des produits — 0.2.52

Livré en 0.2.52 (PR 66, workflow 183) : stock initial par aliment, saisi dans l'unité de la ligne de courses ou en grammes ; achats réellement reçus ajoutés au stock avec protection contre les doublons ; retrait des ingrédients lors d'une production ou de la validation « Préparé » sur un repas du calendrier. Un repas utilisant un batch enregistré ne déduit pas ses ingrédients une seconde fois. Annulation et historique des mouvements disponibles. La liste de courses tient compte du stock ; les conversions manquantes sont signalées. Voir [le guide](PRODUCT-INVENTORY.md).

## Suite

Voir [TODO.md](TODO.md) pour les prochaines décisions : nettoyage du catalogue, aide à la correction nutritionnelle, mobile/PWA, comptes et communauté. Les filtres, les vignettes avec photos et la page Importer sont déjà livrés ; ils ne sont plus des chantiers à démarrer.

La fiche « Cuisiner » et le regroupement des préparations ont été livrés sur `main` (PR 79, version 0.2.61). Le dessert commun pour les deux collations est livré via la PR 80. L'utilisateur met lui-même à jour son installation ; l'agent ne la vérifie pas.

## Guides actuels du projet

- [Objectifs kcal et rééquilibrage](MEAL-ENERGY.md)
- [Grammes estimés et parties de service](SERVING-GRAMS.md)
- [Duplication des repas](MEAL-DUPLICATION.md)
- [Desserts individuels](INDIVIDUAL-DESSERTS.md)
- [Ingrédients surveillés](INGREDIENT-STOCK.md)
- [Stock des produits](PRODUCT-INVENTORY.md)
- [Page Courses & stocks](SHOPPING-STOCK-PAGE.md)
- [Achats en ligne par boutique](ONLINE-SHOPPING.md)
- [Import OpenAI](OPENAI-RECIPE-IMPORT.md)
- [Cahier des améliorations proposées](AMELIORATIONS.md)
