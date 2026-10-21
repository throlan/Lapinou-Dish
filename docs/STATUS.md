# État du projet — 21 octobre 2026

## Coefficients de cuisson par ingrédient — 0.2.93

Suppression des champs globaux Coefficient du plat et Coefficient féculents de l’éditeur et des Réglages rapides. Chaque aliment a son propre coefficient dans les ingrédients de l’éditeur et dans Affectation des ingrédients et cuisson des fiches. Ajout de Semoule — ×2 aux choix partagés, poids inchangé ×1 et autres choix conservés. Plusieurs féculents d’une même recette peuvent utiliser des valeurs différentes. Les préparations maison restent déjà préparées à ×1. Les champs de cuisson sont affichés pour tous les aliments et modes de service, pas seulement les féculents. Le contraste des blocs d’ingrédients est aligné sur la charte claire.

Compatibilité : aucune migration ni réécriture automatique. Une ancienne valeur héritée est résolue selon la priorité existante et affichée sur chaque ligne, même hors des valeurs prédéfinies. À l’enregistrement, elle devient explicite ; les nouveaux formulaires utilisent des valeurs globales neutres internes. Les anciens champs restent pris en charge pour les données et clients historiques. À coefficients identiques, poids, nutrition, quantités des menus et stocks restent identiques. Les protections des historiques et versions s’appliquent toujours. Aucun changement du moteur de portions 0.2.83/0.2.86.

Validation : **303 tests locaux réussis**, dont riz et haricots avec coefficients indépendants dans une même partie, semoule ×2, héritage ancien et personnalisé conservé, préparations maison ×1, enregistrement PATCH et apports inchangés. Chrome local sur base fictive à 1440/1280/900/390/320 px : absence des champs globaux, valeur héritée ×0,8 visible/conservée, sélection ×2 dans les réglages rapides et l’éditeur, persistance après enregistrement, parcours des vues et aucune erreur inattendue ni débordement horizontal. Pas d’appareil physique testé, aucun accès à Unraid/Nginx.


## Recettes : filtre service, réglages rapides et affichage — 0.2.92

Depuis la 0.2.92, le répertoire ajoute un filtre Type de service (rendement pièces/portions, préparation entière en grammes, deux ou trois parties). Les Réglages rapides repliables de chaque fiche permettent de modifier service, rendement de base (quantité et unité : portions, pièces, tranches, g ou ml), coefficients et affectation des ingrédients pour un service séparé. Aucune affectation n’est déduite du nom d’un aliment. Les ingrédients, équivalences et autres champs sont conservés ; les mêmes validations et protections que l’éditeur complet s’appliquent. Les repas déjà préparés et historiques incompatibles peuvent empêcher une modification, avec explication. Les calculs de portions 0.2.83/0.2.86 restent inchangés.

Choix Grille/Liste, de 1 à 4 recettes par ligne sur PC et 12/24/48/96 recettes par page ; au maximum deux colonnes sur tablette et une sur mobile pour la lisibilité. Filtre service et préférences d’affichage mémorisés dans le navigateur. Rechargement des fiches et apports après enregistrement ; réglages de production et moments conservés.

Validation : **302 tests locaux réussis** ; PATCH réel PostgreSQL/PGlite (validation, versions, foyer, nutrition, services, références parentes, équivalences, historiques et retour arrière transactionnel). Chrome local sur données fictives : filtre, vues, pagination 30 recettes, persistance après rechargement, changement du rendement et du service, affectation des ingrédients, erreur corrigible ; PC 1440/1280, tablette 900 et mobile 390/320 px, sans erreur inattendue ni débordement horizontal. Impression d’origine conservée. Aucun test sur appareil physique, aucun accès à Unraid/Nginx.

Les sections ci-dessous conservent le contexte des versions précédentes ; la référence courante est **0.2.93**. Dernière publication vérifiée avant ce chantier : PR #123, commit 836735f, tests et publication GHCR réussis. Vérifier le workflow du commit fusionné de la 0.2.92 après livraison.

## Version de référence

Application **0.2.91** : volet Instagram dans Cuisiner à partir de la source, lecteur à la demande et lien de repli, sur la webapp installable, icône lapin/cocotte et guide d’installation, sur la charte claire Magazine culinaire · Encre framboise, navigation et formulaires responsive PC/tablette/mobile, photos valorisées. Fonctionnalités et calculs inchangés. La 0.2.88 conserve les achats et stock compté saisis dans l’unité d’achat affichée lorsqu’elle est configurée (ex. 26 œufs, 1 œuf = 50 g), stock affiché aussi dans cette unité, conversion unique vers les API de stock existantes. Les regroupements/exclusions de la 0.2.87 et le calcul 0.2.86 sont conservés. **298 tests locaux réussis**. Chargement/arrêt du volet Instagram vérifiés sur publication fictive interceptée, sans lecture réelle confirmée. Manifeste et critères d’installation Chrome vérifiés sans erreur dans un profil local jetable, invitation native disponible ; installation OS réelle non effectuée. Sept pages et fiches principales vérifiées dans Chrome local sur données fictives à 1440, 1280, 900, 390 et 320 px (émulation, pas appareils physiques). Dernière publication applicative vérifiée avant ce chantier : 0.2.91, PR #122, commit c3bf80e, [contrôles et GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/39129593328).

Pour reprendre le projet sur un autre poste : [cahier de reprise](REPRISE.md). Pour le détail des dernières modifications : [journal de session du 21 octobre](SESSION-2026-10-21.md).

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
