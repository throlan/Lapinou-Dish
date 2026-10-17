# État du projet — 17 octobre 2026

## Version de référence

Application **0.2.76**, publiée sur `main` par les PR [#104](https://github.com/throlan/Lapinou-Dish/pull/104) et [#105](https://github.com/throlan/Lapinou-Dish/pull/105), commit `a65ca7acaeb651805dce49775223da6a5c29607d`. La PR #104 ajoute le calendrier hebdomadaire imprimable en paysage ; #105 aligne la version et les URL cache des fichiers. La suite locale compte **219 tests réussis**. Les workflows [#263](https://github.com/throlan/Lapinou-Dish/actions/runs/39020828849) et [#265](https://github.com/throlan/Lapinou-Dish/actions/runs/39021072918) ont confirmé les tests et la publication GHCR. Un chantier local prépare la version **0.2.77** pour rendre visible le réglage `RECIPE_IMAGE_DIR=/images` dans le template Unraid et clarifier le stockage persistant des photos ; les 220 tests réussissent, mais ce chantier n’est pas publié. Voir le [journal du 17 octobre](SESSION-2026-10-17.md).

Pour reprendre le projet sur un autre poste : [cahier de reprise](REPRISE.md). Pour le détail des dernières modifications : [journal de session du 17 octobre](SESSION-2026-10-17.md).

Les tâches réellement restantes et les fonctions déjà livrées sont séparées dans [TODO.md](TODO.md). Les pistes détaillées restent dans [AMELIORATIONS.md](AMELIORATIONS.md) ; aucune nouvelle modification fonctionnelle ne doit démarrer sans demande de l’utilisateur.

**Règle impérative : aucune intervention de l'agent sur Unraid ni sur Nginx, y compris en lecture ou pour une vérification. L'utilisateur gère lui-même son installation et ses mises à jour.**

## Implémenté

- Authentification par mot de passe de foyer et session HTTP-only ; connexion sans actualisation nécessaire.
- Catalogue canonique Ciqual et aliments manuels, alias, conversions documentées, données inconnues conservées, édition et recherche de valeurs manquantes.
- Duplication des aliments et volet « Dans X recettes » avec liens vers les recettes mères distinctes.
- Filtres de données manquantes et de nutrition incomplète planifiée depuis le début du mois courant ; badges dans les préparations, retour interne et kcal dans les choix de recettes du calendrier.
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
- Stocks de produits et de préparations : inventaire initial, achats reçus, productions et repas marqués « Préparé », historique, annulations transactionnelles et protection contre les doubles déductions ; courses déduisant les stocks disponibles.
- Planning des routines de courses modifiable et persistant, avec confirmation visible après enregistrement.
- Courses regroupées par magasin et produit dans des panneaux repliables ; magasins modifiables sans perdre leurs associations d’aliments ni leur cible Home Assistant. « Préparations à faire » ne garde que les recettes avec une production à suivre, avec besoins restants après stock de plats.
- Docker/Compose pour environnement dédié, migrations ordonnées, import Ciqual idempotent et publication CI de l'image.

## Photos persistantes et génération d'illustrations — 0.2.65

Les photos sont stockées dans un dossier configurable (`RECIPE_IMAGE_DIR`) avec PostgreSQL comme repli si aucun dossier n'est déclaré. Le chantier 0.2.77 rend visible le champ « Recipe image folder » dans le template pour éviter un montage `/images` sans variable correspondante ; le résultat sur l’installation est à confirmer par l’utilisateur. Le chemin choisi pour le conteneur est `/images`, mappé côté hôte vers `/mnt/user/appdata/lapinoudish/images`. Au démarrage, les anciennes images PostgreSQL sont transférées dans le dossier configuré. L'import et la génération utilisent des variables de modèle distinctes (`OPENAI_RECIPE_MODEL` et `OPENAI_IMAGE_MODEL`). Une erreur `403 model_not_found` signale un accès absent au modèle image du projet associé à la clé API. Détails : [journal du 16 octobre](SESSION-2026-10-16.md).

## Vérification

La suite complète locale a réussi pour la version **0.2.76 : 219 tests**. Les contrôles GitHub de la PR #104 et le workflow de publication de la PR #105 ont réussi, y compris la publication de l’image GHCR. Les validations antérieures restent archivées dans les journaux. Aucune validation ni action sur l’installation de l’utilisateur n’est réalisée par l’agent.

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
