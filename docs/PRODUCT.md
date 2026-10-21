# Cahier produit Lapinou Dish

Ce document décrit le produit cible. Pour les fonctions effectivement livrées, consulter [l'état actuel](STATUS.md) et [le cahier de reprise](REPRISE.md). Les règles de planification ci-dessous sont complétées par [le fonctionnement kcal actuel](MEAL-ENERGY.md).

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

## Recettes et composition

- Depuis la 0.2.93, les coefficients de cuisson sont choisis par ingrédient dans l’éditeur et les réglages rapides, sans réglage global visible. Choix Semoule ×2, valeurs historiques préservées, préparations maison déjà cuites à ×1. Les coefficients estiment le poids ; ils ne multiplient pas les apports nutritionnels.


- Une recette inutilisée peut être supprimée explicitement, avec confirmation. Un menu ou un historique de production lié à la recette ou à une partie empêche la suppression pour préserver les références ; aucune suppression automatique de doublons.
- Les catégories incluent Plat, Salade, Sauce, Boisson, Accompagnement et Dessert. Les salades peuvent être complètes ou vertes, servies comme plat ou accompagnement ; elles utilisent les mêmes modes de service et calculs que les plats.
- Une sauce est ajoutable au repas avec une quantité choisie par personne, éventuellement nulle. Ses apports comptent dans les totaux ; sa quantité ne sert pas à combler automatiquement un budget kcal ou protéique.
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

- Modes dédiés: usine à petits déjeuners, usine à pâtes fraîches, batch de repas.
- L'utilisateur choisit les recettes/variantes et le rendement visé (ex. 24 muffins ou 1,5 kg de pâte); l'application agrège les besoins d'ingrédients et tient compte du stock confirmé.
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
- Le calendrier a cinq créneaux. La répartition kcal est modifiable dans Administration, total validé à 100 %, avec valeurs initiales 15/40/10/25/10 %.
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
