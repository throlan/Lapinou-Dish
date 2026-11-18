# Cahier des améliorations proposées

## Proposition nutritionnelle guidée — 0.16.0

Le parcours guidé distingue le maintien estimé et la cible proposée. Un poids de forme inférieur au dernier poids mesuré suggère « perte de poids », avec confirmation obligatoire ; aucun déficit n’est choisi automatiquement. L’utilisateur choisit explicitement un ajustement de 10/15/20 % ou une valeur en kcal. Les pourcentages sont des réglages applicatifs, pas une prescription issue d’une recommandation. Les calories restent la base des calculs et les protéines un repère indicatif.

Le questionnaire facultatif couvre diabète, risque d’hypoglycémie, fonction rénale, grossesse/allaitement, intervention bariatrique et date, dumping. « Je ne sais pas » reste possible. Les réponses ne sont stockées qu’avec la cible confirmée dans person_nutrition_goals.questionnaire, protégée par les mêmes droits API/RLS que le profil ; aucun envoi à l’IA ou à un service externe. Les conflits empêchent le report de la proposition automatique ; les consignes professionnelles restent saisissables directement.

Repères sourcés : HAS 2024 R98 pour les protéines après chirurgie (minimum 60 g/j, idéalement au moins 1,1 g/kg de poids idéal/j), avec formule médicale explicitement choisie (Lorentz/Hamwi/référence théorique IMC 25), distincte du poids de forme personnel. ADA 2026 : aucun ratio universel des trois macronutriments pour le diabète ; repère fibres 14 g/1 000 kcal avec adaptation digestive. EFSA : choix général de lipides entre 20 et 35 % ; glucides calculés comme complément des calories après le repère protéique et les lipides choisis (4/4/9), sans présenter cette répartition comme une prescription. Les sources et conditions sont visibles dans l’aperçu. Voir NUTRITION-RECOMMANDATIONS.md.

Décisions prudentes de l’application : pas de report automatique avec maladie rénale ou statut incertain, risque d’hypoglycémie, grossesse/allaitement, diabète de type 1/inconnu, dumping, première année après chirurgie ou intervention non précisée. Aucune moyenne ni priorité arbitraire entre recommandations contradictoires. Une cible générale ≤1 200 kcal/j renvoie à un accompagnement spécialisé. Une baisse de protéines sous le repère bariatrique est signalée à arbitrer. Ces règles de parcours ne constituent pas un protocole médical individuel.

Les cibles datées ajoutent lipides, glucides et fibres, visibles dans le profil, l’accueil et le calendrier comme repères journaliers. Les valeurs inconnues restent absentes. La note est lisible ; les données du calcul et du questionnaire sont conservées séparément. Une modification manuelle après proposition conserve le contexte et change l’origine en choix personnel, sauf choix explicite d’une autre origine. Les menus, quantités, stocks et rééquilibrages existants ne sont pas réécrits. Migration additive 20261118_nutrition_macros.sql ; les anciennes lignes restent intactes.

Validation : 31 tests ciblés réussis ; suite complète et contrôles/publication à consigner dans la PR de livraison. La 0.13.1 reste la référence explicitement validée en production ; l’utilisateur a utilisé la 0.15.0 et signalé la limite du report de maintien. Déploiement exclusivement par l’utilisateur, aucun accès Unraid/Nginx/base réelle.

## Cibles datées, estimation et suivi — 0.15.0

Version 0.15.0 : cibles kcal et minima protéiques datés, origine, méthode et confirmation explicite, révisions conservées. Administration et Mon compte partagent le formulaire avec aperçu. Les anciennes cibles et les anciens minima sont repris ; les secours par prénom sont matérialisés une seule fois par identifiant à la migration, puis retirés du calcul courant. Calories utilisées par le calendrier, les propositions, le rééquilibrage journalier et la réserve ; protéines indicatives. Aucun menu, quantité ou stock réécrit.

Estimation facultative de maintien : Mifflin–St Jeor simplifiée (1990), poids mesuré et taille datés, âge à la date choisie, paramètre sexué et PAL explicitement sélectionnés (1,4 / 1,6 / 1,8 / 2). Le choix de combiner cette formule et ces repères PAL EFSA est une estimation générale, pas une prescription ni une mesure de dépense. Résultat, entrées et sources reportés dans la méthode uniquement après choix explicite, puis confirmation de la cible. Aucun déficit imposé. Estimation adulte seulement ; âge manquant, mineur ou hors plage 18–78 : saisie personnalisée. Situations médicales particulières, grossesse et allaitement : privilégier une cible professionnelle. Sources : https://pubmed.ncbi.nlm.nih.gov/2305711/ et https://www.efsa.europa.eu/sites/default/files/assets/DRV_Summary_tables_jan_17.pdf .

Bilan mensuel à la date anniversaire de la première pesée, ajustée au dernier jour des mois courts sans décaler les mois suivants. Alerte supplémentaire à ±5 kg du poids mesuré de référence lors de la dernière cible validée. Affichage sur l’accueil et dans le profil ; tendance descriptive, aucun diagnostic de stagnation. Confirmation possible du maintien de la cible. Les pesées récentes insuffisantes sont signalées. Une nouvelle cible est proposée avec aperçu ; aucun changement automatique, aucune modification des repas existants.

Migration additive 20261118_nutrition_goals.sql. La 0.13.1 reste la référence validée sur l’installation de l’utilisateur ; la 0.14.0 et la 0.3.32 restent conservées. Déploiement uniquement par l’utilisateur, aucun accès Unraid/Nginx/base réelle.

Les sections antérieures ci-dessous conservent le contexte de leurs versions. Le prochain lot est celui des préférences, allergies et informations privées ; ne pas recommencer les cibles et l’estimation générale.

## Priorités après la 0.13.1 validée

Ordre des lots : (1) âge calculé, poids de forme et objectif intermédiaire datés, révisions du profil conservées ; (2) cibles nutritionnelles datées avec origine, méthode et validation ; (3) estimation des besoins explicable et validée séparément ; (4) préférences, allergies et données facultatives privées. Les critères détaillés figurent dans [PRODUCT.md](PRODUCT.md) et [TODO.md](TODO.md). Viennent ensuite l’enrichissement des nutriments, l’optimisation des portions, les scores distincts de qualité de recette et d’adéquation personne/repas, puis la planification assistée. Les allégations réglementées sur les protéines sont un sujet distinct des scores.

Le lot 1 est publié sur GitHub en 0.14.0 (PR #207, 463 tests locaux, contrôles et GHCR réussis) ; le lot 2 devient le prochain développement après validation de la 0.14.0. La référence de production reste 0.13.1 jusqu’à décision de l’utilisateur.

Les valeurs alimentaires inconnues restent inconnues ; les conflits se tranchent fiche par fiche. Une source externe n’applique aucune proposition automatiquement. Le nettoyage du catalogue, le filtre des aliments inutilisés et la fusion guidée des doublons restent retirés des travaux prévus.

## Fiches alimentaires et corrections guidées — 0.13.0

Les champs essentiels restent visibles : valeurs nutritionnelles pour 100 g, coefficient poids cuit/cru, densité, poids de la cuillère à café, cuillère à soupe, scoop de 60 ml et pièce. La cup de 240 ml complète les mesures de contenants. Marque/autres noms et courses/conditionnement sont repliables. Un seul mode de conditionnement est affiché : quantité par paquet ou unité nommée ; magasin et classement du foyer sont conservés.

Une densité ou une mesure de contenant connue calcule les autres selon les volumes demandés : 5/15/60/240 ml. Les champs calculés portent leur référence ; seuls les poids explicitement saisis sont enregistrés comme mesures pour permettre un recalcul ultérieur. Le poids d’une pièce et le coefficient de cuisson ne se déduisent pas d’un volume. Les valeurs explicites restent prioritaires. En cas de contradiction, les mesures sont conservées et un écart avec la densité est signalé (plus de 5 %, avec tolérance de 0,1 g). La référence de calcul est déterministe : densité, puis café, soupe, scoop, cup ; les conversions directes propres à chaque unité priment toujours. Aucun arbitrage de données réelles ni aucune moyenne externe appliquée automatiquement. Les décisions produit par produit et rendements de cuisson restent à valider par l’utilisateur.

Depuis une erreur nutritionnelle par ingrédient, un bouton ouvre l’aliment au nutriment ou à la mesure à corriger ; une préparation liée reste accessible. Les apports du catalogue de recettes sont actualisés après correction enregistrée. Les aliments communs gardent le circuit de proposition pour les membres et de validation par l’administrateur. Le poids d’une pincée disparaît de la saisie, des filtres de champs manquants et des choix de revue/groupage. Les conversions historiques masquées sont conservées. Les pincées restent dans les ingrédients et les courses, ne bloquent plus le coefficient ou le poids servi faute de conversion, et ne bloquent pas la production faute de poids ; aucun grammage ni débit de stock n’est inventé. Les autres conversions manquantes restent signalées et aucune valeur nutritionnelle absente n’est changée en zéro.

460 tests complets locaux réussis. Tests ciblés : parcours de correction et enregistrement du vrai formulaire, conditionnements exclusifs, mesures calculées réactives sans écrasement, cohérence avec les conversions serveur, conservation des valeurs absentes/historiques, recette à services séparés avec pincée, courses, production et stock fictifs. Vérification visuelle locale non réalisée : le navigateur intégré ne joint pas le serveur local. Pas de migration. Aucun accès à Unraid/Nginx ; déploiement par l’utilisateur. Contrôles et publication à vérifier dans la PR de livraison.

## Planification assistée — demandes du 15 novembre 2026, non développées

- **Menus automatiques pour la semaine via l’IA** : proposer une semaine de menus à partir des recettes du catalogue, des profils et des réglages du foyer. Présenter les propositions avant leur ajout au calendrier ; conserver les repas déjà saisis.
- **Équilibrage automatique des semaines** : proposer un ajustement de la semaine selon les objectifs de chaque personne. Ce chantier est distinct du rééquilibrage journalier et des alertes hebdomadaires déjà livrés ; ses règles et son aperçu restent à définir avant développement.
- **Compléter une journée selon les kcal restantes** : proposer des recettes et quantités pour les créneaux encore libres, en tenant compte des repas déjà planifiés, du quota journalier de chaque profil, des ratios kcal configurés par repas et des stocks de préparations déjà produits. Exemple demandé : déjeuner et dîner renseignés → suggestions de petit-déjeuner et de collation adaptées au budget restant. Favoriser les stocks disponibles après réservations, sans les compter plusieurs fois ; conserver les plafonds de portions et les variantes choisies. Rendre visibles les écarts et laisser l’utilisateur choisir avant enregistrement.

Ces trois demandes sont inscrites au cahier d’améliorations ; elles ne sont pas encore développées. Leur ordre de réalisation reste à choisir.

Le nettoyage du catalogue, le filtre des aliments inutilisés et la fusion guidée des doublons sont retirés des chantiers à prévoir à la demande de l’utilisateur. Les outils du catalogue déjà livrés restent disponibles ; la fiabilisation des données nutritionnelles, conversions et mesures personnelles reste un sujet distinct.

## Apports des variantes et cohérence du batch cooking — 0.12.0

Sur une recette modulable, Apports selon les choix ouvre une comparaison consultative depuis la fiche. La fenêtre de choix avant Cuisiner ou Planifier affiche aussi les apports de la combinaison sélectionnée dès le changement d’une protéine, d’une saveur ou d’un topping. Calories par portion/pièce/tranche ou pour 100 g/ml, badge de densité calorique et macronutriments utilisent les quantités, états et coefficients réels de la recette ; aucune moyenne ni remplacement de valeur absente par zéro. Les badges du catalogue portent la mention par défaut. L’éditeur d’une recette existante propose une comparaison de sa version enregistrée : enregistrer les nouvelles quantités/ingrédients avant de les comparer. Les réponses tardives d’un ancien choix sont ignorées. La comparaison GET ne crée ni recette, ni déclinaison, ni repas ; seule l’utilisation explicite d’une combinaison conserve le mécanisme d’instantané existant. Les membres du foyer peuvent comparer.

Les préparations Hors menus prévues mais non produites apparaissent maintenant aussi dans leur groupe de production, notamment le batch cooking, sur la plage choisie. Elles portent un libellé Hors menus et gardent leur quantité explicite et la confirmation de production. Une semaine partielle vide ne masque plus le premier hors menus planifié : le choix par défaut tient aussi compte de ces dates. Les courses utilisaient déjà ces demandes : l’affichage ne les additionne pas une seconde fois au moteur des besoins. Après confirmation, la préparation quitte les tâches à faire et son lot est ajouté une seule fois au stock. Les autres catégories conservent la période générale des courses.

Quand une modification de recette a conservé une ancienne version pour protéger les lots, les cartes de préparation concernées et le message d’enregistrement proposent Actualiser les repas à préparer. L’aperçu indique source, nouvelle recette, dates et personnes de la plage choisie. Les quantités identiques ou convertibles par une équivalence explicitement déclarée sont préremplies ; sans équivalence d’unité, l’utilisateur doit saisir la quantité. Un découpage incompatible en parties reste à reprendre manuellement dans le calendrier. L’application est transactionnelle et refuse un aperçu périmé. Elle conserve les dates, participants, autres recettes et repas déjà préparés/utilisés ; les lots et l’historique restent liés à leur ancienne recette. Les besoins, calendrier et courses sont ensuite recalculés. Les préparations hors menus déjà planifiées ne sont pas automatiquement réécrites par cette mise à jour des repas. Une simple modification de recette actualise aussi les vues de besoins et courses.

Aucune migration ni nouvelle règle de portions. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur, référence 0.3.32 conservée. Validation : aperçu comparé aux déclinaisons réellement résolues, avec ingrédients liés, service séparé, absence de topping, conversions et nutriments manquants ; lecture sans création et droits du foyer ; mise à jour de repas, équivalences explicites, saisie manuelle, ancien aperçu refusé, historiques/lots conservés et courses actualisées. Chrome local sur données fictives : comparaison poulet/bœuf avant planification, hors menus de 12 portions visible puis produit une seule fois dans le batch, ancienne recette basculée après vérification des quantités. Inspection à 1440/900/390 px ; pas d’appareil physique. 451 tests complets réussis. Publication finale consignée dans la PR fonctionnelle.


## Planification multiple, copies de journées/semaines et actualisations stables — 0.11.0

Dans Recettes → Planifier, les périodes proposées sont Cette semaine (lundi–dimanche), La semaine prochaine, Les deux prochaines semaines (les deux semaines complètes à partir du prochain lundi) et Ce mois (mois civil actuel). Les dates exactes sont affichées et restent modifiables avec Autres dates. Le moment du repas filtre les créneaux libres selon les moments de la recette. Plusieurs dates se cochent ensemble, par exemple mercredi et samedi au dîner. Les personnes, variantes, portions et compléments sont vérifiés une seule fois dans le formulaire habituel, puis copiés à l’identique sur toutes les dates ; aucun recalcul propre à une date future n’est inventé. La liste des cibles reste visible et les champs date/moment sont protégés pour une sélection multiple. Pour une seule cible, la date et le moment restent ajustables.

Dans le calendrier, Dupliquer la journée figure dans chaque en-tête de jour ; Dupliquer la semaine se trouve dans la barre de navigation. Choisir source et destination affiche les dates, moments, noms des recettes et nombres de personnes avant confirmation. Pour les semaines, les dates se calent sur le lundi. Les recettes, instantanés de variantes, parties séparées, compléments, personnes, notes et quantités sont conservés. Les états préparé, avis et mouvements de stock ne sont pas copiés : le moteur habituel réserve ensuite les stocks disponibles pour les nouveaux repas. Aucun repas existant n’est écrasé. Si un créneau cible est occupé, toute l’opération est refusée ; si la source change après l’aperçu, un nouvel aperçu est requis. Les enregistrements multiples sont transactionnels et leur identifiant persistant empêche un double ajout après un délai réseau dépassé ou un nouvel essai. Gestionnaires uniquement, dans le foyer actif.

Le calendrier n’est plus reconstruit toutes les minutes : le contrôle périodique n’actualise qu’au changement de jour, sans interrompre un formulaire. Les lectures simultanées sont partagées ; le catalogue et une vue de calendrier récente sont réutilisés pendant au plus une minute. Une écriture invalide immédiatement cette fraîcheur. Les résultats tardifs d’une ancienne demande de semaine sont ignorés. Une actualisation ne retire plus la liste ou la semaine déjà affichée ; un échec laisse les données visibles et affiche un message. Le délai de lecture passe de 8 à 30 secondes. Le catalogue charge les données alimentaires et recettes en groupe (trois requêtes, cinq avec préparations imbriquées), au lieu de relire chaque recette et chaque sous-préparation séparément. DTO, nutrition, coefficients et calculs inchangés.

Migration additive 20261115_planning_operations.sql : journal privé par foyer des opérations, avec droits et sécurité de ligne. Aucun menu ni stock existant n’est réécrit. Référence fonctionnelle 0.3.32 conservée. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur.

Validation : tests de périodes et changement d’année, double mercredi/samedi, atomicité et rejeu, collisions et source modifiée, refus d’un profil inactif sans copies partielles, rôles et isolation HTTP, équivalence du catalogue groupé avec les lectures individuelles et bornage du nombre de requêtes. Chrome local sur données fictives : sélection de deux dates, formulaire commun, journée puis semaine copiées, minute sans rechargement et erreur réseau sans disparition du catalogue ; inspection PC/tablette/mobile à 1440/900/390 px. 436 tests complets réussis. Publication finale consignée dans la PR fonctionnelle.


## Planifier depuis les recettes et cuisiner depuis le calendrier — 0.10.0

Dans le catalogue, les gestionnaires disposent de Planifier. Choisir une plage (63 jours maximum) affiche seulement les créneaux libres parmi les quatre moments actuels, en respectant les moments adaptés de la recette. La recette et ses éventuels choix de variantes sont transmis au formulaire de repas ; les personnes, portions et compléments restent à vérifier avant Enregistrer. Le catalogue et ses filtres restent ouverts après l’enregistrement. Le serveur protège aussi le créneau sous verrou d’inventaire : s’il a été pris entre-temps, aucun repas existant n’est remplacé. L’ancien ajout explicite de plusieurs repas sur un créneau reste inchangé.

Décision utilisateur : pas de nouvelles cases boisson/dessert dans les recettes. Le dialogue propose les catégories du foyer (boisson, sauce, dessert, accompagnement, etc.) et Un autre plat. Cocher ajoute une ligne de choix au même repas, jamais une recette choisie automatiquement. Les sauces déjà intégrées comme ingrédients restent dans la composition ; aucune sauce n’est déduite du nom d’une salade ou de pancakes. Les catégories personnalisées et les règles commun/individuel existantes sont conservées.

Le bouton Cuisiner des cartes du calendrier permet de choisir une des recettes réellement présentes, puis Ce repas uniquement, Cette semaine, Cette semaine et la suivante ou Ce mois. La semaine commence le lundi du repas sélectionné ; les deux semaines comprennent la suivante ; le mois est le mois civil de ce repas. Les dates exactes, le nombre de repas concernés, les quantités prévues, couvertes par le stock et à préparer sont affichés avant ouverture de Cuisiner. Les recettes en parties séparées sont regroupées une seule fois. La combinaison de variante du menu reste conservée, sans nouvelle question qui modifierait ses ingrédients.

Les besoins sont recalculés sur toute la plage, dans l’ordre des repas et avec le stock physique, les réservations et les lots minimums du moteur existant. Aucune somme naïve de résultats hebdomadaires. Les quantités des parties de service restent indépendantes. Les recettes non suivies en stock peuvent être consultées avec les quantités des menus, sans être transformées en productions suivies. Après production, besoins, calendrier, accueil et stocks sont actualisés ; la période de la liste de courses reste inchangée.

Ce repas uniquement réserve réellement le lot au repas sélectionné : un déjeuner ne prend pas les portions destinées au dîner du même jour. Le lot et ses éventuels sous-lots partagent ce ciblage ; un surplus devient disponible après le jour ciblé. Déplacer le repas fait suivre la réservation à sa nouvelle date. Les productions sur une plage gardent la priorité chronologique dans cette plage. Le ciblage fait partie du contrôle de rejeu : une même requête ne peut pas être réutilisée pour un autre repas. Dans le stock, le lot indique sa réservation à un repas précis.

Migration additive 20261115_target_meal_production.sql (lien facultatif du lot vers le repas). Les anciens lots restent sans ciblage précis et gardent leur fonctionnement. Menus, historique, formules de portions et de nutrition, choix de variantes et droits existants conservés. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur. Référence fonctionnelle 0.3.32 conservée.

Validation : 429 tests complets réussis, dont périodes/DST/frontières de mois et d’année, créneau devenu occupé, stock unique sur plusieurs semaines, lot minimum, ciblage dîner, rejeu, déplacement du repas, sous-lots séparés, recettes non suivies, droits et isolation des foyers. Chrome local sur données fictives : planification depuis le catalogue avec sauce/boisson/autre plat, repas occupé conservé, deux personnes et second plat, confirmation dans le catalogue, sélection du calendrier et production ciblée enregistrée. Inspection PC/tablette/mobile à 1440/900/390 px ; pas d’appareil physique. Références de publication finale dans la PR fonctionnelle.


## Listes de choix et recettes modulables — 0.9.0

Décisions confirmées le 15 novembre : une recette de base avec plusieurs groupes indépendants, pour tous les types (plats, desserts, boissons, sauces, etc.). Exemples : Bowl → légumineuse + protéine ; Flan → saveur + topping. Les listes sont réutilisables et modifiables dans le foyer. Tous leurs ingrédients doivent référencer le catalogue alimentaire ; aucun aliment textuel n’est inventé. La même combinaison est utilisée pour les personnes du repas, avec les portions adaptées par le moteur existant.

Dans Recettes, « Listes de choix » crée, renomme, modifie ou archive les listes. L’éditeur d’une recette permet d’attacher une liste à une ligne d’ingrédient, nommer ce groupe, régler les quantités/unités/états de chaque option et autoriser « Sans cet ingrédient ». Une recette peut avoir plusieurs groupes ; les autres ingrédients restent communs. Le choix par défaut correspond à la ligne existante. Les nouvelles options reprennent la quantité/unité de cette ligne pour préremplissage, sans garantir une équivalence nutritionnelle : vérifier avant enregistrement. Les coefficients restent ceux des fiches alimentaires et des règles d’état déjà livrées.

Une liste est indépendante de ses usages : modifier ou archiver la bibliothèque ne réécrit pas les recettes ni les repas. Dans chaque recette, « Actualiser les choix depuis la liste » reprend volontairement la liste courante, conserve les quantités des options déjà configurées et demande de vérifier les nouvelles. Les listes privées ne sont pas publiées avec leurs identifiants de foyer ; le partage d’une recette transmet ses choix et tous les aliments nécessaires, et l’import garde les références du catalogue.

Le choix est demandé avant Cuisiner hors menus, la planification d’un repas, la production directe ou la planification d’une préparation hors menus. Plusieurs choix du dessert s’appliquent à tous les participants. « Modifier les choix » permet de changer la combinaison du repas. Les ingrédients retenus déterminent nutrition, unités, grammes servis, courses, stocks et productions. Une information nutritionnelle absente reste signalée ; aucun zéro n’est inventé.

Les combinaisons ne sont jamais générées en masse. Seule une combinaison effectivement choisie crée un instantané interne réutilisé pour les mêmes choix et version de recette. Cet instantané garde les lignes et quantités choisies ; une édition future de la recette ou des listes ne le modifie pas. Les données du catalogue restent la source des noms, nutriments et conversions, comme ailleurs dans l’application. Les instantanés sont cachés du catalogue, des suggestions libres et du partage en lot ; ils restent visibles dans les repas, préparations et stocks qui les utilisent. Le serveur refuse deux combinaisons différentes d’une même recette de base dans un même repas.

Les listes sont privées au foyer, lisibles par ses membres et gérées par ses gestionnaires ou l’administrateur de l’application. Les droits des recettes restent inchangés ; un membre peut choisir une combinaison pour consulter Cuisiner sans modifier les stocks. Les instantanés de composition ne sont pas des fiches à éditer : modifier la recette de base ou changer les choix du repas.

Migration additive 20261115_recipe_choices.sql : listes, références aux aliments (suppression protégée), groupes et identité des instantanés. Les recettes sans choix et tous les menus, lots, stocks et calculs existants sont conservés. Aucune conversion automatique des quelque 200 recettes ni fusion/suppression. La référence 0.3.32 reste figée. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur uniquement.


## Éditeur de recette en fenêtre et onglets — 0.8.0

La création, la modification, la duplication et la vérification d’un brouillon importé ouvrent maintenant une fenêtre modale centrée, au lieu de descendre sous la liste. Quatre onglets regroupent les champs : Informations (nom, description, type, moments, source), Ingrédients (rendement, service et lignes), Préparation (temps, difficulté, étapes et validation de relecture) et Réglages (production, lot minimum, équivalences et avis).

En-tête, navigation et enregistrement restent visibles pendant le défilement du contenu. Les saisies sont conservées entre les onglets. La validation ouvre l’onglet du premier champ invalide, y compris les champs dans un volet replié. Les onglets se pilotent aussi au clavier. Fermer une saisie modifiée demande de confirmer l’abandon ; un enregistrement en cours bloque les modifications et les doubles envois. Après fermeture, la position dans la liste et le focus sont restaurés.

Les fiches aliments s’ouvrent au-dessus de la recette sans perdre sa saisie. Une préparation maison liée se consulte dans la fiche Cuisiner au-dessus de l’éditeur. Les imports conservent leur texte original. Tous les champs, les droits, les calculs, les menus, les productions et les historiques sont conservés. Aucun changement de schéma ni accès à Unraid ou Nginx ; déploiement par l’utilisateur uniquement.

Validation : parcours Chrome sur données fictives (modification, création, brouillon importé, saisies entre onglets, champ invalide masqué, fiche aliment imbriquée, abandon protégé et position de la liste). Inspection visuelle à 1280, 900, 390 et 320 px ; pas d’appareil physique. 416 tests complets réussis. Les contrôles GitHub et la vérification de publication sont consignés dans la PR de cette version.

## Avis facultatifs par recette — 0.7.2

Dans Modifier une recette, la case « Autoriser les avis » permet de désactiver la notation pour cette recette dans le foyer actif, par exemple un café ou un skyr. Elle est activée par défaut ; aucune désactivation n’est déduite du nom. Les personnes autorisées à modifier la recette peuvent changer ce réglage. Une recette désactivée ne figure plus dans les suggestions à noter, le classement local, les filtres par avis ni les étoiles de la fiche Cuisiner. Le serveur refuse aussi un nouveau vote direct.

Les notes déjà enregistrées sont conservées et redeviennent visibles après réactivation. Le choix reste privé au foyer, n’est pas exporté avec une publication et n’est pas imposé au foyer qui importe une recette. Une duplication conserve le choix de la recette source ; un nouveau brouillon démarre avec les avis activés. Migration additive `20261112_recipe_rating_enabled.sql`, sans réécriture des menus, stocks, quantités ni avis existants.

Validation : 412 tests complets réussis. Chrome local sur données fictives : désactivation dans le vrai formulaire, enregistrement, réouverture avec choix conservé et disparition des avis ; inspection visuelle à 1280 et 390 px. Les contrôles et la vérification de publication sont consignés dans la PR de cette version. Aucun accès à Unraid ni Nginx ; l’utilisateur seul déploie.

## Notation des recettes historiques — 0.7.1

Certaines recettes historiques (notamment les boissons ajoutées par la migration 0009) possèdent un identifiant PostgreSQL issu d’un MD5, sans bits de version/variante RFC. La notation les refusait avec le message trompeur « Choisis une note entière entre 1 et 5 ». La validation du seul identifiant recette des votes accepte désormais ces UUID au format canonique. Les notes restent des entiers de 1 à 5 ; participation au repas, date, foyer et identité du compte restent contrôlés. Plusieurs recettes peuvent être notées à la suite, puis la note modifiée ou retirée sans double vote.

Aucune migration, réécriture des identifiants, modification des calculs, des menus, des stocks ou des historiques. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur uniquement. Validation : 410 tests complets réussis, dont une reproduction qui échouait avant correction. Vérification dans Chrome local temporaire : quatre recettes fictives notées successivement, modification et retrait d’une note, trois votes restants confirmés côté serveur. Publication de la 0.7.1 vérifiée après fusion (voir PR #192).

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

## Revue intégrale et édition sélectionnée du catalogue — 0.3.20

La revue passe des 58 fiches ponctuelles à une liste de toutes les fiches actuelles. Les estimations de famille sont proposées pour les aliments crus/à cuire et les liquides de l'audit, avec incertitude et source. Les valeurs existantes peuvent être choisies pour remplacement après aperçu ; aucune écriture automatique. 500 fiches maximum par validation, journal détaillé et contrôle de version. Les catégories des références hors Ciqual sont préremplies d'après leur nom mais restent modifiables.

## État cru ou cuit par ingrédient — 0.3.19

Le choix est propre à la ligne de recette, pour permettre à un même aliment d'être servi cru ou cuit. Une ligne déjà cuite garde son poids saisi ; une ligne cuite dans la recette applique le rendement de la fiche aliment à sa quantité crue. Les anciennes lignes restent en mode historique jusqu'à contrôle explicite. Les menus enregistrés ne sont pas recalculés.

## Nouveau lot de propositions alimentaires — 0.3.18

Quatorze fiches supplémentaires disposent de 27 mesures USDA dans la revue existante, avec séparation entre propositions applicables, écarts sur valeurs présentes et comparateurs de forme incertaine. L'audit cumulé atteint 58 fiches et 91 lignes ; poursuivre les recherches par aliment exact et les arbitrages utilisateur. [Détail](CATALOGUE-SUGGESTIONS.md).

## Catalogue : propositions sourcées — 0.3.17

Dans Aliments, « Examiner les propositions sourcées » rapproche les références Ciqual exactes et affiche la valeur actuelle, les méthodes et les limites. Une proposition pour un champ vide peut être reportée volontairement dans la saisie, puis enregistrée en lot après aperçu, avec sa provenance par ligne. Les écarts sur valeurs existantes renvoient à la fiche individuelle. Aucun remplissage automatique. [Audit de l’export et conflits](CATALOGUE-SUGGESTIONS.md) : 1 057 fiches inventoriées, 44 examinées en détail, 64 lignes dont 39 écarts pour 38 couples fiche/champ. L’examen des autres références et les pesées du foyer restent à faire.

## 0.3.16 — catalogue alimentaire

Classement par catégorie alimentaire Ciqual 2025, distincte des catégories de courses ; filtre par catégorie et champ manquant ; édition groupée jusqu'à 250 aliments avec aperçu, source, contrôle de version et protection des valeurs existantes. Les coefficients et poids manquants restent à rechercher et valider au cas par cas. Voir [CATALOGUE-SUGGESTIONS.md](CATALOGUE-SUGGESTIONS.md).

## 0.3.15 — dosette de whey

Le volume de référence de la scoop est 60 ml. Une whey sans mesure propre utilise 30 g estimés, milieu de la plage 25–35 g donnée par l'utilisateur. Les 25 g déjà saisis sur la fiche vanille restent prioritaires. Le reste de l'audit du catalogue, le classement officiel Ciqual et l'édition groupée restent à traiter séparément.

## 0.3.14 — inventaire du catalogue

Export CSV complet depuis la page Aliments pour examiner les quelque mille fiches restantes. Prochaine étape après remise du fichier réel : rechercher les coefficients de cuisson, densités et poids des mesures manquants, distinguer les sources propres au produit des estimations, définir les catégories alimentaires, puis construire un aperçu d’édition groupée validé avant enregistrement. Ne pas remplir automatiquement une valeur incertaine.

## 0.3.13 — poids cuit, catégories et priorité calorique

Coefficient cru/cuit par aliment dans la fiche unique ; liste des conflits historiques sans décision automatique. Catégories configurées par créneau et mode commun/individuel ; entrée et laitage ajoutés. Les anciennes catégories facultatives restent proposées. Le calcul initial des services séparés suit les proportions d'assiette d'Administration. En cas de dépassement, dessert retiré entier puis féculents réduits sans toucher au plat principal ; protéines affichées à titre informatif. Rééquilibrage sur la journée après aperçu, sans action automatique sur la semaine. Les menus existants sont conservés jusqu'à recalcul demandé. Voir `docs/MEAL-ENERGY.md` et `docs/SERVING-GRAMS.md`.

Livré par la PR [#162](https://github.com/throlan/Lapinou-Dish/pull/162) ; [contrôles et image GHCR 0.3.13 réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/41855028940). Les coefficients contradictoires restent à arbitrer par l'utilisateur aliment par aliment.

## Présentation adaptative — 0.3.12

Direction visuelle validée par l’utilisateur pour toute l’application : couleurs tirées du logo, surfaces adoucies, navigation et cartes adaptées au téléphone, à la tablette et au PC. Photos des recettes dans les cartes, logo en repli. L’accueil garde sa semaine du lundi au dimanche et ses quatre créneaux ; le téléphone sélectionne le jour à afficher. Aucun changement métier.

## Courses & stocks en onglets — 0.3.11

La longue page est découpée en cinq rubriques sans déplacer les fonctions hors de Courses & stocks. Dates communes en haut, onglets accessibles au clavier et conservation des formulaires ouverts. Aucun changement métier.

353 tests locaux, PR #159 fusionnée au commit `36dc404a107b658c3bf0c89297f9e7e2abab5ee3`, contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41821597464. Tags `0.3.11` et `v0.3.11` vérifiés.

## Refonte ciblée du 4 novembre 2026 — livrée en 0.3.10

Accueil sur la semaine civile, quatre cartes compactes par jour, détails au clic. Fiche de portions et actions pour les repas préparés ; cases du calendrier simplifiées. Collation du soir absente des nouveaux menus, archives conservées. Pourcentages kcal toujours configurables dans Administration, actuellement 20/40/10/30. Fiche aliment unique enrichie des réglages de courses ; préparations hors menus planifiables, avec courses immédiates et stock confirmé plus tard. Voir REPRISE.md pour les règles de stock et les migrations.

353 tests locaux, contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41811943655. PR #157 fusionnée au commit `0db84ae2cb12d0922c9e59ecb11d4662e5af12ad`. Tags `0.3.10` et `v0.3.10` vérifiés, digest `sha256:b46eaf9e3f60e68c5ca35bb06ee1322a1db9176ccf3ddcaa2c92ff2aa4c5314a`.

## Repas prêts et retrait après le jour du repas — 0.3.9 livrée

Le calendrier affiche « Prêt ✓ — portions réservées » quand toutes les préparations suivies du repas sont réellement produites en quantité suffisante. Les réservations suivent les dates et créneaux des repas, sans retirer le stock physique. Une couverture partielle reste indiquée comme telle ; du pain déjà fabriqué ne fait pas passer un hamburger non cuisiné à l’état prêt.

Décision utilisateur : retirer les portions affectées **une fois le jour du repas passé**. Le serveur vérifie chaque minute, au fuseau Europe/Paris, même sans navigateur ouvert ; il rattrape les jours manqués après redémarrage. Les sorties sont enregistrées une seule fois par ligne du repas, sous verrou du foyer, avec leurs lots sources. Les ingrédients bruts ont déjà été déduits à la fabrication et ne sont pas déduits à nouveau. La première activation fixe une date de départ : les menus plus anciens ne sont pas consommés rétroactivement. Ils gardent leurs réservations historiques ; une plage explicite permet de réserver une nouvelle fabrication aux menus voulus.

Cuisiner depuis les menus présélectionne leur plage (semaine/durée du batch, ou période des courses pour les autres productions). « Menus concernés » permet de vérifier ou modifier ces dates, ou de décocher la réservation ciblée. Un lot ciblé ne couvre pas les repas antérieurs à cette plage ; son surplus devient utilisable après sa fin. Les lots sans plage gardent la priorité chronologique. Les parties d’une fabrication séparée héritent de la même plage. Les courses, besoins et états de préparation utilisent le même ordre et le même stock partagé, avec les minima existants.

Le retrait manuel immédiat reste explicite (« Utiliser les portions maintenant »). Une utilisation partielle autorise aussi « Marquer le reste préparé ». Annuler restitue les sorties concernées et suspend le retrait automatique pour ce repas afin qu’il ne soit pas repris à la minute suivante. Un repas dont le stock a été utilisé est protégé contre l’édition, la suppression et le rééquilibrage jusqu’à annulation ; dupliquer ne copie pas ses sorties. Ce suivi de stock ne crée aucun journal nutritionnel de consommation réelle. Les menus, calculs de portions et règle viande/poisson ne changent pas.

Migration additive `20261101_automatic_meal_stock.sql`. Validation locale : **351 tests complets réussis** et parcours Chrome fictif PC/tablette/mobile (1440/900/390 px, formulaire à 320 px), plage du 9 au 15 novembre protégée face au 2 novembre, réservation sans débit, passage de minuit simulé puis annulation. Aucun accès à Unraid/Nginx. PR #155 fusionnée au commit `571d72bab17c4970f838a6799234e95d40495077` ; contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41302800569. Tags `0.3.9` et `v0.3.9` vérifiés, digest commun `sha256:bf2735d821b157d05562fbc6d9ed28e3ead111e4de5bb12d92640a38b678ea32`. Les cinq versions 0.3.5 à 0.3.9 sont présentes ; les digests antérieurs sont conservés.

## Production non bloquée par les stocks insuffisants — 0.3.8 livrée

L’erreur `invalid-production-parts` pouvait apparaître après le passage de trois parties à deux : l’enregistrement exigeait encore une partie archivée. Les fabrications courantes et l’expansion des recettes imbriquées utilisent désormais seulement les parties actives. Les anciennes parties restent accessibles par leurs identifiants pour leurs menus/lots historiques. Des identifiants étrangers, des doublons ou une fiche devenue périmée restent refusés ; le message demande alors d’actualiser la fiche.

L’enregistrement d’une production est permis si un stock suivi d’ingrédients ou de préparations utilisées est insuffisant. Les déductions sont faites une seule fois, même en négatif, et la confirmation liste les stocks à régulariser. Exemple : stock comptable 10 g, utilisation 100 g → −90 g ; l’inventaire réel peut ensuite être recompté. Les ingrédients non suivis restent non suivis, sans inventer leur stock initial. Les composants suivis consommés sans lot enregistré peuvent eux aussi passer en négatif et être comptés. Les conversions manquantes/identifiants invalides restent protégés ; les repas marqués Préparé gardent leurs contrôles existants. L’annulation restitue les mouvements d’origine et une répétition de requête ne redéduit rien. Un regroupement d’achat ne doit pas masquer un stock source négatif.

Migration additive `20261101_negative_production_stock.sql` : retrait de la contrainte interdisant un solde d’ingrédient négatif ; aucun stock ou menu existant n’est réécrit. **342 tests complets locaux réussis**, dont transition trois→deux, lots sans parties archivées, production exacte avec ingrédient partagé, soldes négatifs, annulation et répétition, composant suivi sans lot, conversion manquante toujours protégée. Chrome local fictif à 1440/900/390/320 px : production depuis Cuisiner, avertissement −90 g, stock à régulariser puis comptage à 400 g, aucune erreur JS/HTTP ni débordement. Les calculs des portions et la règle viande/poisson restent inchangés. Aucun accès à Unraid/Nginx. PR #153 fusionnée au commit `7fcc8ed34d3277c27a6f7c4c479107ebbef755bb` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41293831666. Tags `0.3.8` et `v0.3.8` vérifiés, digest commun `sha256:e7d2a7a5377943b7a3ee38d89ef58d5ffb96b059bb1a35da71de71def2bc7453`.

## Stock restant des préparations et retour des regroupements — 0.3.7 livrée

Dans « Stock des préparations déjà produites », « Corriger la quantité restante » saisit le total physiquement présent, avant les réservations des menus, dans l’unité de la préparation. Les fabrications initiales et déductions d’ingrédients ne sont pas réécrites. Exemple : 20 pièces fabriquées, 10 réellement restantes, 16 réservées → manque de 6. Les besoins, courses, composants et stocks utilisent la correction ; une production ultérieure ou un repas préparé continue d’actualiser ce stock. Les services séparés se comptent indépendamment. Les corrections sont historisées sous verrou du foyer, avec contrôle de quantité périmée et répétition sans double mouvement. Une annulation de lot est refusée si elle rendrait le stock insuffisant après les sorties/corrections.

« Acheter sous… » : le regroupement purée de tomate → coulis a été enregistré sur données fictives avant le correctif ; le défaut constaté est l’absence de confirmation après reconstruction/repli de la liste. Un succès affiche désormais une confirmation visible et ouvre le récapitulatif. Un choix incomplet ne reste plus sans explication ; les refus de conversion, de stock source ou d’historique restent protégés et affichés. Aucune densité ni équivalence n’est inventée et les recettes/nutritions restent distinctes.

Migration additive `20261101_preparation_stock_counts.sql`. **340 tests complets locaux réussis**, dont stock 20→10, réservations, zéro, correction à la hausse, conflit, répétition, isolation du foyer, repas préparé/annulé, services séparés et refus d’annulation de lot. Chrome local sur données fictives à 1440/900/390/320 px : correction du banana bread, regroupement de deux produits en 600 g, formulaire incomplet et conversion impossible expliqués ; aucune erreur JS/HTTP inattendue ni débordement. Le batch cooking multi-semaines 0.3.6 est conservé. Aucun changement des menus, portions ou règle viande/poisson. Aucun accès à Unraid/Nginx. PR #151 fusionnée au commit `cf5f69f18ab9f9aabc0027a2bd12b5dd2cd0fb61` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41285703265. Tags `0.3.7` et `v0.3.7` vérifiés, digest commun `sha256:406f87c2cf3b61bce67e29f2b61b6d8c7b3588a47af62fc7258e330b083bd651`.

## Batch cooking sur plusieurs semaines — 0.3.6 livrée

Dans « Courses & stocks > Préparations à faire », choisir la semaine de départ puis 1, 2 ou 3 semaines, ou toute la période des courses. Une seule liste regroupe chaque recette et ses quantités sur la plage affichée. Au premier affichage, la première semaine contenant un menu de batch est sélectionnée : une semaine partielle vide du 31 octobre au 1er novembre ne décale donc pas les semaines du 2 au 15 novembre 2026. L’option 1 semaine conserve les limites lundi–dimanche, bornées par les dates des courses. Toute la période ignore la semaine de départ ; les durées fixes sont limitées à la fin des courses.

Le navigateur demande un calcul unique de la plage au moteur existant, dans l’ordre des repas, avec un stock partagé et les minima propres aux recettes. Il n’additionne pas les projections hebdomadaires. Les repas antérieurs réservent toujours le stock en premier ; le surplus d’un lot minimum couvre les repas suivants. Après enregistrement d’une production, les besoins et le stock sont rechargés en conservant la sélection. Les libellés distinguent la couverture par stock et par lots prévus lorsqu’un minimum est configuré.

Les autres productions et la liste de courses gardent leur période actuelle ; cette portée est expliquée dans l’interface. Aucun menu, calcul de portions, règle viande/poisson ou migration n’est modifié. **336 tests complets locaux réussis**, dont une semaine partielle vide, deux semaines répétées, stock initial réservé une seule fois, lot minimum, conservation des menus et coordination des requêtes du navigateur. Parcours Chrome local fictif validé à 1440/900/390/320 px, sélection 1/2/3/période complète, production, stock actualisé, sans erreur JS/HTTP ni débordement horizontal. PR #149 fusionnée au commit `2359b2d287488e5b429ff5a7f9d3276a9250484a` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41244538868. Les tags `0.3.6` et `v0.3.6` ont été vérifiés directement dans GHCR et pointent vers `sha256:5f57f1c72002ae863f34ab9b82c8995ce93f54eb667bce1c88ddcdcf5d9d57fb`.

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

Publication précédente vérifiée : **0.3.0**, PR #137, commit `5349f9b407400d44b6a0376ffb8f787a48b6883d`, workflow réussi https://github.com/throlan/Lapinou-Dish/actions/runs/40849807550. Le workflow publie les alias numériques et préfixés v depuis package.json, sans réécrire une version déjà publiée. Conservation sans suppression automatique : au minimum les cinq dernières versions publiées restent sélectionnables. Les images 0.2.95 à 0.2.99 ont été retrouvées par tag technique ; digests et révisions vérifiés et enregistrés dans docker/rollback-images.json. Le workflow rétablit leurs alias depuis les digests exacts, sans reconstruire les anciennes images. Voir [ROLLBACK.md](ROLLBACK.md).

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

## Comptes utilisateurs et foyers — 0.4.1

Le modèle a été validé et le développement autorisé le 11 novembre 2026. Les comptes sont distincts des profils. Le rôle global d’administration se cumule avec les rôles propres à chaque foyer. La première livraison comprend l’authentification individuelle, les appartenances, les profils personnels, le partage volontaire et la composition de packages de démarrage. Détails dans REPRISE.md.

## Projet communautaire public

Envisager une bibliothèque publique de recettes partageables, consultables et importables, distincte des foyers privés. Une publication doit être volontaire et ne jamais exposer le calendrier, les profils, les mesures, les stocks ou l’identité du foyer. Étudier avant ouverture : attribution et droits sur les recettes et images, modération et signalement, contenu nutritionnel sourcé, versions des recettes, import dans un foyer sans écraser ses fiches existantes, anti-spam et coûts d’hébergement.

Une première expérimentation pourrait se limiter à un catalogue public en lecture seule, alimenté par des recettes explicitement proposées par leurs auteurs et approuvées. Les commentaires, comptes publics, notes et contributions ouvertes sont des extensions à évaluer séparément.

## Prochaines décisions

La liste synthétique à jour est dans [TODO.md](TODO.md). Les nouvelles demandes de planification assistée sont détaillées en tête de ce document. L’aide à la correction nutritionnelle et la communauté publique restent à cadrer. Le nettoyage du catalogue et le filtre des aliments inutilisés ont été retirés du périmètre demandé le 15 novembre 2026. Aucun de ces nouveaux chantiers n’est lancé automatiquement.

## Recettes utilisées comme composants — réalisé en 0.2.82

« + Préparation maison » permet d’utiliser pain/bagel, sauce, pâtes et accompagnements dans les plats. Unités à la pièce, à la tranche, en portion, g ou ml selon les équivalences explicites ; apports dérivés et besoins des menus étendus aux composants après couverture par le stock. Les composants suivis sont produits avant les plats ; les ingrédients ne sont pas déduits deux fois. Les références, annulations et services indépendants sont protégés. Ce chantier ne doit pas être proposé à nouveau.

## Correction 0.2.86 — retour au calcul validé

Calcul initial 0.2.83 conservé, conversion en unités pratiques et arrondi au plus proche, compensation du delta kcal sur la soupe et même comportement lors des saisies manuelles. Les approches 0.2.84/85 sont abandonnées. Les équivalences renseignées restent la référence, sans masse de tranche inventée.

## Livré — produits d’achat et exclusions, 0.2.87

Acheter sous un produit commun avec équivalence explicite, stock partagé et addition avant arrondi ; sources nutritionnelles distinctes et liens de recettes conservés. Exclusions permanentes ou pour la période, réactivables. Les blancs ne sont pas regroupés automatiquement. La fusion d’aliments du catalogue ne fait plus partie des chantiers demandés (décision du 15 novembre 2026).

## Livré — saisie des achats en unités, 0.2.88

Quantités achetées et stock compté suivent les règles d’achat explicites (œufs, pots…) ou le format de paquet prioritaire. Le nombre saisi est converti une seule fois vers l’unité interne ; équivalence et stock en unités affichés.
