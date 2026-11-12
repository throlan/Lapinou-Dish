# Cahier produit Lapinou Dish

## Notation des recettes historiques — 0.7.1

Certaines recettes historiques (notamment les boissons ajoutées par la migration 0009) possèdent un identifiant PostgreSQL issu d’un MD5, sans bits de version/variante RFC. La notation les refusait avec le message trompeur « Choisis une note entière entre 1 et 5 ». La validation du seul identifiant recette des votes accepte désormais ces UUID au format canonique. Les notes restent des entiers de 1 à 5 ; participation au repas, date, foyer et identité du compte restent contrôlés. Plusieurs recettes peuvent être notées à la suite, puis la note modifiée ou retirée sans double vote.

Aucune migration, réécriture des identifiants, modification des calculs, des menus, des stocks ou des historiques. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur uniquement. Validation : 410 tests complets réussis, dont une reproduction qui échouait avant correction. Vérification dans Chrome local temporaire : quatre recettes fictives notées successivement, modification et retrait d’une note, trois votes restants confirmés côté serveur. Publication GitHub/GHCR à vérifier après fusion.

## Recettes : cartes et droits — 0.7.0

Les badges kcal, moyenne des avis, whey et validation sont superposés à la photo. Cuisiner reste l’action principale ; le menu ⋯ regroupe les actions secondaires et ouvre les réglages rapides à la demande. Grille/liste, nombre de colonnes et pagination sont conservés. Recherche, type, moment et relecture tiennent dans une barre compacte ; service, données manquantes et avis restent dans Plus de filtres. Les filtres actifs s’effacent individuellement ou ensemble. Présentation responsive PC, tablette et mobile.

Photo et duplication sont réservées à l’administrateur de l’application ou au gestionnaire du foyer actif. Modifier, renommer, supprimer et régler une recette sont également permis à son créateur. Ces droits sont contrôlés côté serveur dans le foyer actif, pas seulement par masquage des boutons. Le créateur réel des nouvelles recettes est enregistré depuis la session ; il n’est pas déduit pour les anciennes recettes, qui restent gérées par les administrateurs/gestionnaires. Une copie privée importée appartient à son importateur ; l’identité du créateur ne circule pas dans les publications. Les nouvelles versions structurelles conservent le créateur d’origine. Les suppressions restent soumises aux protections des références existantes.

Les calculs des portions, menus, stocks et historiques restent conservés. La référence fonctionnelle 0.3.32 reste figée. Aucun accès à Unraid ni Nginx. Contrôles : 409 tests réussis et parcours Chrome local sur données fictives aux trois formats ; vérification des droits directs par API, des copies importées et de l’isolation des foyers.


## Fiche Cuisiner, étapes et validation de relecture — 0.6.0

La fiche Cuisiner adopte une présentation éditoriale Encre framboise : photo ronde, repères de temps, mode de cuisson/température, difficulté et moyenne des avis ; ingrédients cochables à gauche et étapes numérotées à droite sur PC, puis une colonne sur mobile. Les quantités et les modes menus/hors menus restent dans « Ajuster ». Les enregistrements de productions, réservations, sources et publications Instagram sont conservés.

L’éditeur propose préparation, repos/pause et cuisson en minutes, température en °C, mode de cuisson et difficulté choisie (non renseignée, facile, intermédiaire, difficile). Une étape par champ, avec ajout, suppression et déplacement. Le texte historique reste intact en base jusqu’à une édition ; il se présente automatiquement en étapes sans supprimer son contenu. Les valeurs absentes restent non renseignées. Les temps exprimés explicitement dans le texte peuvent préremplir l’éditeur sans être inventés.

Le rappel de préchauffage est affiché seulement pour le four, avec durée et température renseignées, sans repos déclaré ou mentionné dans les étapes, et sans instruction de préchauffage existante. Il n’est pas enregistré comme une nouvelle étape et ne modifie pas la recette. Les durées de cuisson ne sont pas multipliées avec les ingrédients.

Imports texte, archives Norish/Tandoor et parsing IA transmettent étapes et informations de préparation au même éditeur de brouillon. L’IA produit directement une liste d’étapes ; la version texte compatible est reconstruite sans payer deux sorties identiques. Les durées et difficultés absentes ne sont pas déduites. Le temps d’attente ambigu de Tandoor est conservé dans l’original et signalé à la vérification, sans le transformer arbitrairement en cuisson ou repos (contexte du format : https://github.com/TandoorRecipes/recipes/discussions/1790).

« Recette validée » est un repère manuel de relecture, jamais un verrou. Toutes les recettes existantes commencent non validées. La coche est conservée lors des modifications et peut être retirée ; ingrédients, quantités, rendement et étapes restent modifiables. La liste possède un filtre Toutes / Non validées / Validées, mémorisé dans le navigateur, et un badge sur les fiches validées. Une duplication ou une importation dans un autre foyer repart non validée ; la validation locale n’est pas publiée avec la recette.

Les colonnes ajoutées n’altèrent ni les menus ni les stocks et ne recalculent pas les portions. La release fonctionnelle 0.3.32 reste conservée. Aucun accès à Unraid ni Nginx.

## Comptes, catalogue commun et avis — 0.5.0

Les écrans Comptes et foyers séparent Mon compte, Mon foyer et Administration de l’application. Mes accès affiche le rôle global, le foyer actif et le rôle dans ce foyer. Un gestionnaire est aussi membre. L’administrateur peut associer directement un compte, un rôle et un profil dans chaque foyer depuis la gestion des foyers ; les derniers administrateur et gestionnaire actifs restent protégés.

Tous les aliments existants et nouveaux sont communs par défaut, quelle que soit leur provenance. Les stocks, magasins, formats et unités d’achat restent propres au foyer. Les nouvelles fiches peuvent être ajoutées par les gestionnaires ; les modifications de définitions existantes sont réservées à l’administrateur. Les autres utilisateurs proposent une correction depuis la fiche. L’administrateur compare avant/proposé dans Partage et démarrage, puis accepte ou refuse. Une proposition ne change rien avant validation ; une fiche modifiée depuis la proposition provoque un conflit explicite. Aucune valeur nutritionnelle n’est inventée et aucun doublon alimentaire existant n’est fusionné automatiquement.

Le partage des recettes possède une recherche et une sélection multiple, y compris tous les résultats filtrés. Publication en lot, import en lot et création directe d’un package depuis la sélection : jusqu’à 500 recettes par package ou requête serveur. L’interface publie par groupes de dix avec progression, pour éviter les délais des gros catalogues. Une publication existante est mise à jour sans en créer une nouvelle ; les copies privées déjà importées restent indépendantes. Les aliments communs sont réutilisés par identifiant à l’import. Un package contient des recettes, pas des rôles ni un second catalogue d’aliments.

Chaque compte lié à un profil peut donner de 1 à 5 étoiles aux recettes d’un repas passé auquel il participe. Une seule note par compte, repas et recette ; la modifier remplace le vote. Les parties séparées d’une recette ne créent pas plusieurs votes. Un autre repas autorise un nouvel avis. Les copies partagées conservent une identité de notation commune ; seules la moyenne et le nombre d’avis sont publics, pas les participants ou leurs votes individuels. Les cartes affichent un badge et un filtre permet de retrouver les notes de 4 étoiles et plus, de moins de 3 étoiles ou les recettes non notées. L’accueil montre les recettes les mieux notées et les derniers repas à noter ; le détail du repas permet aussi de voter.

Le calcul des portions, les menus et les lots existants restent conservés. La référence 0.3.32 reste figée ; un retour avant la gestion des comptes exige la sauvegarde de base antérieure. Aucun accès à Unraid ni Nginx.

## Modèle comptes et foyers validé — 11 novembre 2026

Un compte possède un rôle global d’administration et une appartenance distincte à chaque foyer, avec le rôle gestionnaire ou membre et un profil personnel facultatif. Les profils sans compte sont conservés. Le gestionnaire gère les données du foyer ; le membre consulte les données communes et modifie son profil. L’administrateur gère les comptes et foyers, puis rejoint explicitement un foyer pour en gérer les données.

Tous les aliments sont communs par défaut. Les corrections de leurs définitions sont validées par l’administrateur. La publication des recettes reste volontaire ; leur import crée une copie privée et réutilise les aliments communs. Les packages officiels sont composés par l’administrateur à partir des recettes publiées. Les données de menus, profils et stocks restent privées.


Dans Administration, « Catalogue à compléter » regroupe les fiches alimentaires en liste simple : valeur actuelle, estimation éditable, provenance et sélection. Les estimations de cuisson s'appliquent uniquement aux fiches que l'utilisateur choisit de valider ; elles ne changent pas les portions déjà enregistrées dans les menus.

Une ligne d'ingrédient indique désormais si l'aliment est servi cru, cuit à partir de sa quantité crue ou ajouté déjà cuit. Le coefficient de cuisson appartient à la fiche aliment et ne s'applique que dans le deuxième cas. Les recettes historiques gardent leur calcul antérieur jusqu'à vérification dans l'éditeur.

La version 0.3.16 ajoute des catégories alimentaires indépendantes des rubriques de courses, un filtre par donnée manquante et une édition groupée avec aperçu et provenance. Les valeurs estimées de cuisson et de mesure ne sont pas appliquées automatiquement.

Une scoop correspond par défaut à 60 ml. Pour la whey, 30 g par scoop est une estimation de secours, tandis qu'un poids pesé dans la fiche aliment ou une densité connue prévaut. Le calcul n'invente pas une masse pour les autres poudres.

Le catalogue alimentaire peut être exporté en CSV depuis la page Aliments, avec identifiants, valeurs et réglages d’achat du foyer sélectionné. L’export porte sur toutes les fiches, sans modifier les données. Il prépare une vérification documentée des champs manquants et un futur classement par catégories alimentaires.

## Règles courantes depuis 0.3.13

Le coefficient poids cuit / poids cru appartient à la fiche aliment. Il est prioritaire sur les anciens coefficients des lignes de recettes ; une valeur absente conserve le calcul historique. Les contradictions anciennes sont listées dans Administration et demandent une décision de l'utilisateur. Les grammes cuits des menus déjà enregistrés et les stocks historiques ne sont pas réécrits ; les ingrédients et courses restent en quantités crues. Les conversions entre deux aliments distincts servent séparément aux achats.

Les catégories de repas sont configurables par créneau et peuvent être communes ou individuelles selon le créneau. Pâtisserie commune au petit-déjeuner et individuelle à la collation ; entrée et laitage facultatifs ; accompagnement, sauce et assaisonnement conservés. Le rôle technique reste un champ de compatibilité des repas historiques et n'est plus présenté comme un choix métier. Les proportions d'assiette d'Administration servent à la proposition initiale des recettes séparées. L'ajustement calorique retire un dessert entier avant de réduire les féculents séparés par pas de 10 g ; il conserve le plat principal et la part viande/poisson. Un plat indivisible reste entier et peut dépasser le plafond du repas. Les protéines sont une indication, sans seuil automatique de 40 g par repas. Le rééquilibrage quotidien donne un aperçu à valider ; aucun rééquilibrage hebdomadaire automatique. Le compte épargne montre le dépassement résiduel. Les menus enregistrés ne sont recalculés que sur demande explicite.

Les sections historiques ci-dessous documentent aussi les règles des versions antérieures ; les règles courantes ci-dessus priment lorsqu'elles diffèrent.

La présentation utilise les couleurs du logo lapin sur des fonds doux. La navigation s’adapte au téléphone, à la tablette et au PC. Les cartes de recettes, repas et préparations montrent la photo disponible, ou le logo en repli. L’accueil conserve la semaine civile de sept jours et quatre créneaux ; sur téléphone, le jour se choisit dans la semaine.

Ce document décrit le produit cible. Pour les fonctions effectivement livrées, consulter [l'état actuel](STATUS.md) et [le cahier de reprise](REPRISE.md). Les règles de planification ci-dessous sont complétées par [le fonctionnement kcal actuel](MEAL-ENERGY.md).

## Préparations, réservations et sorties de stock

Une préparation supplémentaire se planifie hors menus avec une date et une quantité respectant le minimum propre à la recette. Ses ingrédients sont à acheter dès la planification et son surplus prévu peut couvrir les menus suivants. Elle ne devient du stock physique qu’après confirmation de la fabrication ; l’annulation du lot remet la préparation à faire.

Une préparation déjà fabriquée peut être réservée aux menus d’une plage de dates. Les repas prêts sont reconnus à partir du stock réel, dans l’ordre des dates et créneaux ; chaque partie d’un service séparé doit être couverte. Le stock réservé reste physiquement présent jusqu’à la fin du jour du repas (Europe/Paris), puis ses portions sont retirées automatiquement, sans nouvelle déduction des ingrédients bruts. Les sorties sont idempotentes et rattrapées après redémarrage ; les menus antérieurs à l’activation restent préservés. Une annulation restitue les sorties et suspend l’automatisme pour ce repas. Ce mécanisme ne constitue pas un journal nutritionnel de consommation réelle.

## Objectif

Aider un foyer à décider quoi manger, en quelle quantité pour chaque personne, quoi acheter et quoi fabriquer à l'avance. Le logiciel affiche les apports calculés à partir des aliments réellement utilisés sans demander de journal alimentaire après les repas.

Ce produit aide à organiser les repas. Il ne diagnostique pas, ne prescrit pas et ne transforme pas une estimation en conseil médical.

## Présentation et formats

Depuis la 0.2.89, la charte validée est **Magazine culinaire · Encre framboise**, en mode clair : fond rose très pâle, surfaces papier, encre sombre, accents framboise et titres à empattements. Navigation latérale sur PC, haute sur tablette, basse sur mobile avec accès Plus aux autres pages. Photos existantes valorisées et formulaires adaptés, sans changer les fonctions, les quantités ni les calculs. L’impression hebdomadaire conserve sa mise en page A4. Depuis la 0.2.90, la webapp est installable depuis le navigateur : identité lapin/cocotte, fenêtre autonome et guide iOS/Android/PC. Le site et l’app partagent le même serveur et la même authentification. Une connexion est nécessaire ; aucune nouvelle couche de cache hors ligne. Les mises à jour se chargent à la réouverture ou à l’actualisation, après enregistrement des saisies. Le hors-ligne et la synchronisation restent des évolutions distinctes.

## Personnes et objectifs

- Une personne du foyer est un profil alimentaire; elle n'a pas besoin d'un compte pour être planifiée. Les comptes servent à se connecter, les profils servent à planifier et suivre les personnes.
- Le profil conserve les données nécessaires aux estimations : date de naissance si renseignée, taille, niveau d'activité et historique daté de leurs changements.
- Le poids est saisi par l'utilisateur, avec une date pour chaque relevé. L'interface facilite un relevé hebdomadaire et affiche l'historique sans inventer ni extrapoler de mesures.
- Les besoins quotidiens estimés (dont le maintien énergétique) restent distincts des objectifs choisis ou validés. La méthode, les données d'entrée, l'origine, la date d'effet et l'état de validation sont visibles et historisés.
- Aucun objectif de perte de poids n'est calculé ou proposé automatiquement à un mineur; aucune estimation ne s'applique sans validation de l'utilisateur.
- Les préférences, exclusions et allergies sont des informations distinctes des comptes et permissions.
- Les profils de développement et de test sont synthétiques. Les informations de santé réelles restent hors Git, des images Docker, des journaux et des fixtures.

## Catalogue alimentaire

- Une seule liste globale à l'instance; Ciqual est une source d'import initiale, pas une deuxième base consultée à l'exécution.
- Chaque aliment a un identifiant stable, un nom canonique, des alias, des valeurs nutritionnelles pour 100 g, leur provenance et les champs inconnus explicitement vides.
- Les fiches sont corrigibles; les produits de marque sont ajoutables depuis leur étiquette. Les aliments proches ou doublons sont fusionnables avec historique des références.
- Les équivalences d'unités dépendent de l'aliment: g et ml ne sont pas interchangeables sans densité; une pièce ou une cuillère peut avoir un poids seulement si une équivalence documentée existe.
- Les recettes et recherches utilisent le même identifiant alimentaire et affichent le nom canonique. Aucun champ de nom libre parallèle ne sert au calcul.
- Administration permet de définir, pour le foyer, un rendement explicite entre un aliment de départ (sec/cru) et le produit obtenu (cuit/égoutté). Le coefficient décrit le poids obtenu par gramme de départ. Il suggère le coefficient de cuisson de cet ingrédient et sa conversion inverse peut alimenter les courses ; une règle d’achat explicite prime. Les recettes existantes ne sont pas réécrites.
- Le catalogue reste dans le flux normal de la page, avec pagination haute et basse, tailles de 25 à 250 fiches et lignes compactes sur ordinateur. La sélection groupée porte sur la page ou les résultats filtrés et passe par un aperçu ; toute fiche liée à une recette, un stock, un achat ou une conversion est protégée.

## Courses et unités d’achat

Les règles d’achat sont propres au foyer. Une fiche aliment peut définir l’unité d’achat habituelle et son contenu (par exemple sachet de 500 g) ; les équivalences de recette connues convertissent les cuillères, pièces et autres mesures vers l’achat affiché. Les achats au format saisi directement sur une ligne restent prioritaires. Une préférence distincte peut lier un aliment de recette à un autre produit de courses avec une conversion explicite (par exemple pois chiches cuits égouttés vers pois chiches secs). Ces règles ne changent pas les ingrédients ni les apports de la recette. La page Aliments sert à consulter, modifier, ajouter, dupliquer et supprimer les fiches, avec protection des aliments référencés.

## Recettes et composition

- Depuis la 0.2.94, renommage direct du titre dans les vues grille et liste, validation ou annulation explicites. Les titres des parties liées suivent sans changer les ingrédients, quantités ni historiques.


- Depuis la 0.2.93, les coefficients de cuisson sont choisis par ingrédient dans l’éditeur et les réglages rapides, sans réglage global visible. Choix Semoule ×2, valeurs historiques préservées, préparations maison déjà cuites à ×1. Les coefficients estiment le poids ; ils ne multiplient pas les apports nutritionnels.


- Une recette inutilisée peut être supprimée explicitement, avec confirmation. Un menu ou un historique de production lié à la recette ou à une partie empêche la suppression pour préserver les références ; aucune suppression automatique de doublons.
- Les types de recette de base incluent Plat, Salade, Sauce, Boisson, Accompagnement et Dessert. L’administration du foyer permet d’ajouter des catégories de recette personnalisées et de choisir les créneaux où chaque catégorie peut être proposée.
- Au calendrier, le plat principal reste commun au repas. Chaque ajout complémentaire (accompagnement, boisson, sauce, dessert ou catégorie personnalisée) se choisit et se quantifie séparément pour chaque personne ; une quantité nulle signifie qu’elle n’en prend pas. Les rôles connus continuent d’appliquer leurs règles nutritionnelles et de calcul.
- Lorsqu’une recette est décomposée en protéines, légumes et féculents, ses lignes dérivées sont affichées comme composants liés à cette recette, et non comme de nouvelles recettes complémentaires. Les quantités restent ajustables par personne. Un changement de composition conserve les parties déjà utilisées avec les anciens repas et stocks ; seules les parties actives sont proposées aux nouveaux menus.
- Les salades peuvent être complètes ou vertes, servies comme plat ou accompagnement ; elles utilisent les mêmes modes de service et calculs que les plats.
- La ligne structurée de recette est: aliment, quantité, unité d'usage, état (cru/sec/cuit si pertinent), composant optionnel et variante optionnelle.
- L'import texte/URL crée un brouillon à examiner. Il ne crée pas silencieusement un aliment ni une correspondance.
- Les calculs nutritionnels proviennent exclusivement des lignes liées au catalogue. Les valeurs importées peuvent être conservées comme référence non vérifiée, jamais comme calcul validé.
- Une recette définit un ou plusieurs rendements explicites: muffin individuel, g de pâte fraîche, nombre de portions ou lot familial. Les variantes, comme avec/sans whey, sont distinctes.
- Un repas combine une ou plusieurs recettes et composants (protéine, féculent, légumes, sauce, dessert, etc.). Un petit déjeuner peut donc être 2 muffins + 100 g de skyr.
- Pour un plat composé, les quantités de chaque composant sont personnalisables indépendamment par personne. Un plat mélangé permet une attribution par poids, pièce ou fraction de rendement.
- Le total préparé, les quantités attribuées et les restes sont visibles et doivent s'équilibrer.

## Planification et objectifs

- Calendrier hebdomadaire sur écran ordinateur: 7 jours lisibles, créneaux visibles, navigation compacte et résumés par personne. Pas de colonne étroite avec défilement intérieur imbriqué ni de page interminable.
- Ajouter/modifier un repas se fait dans un panneau latéral ou une fenêtre compacte, en gardant la semaine visible.
- Chaque repas indique qui sera présent; le foyer entier n'est jamais supposé automatiquement.
- Le plan affiche par personne les portions et apports nutritionnels prévus, avec indicateurs de complétude et provenance.
- Les repères protéiques journaliers sont réglables par personne dans Administration et affichés par jour ; les repères kcal du résumé par personne sont comparés sur la semaine.
- Les totaux représentent des prévisions. L’utilisateur ne souhaite pas de saisie après repas ni de journal du consommé ; « Préparé » gère les stocks, pas un relevé nutritionnel réel.
- Les propositions de portions sont optionnelles, explicables, modifiables et limitées aux données connues. Elles ne s'appliquent jamais sans validation.

## Production en lots et stocks

- Depuis la 0.3.8, un stock suivi insuffisant ne bloque pas la production : les écarts restent en négatif et sont indiqués pour recomptage. Les ingrédients non suivis ne reçoivent pas de stock initial inventé. Les fabrications courantes utilisent seulement les parties actives ; les parties archivées conservent leurs anciens menus/lots. Les conversions et identifiants restent validés.
- Depuis la 0.3.7, une préparation déjà fabriquée peut être comptée par quantité physiquement restante avant réservations. Les écarts sont historisés, sans réécrire les lots ni rembourser les ingrédients ; besoins et stock prennent ce comptage en compte. Les réservations sont affichées séparément, avec le manque éventuel.
- Depuis la 0.3.6, le batch cooking peut être regroupé depuis une semaine choisie sur 1, 2 ou 3 semaines, ou sur toute la période des courses. La liste contient chaque recette une fois avec ses quantités cumulées ; un calcul unique de la plage partage le stock et les surplus de lots entre les repas. Une semaine partielle vide ne décale pas la sélection initiale. Les autres productions et les courses conservent leurs dates ; enregistrer une production actualise les besoins et le stock.
- Modes dédiés: usine à petits déjeuners, usine à pâtes fraîches, batch de repas.
- L'utilisateur choisit les recettes/variantes et le rendement visé (ex. 24 muffins ou 1,5 kg de pâte); l'application agrège les besoins d'ingrédients et tient compte du stock confirmé.
- Dans Administration, les types de production servent au classement et au suivi ; le minimum de lot et son unité se définissent sur chaque recette. Avec des équivalences explicites, le minimum peut être une unité métier différente du rendement : 1 pain entier peut correspondre à 350 g et à 10 tranches. Bagels (24 pièces) et pancakes (36 pièces) gardent leurs lots distincts même s’ils sont du même type. Si le besoin restant est inférieur au minimum, la préparation et les courses couvrent le lot complet ; le surplus est réservé aux menus suivants puis suivi en stock. Sans minimum configuré, la production reste calculée au besoin exact.
- L’administration du foyer est organisée en sept rubriques accessibles par onglets ; les types de production existants sont chargés dès son ouverture avant toute modification.
- Une session garde cible, quantités réellement produites, date, stockage, emplacement, étiquettes, et consignes de refroidissement/congélation/réchauffage saisies ou validées par l'utilisateur.
- Un mode explicite Hors menus — quantité libre permet de cuisiner le nombre de portions de la recette d’origine, notamment pour des invités, sans ajustement aux objectifs personnels. Il conserve les proportions de la recette et ne modifie pas les menus.
- La fabrication proposée depuis les menus couvre uniquement leurs quantités nécessaires, quel que soit le service : préparation entière ou viande/légumes/féculents séparés. Les ingrédients de chaque partie suivent son propre besoin ; aucun surplus n’est créé pour arrondir à une recette de base.
- Une production ajoute des lots de stock. Planifier un repas ne consomme pas le stock; seul un acte explicite d'utilisation le décrémente.
- Le stock à utiliser/décongeler prochainement et les écarts de rendement sont visibles.
- La whey est une option explicite d'une recette quand elle est adaptée; elle est traitée comme un ingrédient provenant de l'étiquette, sans promesse de brûle-graisse.

## Courses

- Les besoins de menus et de sessions de production peuvent alimenter une liste de courses, après révision explicite.
- Les mêmes aliments du catalogue sont consolidés; quantité exacte nécessaire et quantité d'achat arrondie au paquet sont distinctes.
- Le stock placard et congélateur confirmé est déduit. Grosses courses mensuelles, frais chaque lundi par défaut et achats en ligne mensuels sont séparables et configurables.
- Une substitution/variante reste visible; aucune liste n'est modifiée en ouvrant simplement un calcul.

## Interface

- Depuis la 0.2.92 : filtre par service, réglages rapides repliables du service/rendement et affectation explicite des ingrédients. Grille/liste et pagination 12/24/48/96, 1 à 4 colonnes PC plafonnées à 2 sur tablette et 1 sur mobile. Préférences mémorisées localement ; même validation et protection des historiques que l’éditeur complet.


- Ordinateur en premier, responsive ensuite.
- La page d'accueil répond rapidement à: quoi aujourd'hui, quoi décongeler, quels objectifs restent, prochaine session de production, courses à faire.
- Le calendrier est la vue principale: semaine entière visible à une largeur desktop courante, navigation par semaine, résumés nutritionnels simples et accès direct aux détails.
- Une impression hebdomadaire A4 paysage présente les menus et quantités par personne sur les sept jours, sans les prévisions et commandes de l’interface.
- Les recettes ont une fiche synthétique et un éditeur structuré. Chaque aliment n'est affiché qu'une fois comme nom canonique; la quantité et l'unité sont dans la même ligne.
- Recherche avant listes longues; filtres utiles et filtres persistants.
- Pas de scroll dans scroll dans les vues de planification. L'information secondaire se replie; les totaux et actions principales restent visibles.

## Évolutions produit à cadrer

La page Importer, les vignettes avec photos, les filtres de données manquantes et la réserve kcal sont livrés. Les évolutions restantes — confort mobile/PWA, comptes individuels liés aux personnes et au foyer, communauté publique et nettoyage du catalogue — sont recensées dans [TODO.md](TODO.md) et [AMELIORATIONS.md](AMELIORATIONS.md). Les variantes et la fusion sûre des doublons décrites dans le produit cible ne sont pas à considérer comme entièrement implémentées.

## Jalons de validation

1. **Fondation:** catalogue global, profil synthétique, recette avec lignes alimentaires structurées, calcul nutritionnel vérifiable.
2. **Repas familial:** recette composée, personnes présentes, quantités indépendantes par composant, calendrier semaine desktop sans scroll vertical global.
3. **Prévisions et réserve :** objectifs datés, épargne glissante et occasions ; pas de journal de consommation.
4. **Production:** rendement unitaire, usine petit déjeuner et pâtes, sessions, inventaire congelé.
5. **Courses:** consolidation depuis menu et production avec déduction du stock et arrondi de paquets.

Chaque jalon aura des scénarios d'acceptation exécutables et une validation navigateur avant publication.

## Décisions de la session du 13 octobre 2026

- Les modes de service distinguent préparation entière, viande-légumes + féculents, et viande/protéines + légumes + féculents. Les grammes sont estimés depuis les ingrédients et coefficients explicites ; aucune pesée systématique après cuisson n'est demandée.
- Les nouveaux menus utilisent quatre créneaux : petit-déjeuner, déjeuner, collation de l’après-midi et dîner. Les anciennes collations du soir restent consultables. La répartition kcal reste modifiable dans Administration avec un total de 100 % ; le choix actuel est 20/40/10/30 %, sans figer ces valeurs pour le foyer.
- Les profils sont compacts et repliables dans Administration. Le calendrier garde les détails dans l'éditeur et affiche le cumul quotidien personnel en pied de journée.
- Les boissons et desserts peuvent être choisis individuellement. La duplication conserve les recettes, personnes, quantités et notes, sans recalcul implicite.
- Le calcul ne remplit pas les budgets à tout prix : plafonds de portions du batch et du petit-déjeuner, saisie manuelle possible et limites protéiques visibles.
- Le rééquilibrage des adultes passe par un aperçu : petit-déjeuner puis déjeuner/dîner si nécessaire. Les adolescents ne subissent pas cette réduction automatique ; une donnée inconnue ne devient pas un objectif implicite.
- Repère historique du 13 octobre, désormais livré en 0.2.42 : réserve glissante et occasions avec estimation globale par adulte. Le [brouillon](drafts/ENERGY-RESERVE.md) reste archivé et ne doit pas être réappliqué.
- L'utilisateur gère seul Unraid. Aucun accès, contrôle ou déploiement par l'agent n'est autorisé.

## Préparations comme ingrédients — 0.2.82

- Une ligne de recette référence soit un aliment canonique, soit une recette du même foyer, jamais une copie des apports de cette recette. Les compositions circulaires sont refusées.
- Le rendement de base reste la référence. Il peut être en tranches ; d’autres équivalences explicites sont facultatives : par exemple une fournée de 6 bagels et un pain de 20 tranches. Les grammes sont estimés depuis les ingrédients/coefficient de cuisson ou définis explicitement pour le lot complet. Pas de poids de tranche inventé, ni de volume supposé égal au poids.
- Le composant déjà préparé ne reçoit pas une seconde fois le coefficient de cuisson du féculent. Les services du plat restent indépendants.
- Pour les menus, les besoins directs et imbriqués partagent le même stock ; les menus antérieurs réservent en premier. Les matières premières correspondant aux manques alimentent les courses, et les composants suivis apparaissent dans les préparations à faire.
- Un composant suivi en stock doit être fabriqué avant le plat qui l’utilise. Son assemblage déduit la préparation terminée ; ses matières premières ont déjà été déduites à sa fabrication. Les sauces non suivies se préparent avec le plat et leurs ingrédients sont déduits à cette étape. Annuler restitue les mouvements d’origine, pas un calcul depuis une recette modifiée.
- Une recette référencée ne peut pas être supprimée. La modification d’un composant actualise les apports et poids de service de ses parents et leurs versions ; les menus déjà préparés restent protégés, y compris à travers plusieurs recettes. Les changements d’unité/format incompatibles avec un historique d’utilisation nécessitent une nouvelle variante.

## Unités pratiques et compensation calorique — 0.2.86

La 0.2.83 est la dernière référence fonctionnelle validée. Les calculs des 0.2.84 et 0.2.85 sont abandonnés. Le moteur initial et les proportions d’Administration ne sont pas modifiés : le calcul en grammes se fait d’abord pour chaque personne. Ensuite seulement, les parties à unité connue sont arrondies à l’entier positif le plus proche selon leur équivalence. Exemple : 84 g d’œuf à 50 g/pièce → 2 œufs ; 86 g de pain à 35 g/tranche → 2 tranches. Ces masses sont des équivalences déclarées, pas des constantes appliquées à tous les aliments.

La partie en grammes (légumes/soupe en priorité ; sinon l’unique partie libre) compense l’écart **calorique** : nouvelle quantité = ancienne quantité − somme des écarts kcal des unités / kcal par gramme de soupe. Le total calorique de la proposition initiale est conservé ; les proportions finales peuvent donc varier légèrement. Aucun maintien forcé du poids total ni des pourcentages après arrondi. Les protéines sont recalculées depuis les quantités obtenues.

Une saisie manuelle d’œufs/tranches applique la même formule depuis les quantités juste avant la modification, uniquement pour la personne et la préparation concernées. Une ouverture sans modification conserve exactement les anciens grammes, même fractionnaires. Les menus enregistrés en 0.2.84/85 ne permettent pas de retrouver automatiquement leur proposition d’origine : utiliser Recalculer les portions après mise à jour.

Les grammes restent la quantité canonique pour nutrition, menus, courses, fabrication et stock. Ni poids d’œuf/tranche ni données nutritionnelles ne sont inventés. Si les parties sont incomplètes/répétées, les kcal inconnues, ou la compensation nécessiterait une quantité nulle ou négative, une explication est affichée ; pas de compensation arbitraire ni de valeur négative. Le recalcul automatique conserve alors la proposition initiale. Le rééquilibrage quotidien retrouve celui de 0.2.83 ; cette modification concerne le bouton Recalculer et la saisie manuelle de l’éditeur.

## Produits d’achat communs et exclusions — 0.2.87

Dans Courses & stocks, chaque ligne expose Détails et réglages → Acheter sous… et exclusions. Un aliment peut être rattaché à un produit du catalogue avec une équivalence explicite : par exemple 1 pièce d’œuf dur nécessite 1 pièce d’œuf cru. Les blancs d’œufs ne sont jamais rattachés automatiquement : l’utilisateur choisit œufs entiers ou produit en bouteille et leur équivalence. Ce réglage appartient au foyer et ne change ni les ingrédients ni les valeurs nutritionnelles des recettes.

Les besoins sont convertis vers le produit d’achat, additionnés, puis confrontés une seule fois à son stock et enfin arrondis au format/unité d’achat. Magasin, paquet et unité d’achat sont ceux de la cible. Les recettes liées sont réunies et cliquables ; les aliments d’origine restent consultables. Lors d’une préparation ou fabrication, le produit commun est déduit du stock avec les mêmes conversions. Les annulations restituent les mouvements d’origine, même si le réglage change ensuite. Le calcul de portions n’est pas modifié.

Les conversions doivent être documentées dans les deux fiches aliments. Sans conversion, le besoin reste visible avec une explication et la préparation ne peut pas déduire un stock arbitraire. Chaînes/cycles et unités cibles incohérentes entre sources sont refusés. Le rattachement est refusé tant qu’un stock/seuil propre à la source subsiste, ou qu’une préparation active pourrait encore restituer son ancien stock. Les écritures de stock sur une source rattachée renvoient vers le produit commun. Aucun transfert silencieux des stocks ou des historiques.

Exclure des courses masque un aliment uniquement pour les dates exactes de la liste ou durablement (par exemple eau du robinet, sel). Cela ne supprime pas l’ingrédient des recettes, sa nutrition ni son utilisation du stock à la préparation. Les exclusions d’une source sont appliquées avant regroupement ; exclure la cible masque tout le produit commun. Les exports/copier/téléchargement/Home Assistant utilisent la même liste filtrée. Le panneau Regroupements et exclusions reste présent lorsque la liste est vide ; il permet de modifier/retirer un regroupement et de réafficher une exclusion permanente ou de la période courante.

Migration additive : db/migrations/20261018_shopping_products.sql (tables household_purchase_products et household_shopping_exclusions). Aucun aliment regroupé ou exclu par défaut.

## Saisie dans l’unité d’achat — 0.2.88

Lorsque la liste propose 26 œufs avec une règle 1 œuf = 50 g, le champ Quantité réellement achetée est en œufs et vaut 26 par défaut. Le comptage de stock utilise aussi les œufs ; 400 g sont affichés comme 8 œufs (400 g). Les confirmations indiquent nombre d’unités et poids correspondant. La conversion selon la règle explicite se fait une seule fois lors de l’envoi à l’API ; le stock reste enregistré en grammes.

Même principe pour les pots/unités personnalisées appliquées. Un format de paquet configuré reste prioritaire : saisie en nombre de paquets, comptage fractionnaire permis pour un paquet entamé. Sans règle ou paquet appliqué, la saisie garde l’unité native ; aucune équivalence en grammes n’est inventée. Pas de migration ni modification des besoins/recettes, des regroupements ou des données de stock existantes.


## Source Instagram dans la fiche cuisine

Depuis la 0.2.91, la source d’une recette peut être consultée dans une incrustation Instagram à la demande. La publication affiche sa vidéo si elle en contient une et si Instagram autorise la lecture. Le lecteur est arrêté à la fermeture/au masquage, et le lien d’origine reste disponible. Aucun téléchargement ou hébergement de vidéo ; pas de détection certaine vidéo/photo à partir du seul lien, ni modification des quantités ou productions.
