# État du projet — 19 novembre 2026

## Profils automatiques, activité et projection — 0.17.0

Décision du 19 novembre : le parcours normal est désormais automatique. Après enregistrement des faits du profil (naissance, taille, poids mesuré, activité habituelle, objectifs de poids et antécédents), le système calcule et applique les cinq repères datés : calories, protéines, lipides, glucides, fibres. Plus de saisie de calories, de minima protéiques, de déficit, de pourcentage de lipides ou de formule médicale dans ce parcours. Cette décision remplace les choix manuels des versions 0.15–0.16 décrits ci-dessous ; les historiques restent conservés. Aucun profil n’est converti silencieusement au déploiement : le premier enregistrement des faits active ce mode.

Maintien Mifflin–St Jeor × activité ; objectif déduit du poids de forme choisi, pas de l’objectif intermédiaire déjà atteint. Ajustement applicatif de 20 % plafonné à 500 kcal/j. Protéines calculées depuis le profil et un budget applicatif de 20 % des calories si supérieur au minimum de référence ; glucides 45 %, lipides par différence, fibres EFSA/ADA. Ces choix applicatifs ne sont pas des prescriptions spécifiques au diabète ou à une chirurgie. « Cholestérol élevé connu » (oui/non/inconnu) apporte un repère sur la qualité des graisses, sans prédiction de LDL ni modification de traitement. Les contextes hors domaine sont signalés et conservent la cible antérieure.

Les pesées, objectifs et changements de profil actualisent les repères. Un bilan est également enregistré à la prochaine consultation après chaque anniversaire mensuel de la première pesée, sans tâche planifiée ni diagnostic automatique de stagnation. Les quantités des menus, les productions et les stocks ne sont pas réécrits. Les réglages administratifs de répartition des calories par repas restent disponibles.

Disponibilités en minutes/séance et séances/semaine ; journal séparé des marches réellement effectuées. Les saisies sont idempotentes, annulables et privées. Projection mensuelle et mois approximatif des objectifs par modèle dynamique réduit à deux compartiments, avec dépenses adaptatives et plateau possible. Activité nette ajoutée seulement si déclarée supplémentaire ; aucune calorie alimentaire ajoutée après une séance. Watch/HealthKit reportés. Sources, équations et limites : [ACTIVITE-PROJECTION.md](ACTIVITE-PROJECTION.md).

Migration additive 20261119_automatic_activity.sql, avec contrôle API et RLS propre profil/gestionnaire. Validation et publication : voir le journal du 19 novembre et la PR de livraison. Déploiement exclusivement par l’utilisateur ; aucun accès Unraid/Nginx/base réelle.


## Proposition complète et explications — 0.16.1

Le parcours propose désormais des réglages visibles et modifiables (10 % pour l’ajustement, 30 % pour les lipides, Lorentz pour le repère protéique bariatrique) au lieu d’exiger des choix techniques vides. Ce sont des choix applicatifs présentés comme tels, pas des prescriptions. Le poids médical de référence est expliqué et calculé à l’écran ; il reste distinct du poids de forme personnel.

Une proposition complète contient protéines, lipides, glucides et fibres : repère protéique existant conservé, repère général adulte EFSA 0,83 g/kg si absent hors chirurgie, repère HAS après chirurgie, et fibres ≥25 g/j avec adaptation du repère ADA lorsqu’il est supérieur. Les conflits médicaux restent bloquants pour le report. Les sources EFSA protéines/fibres sont ajoutées. Les nouveaux paramètres sont marqués defaultsVersion:1 ; les questionnaires historiques gardent leurs résultats et leur validation d’origine.

Le résultat affiche les cinq valeurs par jour, le maintien, l’ajustement et la différence avec la cible enregistrée. « Utiliser » ouvre directement l’aperçu final, sans enregistrer automatiquement. La saisie manuelle est repliée et explicitement nommée ; elle ne prétend plus calculer une proposition. Aucune migration, aucune modification automatique des cibles, menus ou stocks existants. Tests locaux : 21 ciblés réussis, dont scénario mini-bypass ancien avec ancienne cible à 1 300 kcal et champs techniques laissés aux valeurs proposées. Contrôles complets et publication à consigner dans la PR.

## Proposition nutritionnelle guidée — 0.16.0

Le parcours guidé distingue le maintien estimé et la cible proposée. Un poids de forme inférieur au dernier poids mesuré suggère « perte de poids », avec confirmation obligatoire ; aucun déficit n’est choisi automatiquement. L’utilisateur choisit explicitement un ajustement de 10/15/20 % ou une valeur en kcal. Les pourcentages sont des réglages applicatifs, pas une prescription issue d’une recommandation. Les calories restent la base des calculs et les protéines un repère indicatif.

Le questionnaire facultatif couvre diabète, risque d’hypoglycémie, fonction rénale, grossesse/allaitement, intervention bariatrique et date, dumping. « Je ne sais pas » reste possible. Les réponses ne sont stockées qu’avec la cible confirmée dans person_nutrition_goals.questionnaire, protégée par les mêmes droits API/RLS que le profil ; aucun envoi à l’IA ou à un service externe. Les conflits empêchent le report de la proposition automatique ; les consignes professionnelles restent saisissables directement.

Repères sourcés : HAS 2024 R98 pour les protéines après chirurgie (minimum 60 g/j, idéalement au moins 1,1 g/kg de poids idéal/j), avec formule médicale explicitement choisie (Lorentz/Hamwi/référence théorique IMC 25), distincte du poids de forme personnel. ADA 2026 : aucun ratio universel des trois macronutriments pour le diabète ; repère fibres 14 g/1 000 kcal avec adaptation digestive. EFSA : choix général de lipides entre 20 et 35 % ; glucides calculés comme complément des calories après le repère protéique et les lipides choisis (4/4/9), sans présenter cette répartition comme une prescription. Les sources et conditions sont visibles dans l’aperçu. Voir NUTRITION-RECOMMANDATIONS.md.

Décisions prudentes de l’application : pas de report automatique avec maladie rénale ou statut incertain, risque d’hypoglycémie, grossesse/allaitement, diabète de type 1/inconnu, dumping, première année après chirurgie ou intervention non précisée. Aucune moyenne ni priorité arbitraire entre recommandations contradictoires. Une cible générale ≤1 200 kcal/j renvoie à un accompagnement spécialisé. Une baisse de protéines sous le repère bariatrique est signalée à arbitrer. Ces règles de parcours ne constituent pas un protocole médical individuel.

Les cibles datées ajoutent lipides, glucides et fibres, visibles dans le profil, l’accueil et le calendrier comme repères journaliers. Les valeurs inconnues restent absentes. La note est lisible ; les données du calcul et du questionnaire sont conservées séparément. Une modification manuelle après proposition conserve le contexte et change l’origine en choix personnel, sauf choix explicite d’une autre origine. Les menus, quantités, stocks et rééquilibrages existants ne sont pas réécrits. Migration additive 20261118_nutrition_macros.sql ; les anciennes lignes restent intactes.

Validation : 31 tests ciblés réussis ; suite complète et contrôles/publication à consigner dans la PR de livraison. La 0.13.1 reste la référence explicitement validée en production ; l’utilisateur a utilisé la 0.15.0 et signalé la limite du report de maintien. Déploiement exclusivement par l’utilisateur, aucun accès Unraid/Nginx/base réelle.

## Cibles datées, estimation et suivi — 0.15.0

Validation locale : 18 tests ciblés réussis (droits API et SQL, migration des cibles, dates/révisions, estimation, aperçu et confirmation, affichage des minima et chargement des modules). Contrôles complets et publication à vérifier dans la PR de livraison.

Version 0.15.0 : cibles kcal et minima protéiques datés, origine, méthode et confirmation explicite, révisions conservées. Administration et Mon compte partagent le formulaire avec aperçu. Les anciennes cibles et les anciens minima sont repris ; les secours par prénom sont matérialisés une seule fois par identifiant à la migration, puis retirés du calcul courant. Calories utilisées par le calendrier, les propositions, le rééquilibrage journalier et la réserve ; protéines indicatives. Aucun menu, quantité ou stock réécrit.

Estimation facultative de maintien : Mifflin–St Jeor simplifiée (1990), poids mesuré et taille datés, âge à la date choisie, paramètre sexué et PAL explicitement sélectionnés (1,4 / 1,6 / 1,8 / 2). Le choix de combiner cette formule et ces repères PAL EFSA est une estimation générale, pas une prescription ni une mesure de dépense. Résultat, entrées et sources reportés dans la méthode uniquement après choix explicite, puis confirmation de la cible. Aucun déficit imposé. Estimation adulte seulement ; âge manquant, mineur ou hors plage 18–78 : saisie personnalisée. Situations médicales particulières, grossesse et allaitement : privilégier une cible professionnelle. Sources : https://pubmed.ncbi.nlm.nih.gov/2305711/ et https://www.efsa.europa.eu/sites/default/files/assets/DRV_Summary_tables_jan_17.pdf .

Bilan mensuel à la date anniversaire de la première pesée, ajustée au dernier jour des mois courts sans décaler les mois suivants. Alerte supplémentaire à ±5 kg du poids mesuré de référence lors de la dernière cible validée. Affichage sur l’accueil et dans le profil ; tendance descriptive, aucun diagnostic de stagnation. Confirmation possible du maintien de la cible. Les pesées récentes insuffisantes sont signalées. Une nouvelle cible est proposée avec aperçu ; aucun changement automatique, aucune modification des repas existants.

Migration additive 20261118_nutrition_goals.sql. La 0.13.1 reste la référence validée sur l’installation de l’utilisateur ; la 0.14.0 et la 0.3.32 restent conservées. Déploiement uniquement par l’utilisateur, aucun accès Unraid/Nginx/base réelle.

Les sections antérieures ci-dessous conservent le contexte de leurs versions. Le prochain lot est celui des préférences, allergies et informations privées ; ne pas recommencer les cibles et l’estimation générale.

## Lot 1 publié — 0.14.0

Âge calculé à la date pertinente (ou inconnu), objectifs de poids de forme et intermédiaires datés, révisions de profil et d’objectif conservées. Administration et Mon compte réutilisent les droits du foyer ; la base restreint les objectifs aux gestionnaires et au profil propre du membre. Une migration additive garde toutes les données 0.13.1. Les nouvelles données de poids n’entrent pas dans les portions. **463 tests locaux réussis**, dont migration d’une base fictive 0.13.1 et vérifications des droits. PR [#207](https://github.com/throlan/Lapinou-Dish/pull/207), fusion `c4930d88fdf74243151764f34db9b0e07aa351e3`, [contrôles et publication](https://github.com/throlan/Lapinou-Dish/actions/runs/44273020997) réussis. `package.json` indique **0.14.0** ; tags `0.14.0` et `v0.14.0` : `sha256:a8b755127d209c792b1b08ba51a928d7faef844aa3cc9fded171818a45914d4d`. **0.13.1 reste la référence validée en production** jusqu’à décision de l’utilisateur.

## Référence validée en production

Version de production validée **0.13.1** (`package.json` est désormais en 0.14.0), PR [#205](https://github.com/throlan/Lapinou-Dish/pull/205), fusion `99eb6d290aedcf022e25dafd16eb4ef1f4dffdb6`. [Contrôles et publication](https://github.com/throlan/Lapinou-Dish/actions/runs/43776135088) réussis ; tags GHCR `0.13.1` et `v0.13.1` : `sha256:4273fb32f8bfdcec16b67936e59b744f31a140e1660f556c5a2c07d704b89e45`. La 0.3.32 est une référence **historique de retour arrière**, pas la version courante. Le changement 0.13.1 ajoute l’icône du conteneur, sans migration ni changement de calcul. Les 460 tests locaux de la 0.13.0 ont réussi ; l’utilisateur a validé la 0.13.1 sur son installation.

Les sections datées ci-dessous retracent les versions précédentes. Toute mention de « référence 0.3.32 » dans ces sections désigne la décision historique prise lors de leur rédaction ; elle ne remplace pas la référence active ci-dessus.

## Architecture et domaine — audit de la 0.13.1

Comptes et foyers privés avec rôles, profils sans compte, variantes et listes de choix, portions individuelles, aperçu et application du rééquilibrage journalier, stocks et batch cooking sont livrés. L’audit 0.13.1 a exécuté 63 migrations sur PGlite fictif vide (58 tables) et 460 tests locaux réussis. Les profils ont date de naissance, historique du poids, taille, activité et cible kcal avec origine et méthode ; la correction d’un profil à une date identique remplace encore son entrée. `nutrition_targets` existe en schéma mais n’alimente ni les écrans ni les calculs. Les objectifs protéiques résident dans les réglages du foyer, avec certains secours liés au prénom. L’âge calculé, les objectifs de poids historisés, les cibles nutritionnelles datées intégrées et l’estimateur Mifflin–St Jeor restent à développer.

## Icône du conteneur — 0.13.1

Le Dockerfile déclare maintenant le label net.unraid.docker.icon vers le logo public existant : https://raw.githubusercontent.com/throlan/Lapinou-Dish/main/web/icons/app-192.png. Le service app du Compose fourni porte aussi ce label. Aucun changement fonctionnel ni de données, aucune migration. Le passage à 0.13.1 permet de publier cette métadonnée sans réécrire l’image 0.13.0.

Le changement s’applique au conteneur créé depuis la nouvelle image. Un champ Icon URL ou un label explicitement configuré sur l’installation peut garder la priorité : utiliser la même adresse dans cette configuration si nécessaire. L’affichage et l’éventuel cache du serveur restent à vérifier par l’utilisateur après son déploiement. Aucun accès à Unraid ni Nginx, même en lecture. Les références précédentes restent conservées.

## Fiches alimentaires et corrections guidées — 0.13.0

Les champs essentiels restent visibles : valeurs nutritionnelles pour 100 g, coefficient poids cuit/cru, densité, poids de la cuillère à café, cuillère à soupe, scoop de 60 ml et pièce. La cup de 240 ml complète les mesures de contenants. Marque/autres noms et courses/conditionnement sont repliables. Un seul mode de conditionnement est affiché : quantité par paquet ou unité nommée ; magasin et classement du foyer sont conservés.

Une densité ou une mesure de contenant connue calcule les autres selon les volumes demandés : 5/15/60/240 ml. Les champs calculés portent leur référence ; seuls les poids explicitement saisis sont enregistrés comme mesures pour permettre un recalcul ultérieur. Le poids d’une pièce et le coefficient de cuisson ne se déduisent pas d’un volume. Les valeurs explicites restent prioritaires. En cas de contradiction, les mesures sont conservées et un écart avec la densité est signalé (plus de 5 %, avec tolérance de 0,1 g). La référence de calcul est déterministe : densité, puis café, soupe, scoop, cup ; les conversions directes propres à chaque unité priment toujours. Aucun arbitrage de données réelles ni aucune moyenne externe appliquée automatiquement. Les décisions produit par produit et rendements de cuisson restent à valider par l’utilisateur.

Depuis une erreur nutritionnelle par ingrédient, un bouton ouvre l’aliment au nutriment ou à la mesure à corriger ; une préparation liée reste accessible. Les apports du catalogue de recettes sont actualisés après correction enregistrée. Les aliments communs gardent le circuit de proposition pour les membres et de validation par l’administrateur. Le poids d’une pincée disparaît de la saisie, des filtres de champs manquants et des choix de revue/groupage. Les conversions historiques masquées sont conservées. Les pincées restent dans les ingrédients et les courses, ne bloquent plus le coefficient ou le poids servi faute de conversion, et ne bloquent pas la production faute de poids ; aucun grammage ni débit de stock n’est inventé. Les autres conversions manquantes restent signalées et aucune valeur nutritionnelle absente n’est changée en zéro.

460 tests complets locaux réussis. Tests ciblés : parcours de correction et enregistrement du vrai formulaire, conditionnements exclusifs, mesures calculées réactives sans écrasement, cohérence avec les conversions serveur, conservation des valeurs absentes/historiques, recette à services séparés avec pincée, courses, production et stock fictifs. Vérification visuelle locale non réalisée : le navigateur intégré ne joint pas le serveur local. Pas de migration. Aucun accès à Unraid/Nginx ; déploiement par l’utilisateur. Contrôles et publication à vérifier dans la PR de livraison.

## Cuisiner une préparation hors menus planifiée — 0.12.1

Le bouton Cuisiner manquait sur les lignes Hors menus, y compris celles maintenant affichées dans le batch cooking. Il ouvre désormais la fiche cuisine avec la recette et la combinaison déjà prévues, les ingrédients cliquables ajustés à la quantité du plan (par exemple 12 portions), la conservation et la note préremplies. Il ne redemande pas de variante et ne revient pas au rendement de base.

La fiche reste liée à l’identifiant de la préparation prévue. L’enregistrement confirme cette préparation, ajoute son lot et la retire des tâches à produire ; il ne crée pas une production libre supplémentaire. Le mode et la quantité sont fixés au plan, conformément au contrôle existant du serveur. Date réelle de fabrication, conservation et note restent modifiables. Une annulation de la fiche ne produit rien. Pour un plat à parties séparées, le nombre de portions de la recette source calcule les ingrédients puis crée les parties de stock ensemble. Ouvrir ensuite une cuisine libre normale rétablit ses champs modifiables. Les actions Confirmer la production et Retirer du planning restent disponibles.

Pas de migration ni de changement du moteur de stocks, des courses ou des portions. Tests ciblés du vrai gestionnaire de formulaire : quantité 12 conservée, ingrédients multipliés, plan transmis, double clic bloqué et cuisine libre rétablie. Chrome local avec compte et base fictive : variante bœuf conservée, ouverture/annulation sans lot, enregistrement relié au plan et un seul lot ; puis préparation en trois parties de 12 portions donnant trois sous-lots 300/300/600 g, sans doublon. Inspection à 1440/900/390 px. Contrôles complets et publication consignés dans la PR. Documentation de reprise actualisée. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur, référence 0.3.32 conservée.


## Apports des variantes et cohérence du batch cooking — 0.12.0

Sur une recette modulable, Apports selon les choix ouvre une comparaison consultative depuis la fiche. La fenêtre de choix avant Cuisiner ou Planifier affiche aussi les apports de la combinaison sélectionnée dès le changement d’une protéine, d’une saveur ou d’un topping. Calories par portion/pièce/tranche ou pour 100 g/ml, badge de densité calorique et macronutriments utilisent les quantités, états et coefficients réels de la recette ; aucune moyenne ni remplacement de valeur absente par zéro. Les badges du catalogue portent la mention par défaut. L’éditeur d’une recette existante propose une comparaison de sa version enregistrée : enregistrer les nouvelles quantités/ingrédients avant de les comparer. Les réponses tardives d’un ancien choix sont ignorées. La comparaison GET ne crée ni recette, ni déclinaison, ni repas ; seule l’utilisation explicite d’une combinaison conserve le mécanisme d’instantané existant. Les membres du foyer peuvent comparer.

Les préparations Hors menus prévues mais non produites apparaissent maintenant aussi dans leur groupe de production, notamment le batch cooking, sur la plage choisie. Elles portent un libellé Hors menus et gardent leur quantité explicite et la confirmation de production. Une semaine partielle vide ne masque plus le premier hors menus planifié : le choix par défaut tient aussi compte de ces dates. Les courses utilisaient déjà ces demandes : l’affichage ne les additionne pas une seconde fois au moteur des besoins. Après confirmation, la préparation quitte les tâches à faire et son lot est ajouté une seule fois au stock. Les autres catégories conservent la période générale des courses.

Quand une modification de recette a conservé une ancienne version pour protéger les lots, les cartes de préparation concernées et le message d’enregistrement proposent Actualiser les repas à préparer. L’aperçu indique source, nouvelle recette, dates et personnes de la plage choisie. Les quantités identiques ou convertibles par une équivalence explicitement déclarée sont préremplies ; sans équivalence d’unité, l’utilisateur doit saisir la quantité. Un découpage incompatible en parties reste à reprendre manuellement dans le calendrier. L’application est transactionnelle et refuse un aperçu périmé. Elle conserve les dates, participants, autres recettes et repas déjà préparés/utilisés ; les lots et l’historique restent liés à leur ancienne recette. Les besoins, calendrier et courses sont ensuite recalculés. Les préparations hors menus déjà planifiées ne sont pas automatiquement réécrites par cette mise à jour des repas. Une simple modification de recette actualise aussi les vues de besoins et courses.

Aucune migration ni nouvelle règle de portions. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur, référence 0.3.32 conservée. Validation : aperçu comparé aux déclinaisons réellement résolues, avec ingrédients liés, service séparé, absence de topping, conversions et nutriments manquants ; lecture sans création et droits du foyer ; mise à jour de repas, équivalences explicites, saisie manuelle, ancien aperçu refusé, historiques/lots conservés et courses actualisées. Chrome local sur données fictives : comparaison poulet/bœuf avant planification, hors menus de 12 portions visible puis produit une seule fois dans le batch, ancienne recette basculée après vérification des quantités. Inspection à 1440/900/390 px ; pas d’appareil physique. 451 tests complets réussis. Publication finale consignée dans la PR fonctionnelle.


## Enregistrement du rééquilibrage journalier avec un compte connecté — 0.11.3

Erreur reproduite sur données fictives avec quatre personnes et un muffin décliné en topping chocolat : l’aperçu retire seulement la pièce de Bibinette (1466,8 → 1242,4 kcal pour un objectif de 1300), mais l’application renvoyait daily-rebalance-failed. La transaction du compte et du foyer avait déjà effectué des lectures lorsque le rééquilibrage lançait BEGIN ISOLATION LEVEL SERIALIZABLE ; PostgreSQL refusait le changement d’isolation. Le point de sauvegarde n’avait alors pas été créé pour le retour arrière.

La seule requête POST d’application du rééquilibrage démarre maintenant sa transaction externe en isolation sérialisable, avant les requêtes du foyer. La transaction interne utilise un point de sauvegarde à ce même niveau d’isolation. Les autres requêtes conservent leur fonctionnement. Un conflit de sérialisation, y compris à la validation finale, renvoie un aperçu périmé (409), avec annulation complète des changements, au lieu d’une erreur 500.

Aucune modification de la règle de calcul : l’aperçu proposé, les portions des autres personnes, les mineurs, les ingrédients de la déclinaison et les stocks sont conservés. Pas de migration. Validation : l’erreur a d’abord été reproduite par le vrai chemin HTTP avec authentification, rôle SQL et isolation du foyer. Le test passe après correction ; il vérifie le retrait d’un seul muffin, les autres portions et la variante conservées, l’absence de mouvement de stock, le refus d’un ancien aperçu, une application sans changement, un conflit simulé à la validation finale avec retour arrière, les droits du gestionnaire et le refus d’un autre foyer. Les cinq tests ciblés et les 443 tests complets sont réussis ; publication finale consignée dans la PR. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur, référence 0.3.32 conservée.


## Filtres du stock des préparations produites — 0.11.2

Dans Courses & stocks → Stocks → Stock des préparations déjà produites, le filtre par défaut Stocks et besoins masque les préparations dont le restant réel et les réservations sont tous deux nuls, même si des lots historiques existent. Les réservations non couvertes et les stocks négatifs restent visibles. Stocks restants affiche les quantités physiquement présentes, y compris celles réservées ; À refaire affiche le manque après réservation ou un stock négatif. Une préparation partiellement couverte peut donc figurer dans les deux filtres. Tout afficher inclut les préparations épuisées et conserve l’accès aux anciens lots et corrections.

Les compteurs et messages vides suivent le filtre. Le choix est conservé par foyer dans ce navigateur, pendant les actualisations et au prochain chargement. Le changement de filtre est local et ne déclenche pas de nouvelle requête ; après une correction du restant ou une fabrication, les catégories sont recalculées avec les valeurs actualisées. Aucune suppression, migration ni modification des calculs, menus, réservations ou stocks. Référence 0.3.32 conservée ; aucun accès à Unraid ni Nginx.

Validation : 13 tests ciblés réussis (filtres, réservations intégrales ou partielles, stocks négatifs, corrections du restant et invariants des lots). Chrome local sur données fictives : filtre par défaut, stocks restants, à refaire, historique inclus, correction de Banana Bread à zéro et disparition du filtre restant, lots conservés, choix retrouvé après rechargement. Inspection à 1440/900/390 px. Contrôles complets GitHub et publication finale consignés dans la PR du correctif. Déploiement par l’utilisateur.


## Titres des déclinaisons en collation — 0.11.1

Le calendrier utilisait seulement les éléments de rôle plat/accompagnement pour son titre. Un repas composé d’une pâtisserie individuelle (rôle dessert, par exemple catégorie Pâtisserie en collation) affichait donc Repas. Le titre reprend maintenant les recettes des autres catégories lorsqu’il n’y a pas de plat/accompagnement, en conservant le nom complet du topping. Les parties séparées sont regroupées avec le nom complet de leur parent, sans tronquer une déclinaison après le tiret. Les repas avec plat gardent leur titre principal, les repas exceptionnels leur titre dédié.

Confirmation utilisateur : les ingrédients des déclinaisons sont corrects. Aucun changement de sélection, nutrition, quantité, recette, menu, production ou stock ; aucune migration. Quatre muffins prévus peuvent toujours proposer six à préparer si le minimum de cette recette est six. Validation : 11 tests ciblés réussis ; Chrome sur données fictives avec deux toppings distincts le même jour, au petit-déjeuner et en collation, titre complet et Cuisiner conservant le topping chocolat et le minimum de six pièces. Inspection à 1440/900/390 px. Contrôles complets GitHub et publication finale dans la PR du correctif. Aucun accès à Unraid ni Nginx ; déploiement par l’utilisateur. Référence 0.3.32 conservée.


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

### Publication vérifiée de la 0.7.2

PR #193 fusionnée au commit `f2f2393fff27ad67dffda425d04cc4651153816e`. 412 tests réussis ; contrôles et publication réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/43241841565. Tags GHCR `0.7.2` et `v0.7.2` vérifiés directement : `sha256:0631c3d13b1ce3347af70c24febf5cd0d3c65f0eba8f45a45846ec651216cf7b`. Référence 0.3.32 inchangée.

## Avis facultatifs par recette — 0.7.2

Dans Modifier une recette, la case « Autoriser les avis » permet de désactiver la notation pour cette recette dans le foyer actif, par exemple un café ou un skyr. Elle est activée par défaut ; aucune désactivation n’est déduite du nom. Les personnes autorisées à modifier la recette peuvent changer ce réglage. Une recette désactivée ne figure plus dans les suggestions à noter, le classement local, les filtres par avis ni les étoiles de la fiche Cuisiner. Le serveur refuse aussi un nouveau vote direct.

Les notes déjà enregistrées sont conservées et redeviennent visibles après réactivation. Le choix reste privé au foyer, n’est pas exporté avec une publication et n’est pas imposé au foyer qui importe une recette. Une duplication conserve le choix de la recette source ; un nouveau brouillon démarre avec les avis activés. Migration additive `20261112_recipe_rating_enabled.sql`, sans réécriture des menus, stocks, quantités ni avis existants.

Validation : 412 tests complets réussis. Chrome local sur données fictives : désactivation dans le vrai formulaire, enregistrement, réouverture avec choix conservé et disparition des avis ; inspection visuelle à 1280 et 390 px. Les contrôles et la vérification de publication sont consignés dans la PR de cette version. Aucun accès à Unraid ni Nginx ; l’utilisateur seul déploie.

### Publication vérifiée de la 0.7.1

PR #192 fusionnée au commit `0b6b39338da2de9298b8ad892c6ee134d921a7d5`. 410 tests locaux réussis et parcours Chrome fictif validé. Contrôles et publication réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/43238253631. Tags `0.7.1` et `v0.7.1` vérifiés directement dans GHCR, digest `sha256:81db2a7f8edf99f700a90e65289e3967fedd8c5e251459ab342a46e310371d4b`.

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

## Compatibilité des photos — 0.4.2, PR #188

La limite du corps JSON authentifié est alignée sur celle du serveur existant (9 500 000 octets), afin de conserver l’envoi des photos de recettes jusqu’à 5 Mio encodées en base64. Un test accepte une charge supérieure à 2 Mo et refuse celle dépassant la limite. Cette correction ne change pas le modèle des comptes ni les données. Les références de publication 0.4.1 ci-dessous restent celles de la livraison précédente ; reprendre la 0.4.2 après vérification de sa publication GitHub/GHCR.

## Publication vérifiée des comptes — 0.4.1

PR fonctionnelle #186 puis correction finale #187 fusionnées. Source applicative : `e36424c9c855974f2ab5ff849078a5f870e4ea1c`. Contrôles et publication réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/43085131322. Suite complète : 395 tests réussis ; parcours Chrome local sur données fictives validé.

Les tags GHCR `0.4.1` et `v0.4.1` ont le digest `sha256:301d3434012c5c5021676616ee09b6b610e586bed47aacae1a4e973876c5d991`. La référence fonctionnelle `0.3.32` / `v0.3.32` conserve le digest `sha256:defb5b021e29975bbc6ab96576d791d54e3ca622a690082ed33341c6d87301ea`.

Avant migration, sauvegarder la base et les photos séparées. Pour un clone de test, privilégier un export/restauration PostgreSQL vers une base et des volumes distincts ; les réglages applicatifs enregistrés en base sont copiés, les paramètres des conteneurs restent propres à l’environnement de test. Ne jamais copier des fichiers PostgreSQL à chaud. Le retour à la 0.3.32 nécessite la base antérieure à la migration des comptes. Aucun accès au serveur Unraid ni à Nginx n’a été effectué.

## Développement des comptes — 0.4.1

Comptes individuels, rôles cumulables, sélection du foyer actif, profils personnels, isolation PostgreSQL, partage volontaire et packages de recettes. La référence fonctionnelle reste la release 0.3.32. Voir REPRISE.md pour la première connexion et ROLLBACK.md pour la compatibilité de la base.


## Release fonctionnelle de référence — 11 novembre 2026

La version 0.3.32 est conservée comme référence fonctionnelle à la demande de l’utilisateur. Source figée au commit `bab03e3532c923c09da327f70b65b5fcb8fdc7ee`, tag Git `v0.3.32`, release GitHub `https://github.com/throlan/Lapinou-Dish/releases/tag/v0.3.32`. Les futurs développements partent de branches dédiées et utilisent un nouveau numéro applicatif dès qu’ils changent le fonctionnement.

Image de référence `ghcr.io/throlan/lapinou-dish:0.3.32`. Référence exacte `ghcr.io/throlan/lapinou-dish@sha256:defb5b021e29975bbc6ab96576d791d54e3ca622a690082ed33341c6d87301ea`. Les tags `0.3.32` et `v0.3.32` ont été vérifiés sur GHCR. Le digest est conservé dans `docker/rollback-images.json` pour les vérifications de publication. Les retours d’image ne restaurent pas la base de données. Examiner les migrations des versions futures avant tout retour à cette référence.


## Revue du catalogue : catégories et validation guidée — 0.3.23

Filtre par catégorie rétabli dans la revue, vue initiale limitée aux estimations et distinction explicite avec les valeurs actuelles préremplies. Les lignes inchangées ne peuvent plus être cochées ; une source manquante est signalée avec le nom de l'aliment. Voir [REPRISE.md](REPRISE.md).

## Revue du catalogue : affichage corrigé — 0.3.22

Les lignes de révision restent compactes : le bouton d'exclusion ne tombe plus dans la colonne étroite de la case à cocher. L'affichage mobile et l'alignement du filtre des valeurs identiques sont corrigés. Voir [REPRISE.md](REPRISE.md).

## Revue du catalogue : filtres et exports — 0.3.21

Les exclusions de cuisson par catégorie ou aliment sont conservées par foyer et ne touchent pas aux données alimentaires. La revue affiche les valeurs actuelles même sans estimation, masque par défaut les estimations identiques aux valeurs déjà présentes et exporte la vue filtrée ou la sélection en CSV. **372 tests locaux réussis.** Voir [REPRISE.md](REPRISE.md).

## Catalogue complet en revue — 0.3.20

L'administration présente toutes les fiches avec valeurs actuelles et estimations éditables. La validation ne touche que les lignes cochées après aperçu. Les 1 058 fiches de l'export ont été inventoriées ; 513 disposent d'au moins une proposition de conversion ou de catégorie, les autres restent affichées sans chiffre forcé. Voir [REPRISE.md](REPRISE.md).

## État de cuisson par ingrédient — 0.3.19

Une même fiche alimentaire peut servir crue ou être cuite selon la recette. Le rendement cuit/cru reste dans la fiche aliment ; l'éditeur demande le choix pour chaque nouvel ingrédient. Les recettes anciennes et les quantités déjà enregistrées dans les menus et stocks sont conservées. Voir [REPRISE.md](REPRISE.md).

## Audit du catalogue — 0.3.18

Le parcours de revue 0.3.17 reçoit 27 mesures USDA sur 14 autres fiches : 17 propositions sur champs vides, 2 écarts avec une valeur présente et 8 comparateurs de forme incertaine. Aucun aliment réel, recette ou menu n'est modifié automatiquement. Audit cumulé : 58 fiches et 91 lignes documentées. Détails dans [CATALOGUE-SUGGESTIONS.md](CATALOGUE-SUGGESTIONS.md). 364 tests locaux réussis ; publication à vérifier après fusion.

## Catalogue : propositions sourcées — 0.3.17

Dans Aliments, « Examiner les propositions sourcées » rapproche les références Ciqual exactes et affiche la valeur actuelle, les méthodes et les limites. Une proposition pour un champ vide peut être reportée volontairement dans la saisie, puis enregistrée en lot après aperçu, avec sa provenance par ligne. Les écarts sur valeurs existantes renvoient à la fiche individuelle. Aucun remplissage automatique. [Audit de l’export et conflits](CATALOGUE-SUGGESTIONS.md) : 1 057 fiches inventoriées, 44 examinées en détail, 64 lignes dont 39 écarts pour 38 couples fiche/champ. L’examen des autres références et les pesées du foyer restent à faire.

## 0.3.16 — classement et édition groupée du catalogue

Les catégories alimentaires utilisent les codes exacts de Ciqual 2025 et restent modifiables dans la fiche. Le catalogue se filtre par catégorie ou champ manquant ; une sélection jusqu'à 250 fiches peut être modifiée champ par champ, avec aperçu, source, contrôle de version et protection contre l'écrasement involontaire. Les 49 références hors Ciqual et les coefficients discutables restent à examiner ; aucune valeur de cuisson ou de mesure n'est appliquée automatiquement. 362 tests locaux réussis. Publication demandée par l'utilisateur.

## 0.3.15 — scoop de whey de 60 ml

Le doseur par défaut fait 60 ml. Pour une whey sans conversion propre, l'estimation est 30 g par scoop (plage utilisateur 25–35 g). Le poids spécifique déjà saisi, ou une densité connue, a priorité. Les autres poudres sans mesure restent à compléter. Les conversions des recettes, achats et stocks concordent ; les anciennes fiches et quantités de menus ne sont pas modifiées automatiquement.

361 tests locaux réussis. PR [#166](https://github.com/throlan/Lapinou-Dish/pull/166) fusionnée ; [contrôles et publication GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/42011194348). Les tags `0.3.15` et `v0.3.15` ont le même digest.

## 0.3.14 — export du catalogue alimentaire

Bouton d’export CSV sur la page Aliments. Il réunit toutes les fiches, leurs données nutritionnelles et de conversion, et les unités d’achat du foyer choisi, indépendamment de la pagination et des filtres. Le fichier sert au futur examen des données manquantes ; aucune correction automatique n’est appliquée. 358 tests locaux réussis. PR [#164](https://github.com/throlan/Lapinou-Dish/pull/164) fusionnée ; [contrôles et publication GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/42005139395). Les tags `0.3.14` et `v0.3.14` ont le même digest.

## 0.3.13 — coefficients alimentaires et propositions de repas

Le rapport cru/cuit se saisit dans la fiche aliment. Les anciens coefficients identiques sont repris ; les valeurs contradictoires sont listées dans Administration pour décision manuelle. Les anciennes quantités cuites des menus et les stocks restent enregistrés tels quels. L'éditeur de recette ne propose plus de coefficient de cuisson par ligne. Les conversions entre deux aliments pour les courses restent distinctes.

Les catégories de repas sont configurables par créneau et peuvent être communes ou individuelles selon le créneau ; pâtisserie commune au petit-déjeuner, individuelle à la collation. Entrée et laitage sont proposés, accompagnement, sauce et assaisonnement restent possibles. Le « rôle » technique n'est plus affiché dans Administration. Le calcul initial des recettes séparées suit les proportions d'assiette d'Administration ; il n'impose pas 40 g de protéines par repas. Un dessert se retire entier, puis les féculents séparés diminuent par 10 g si nécessaire, en conservant le plat principal. Un dépassement peut rester visible. Le rééquilibrage de la journée requiert un aperçu et une validation ; la semaine ne change pas automatiquement. Les anciennes quantités de menus ne sont recalculées que sur demande explicite.

356 tests complets locaux réussis, puis contrôle ciblé du plat indivisible et des catégories réussi. Vérification de syntaxe et des différences réussie. PR [#162](https://github.com/throlan/Lapinou-Dish/pull/162) fusionnée au commit `e5ab07d643b17762c129d6cf019fb6699000ce65`. [Contrôles et publication GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/41855028940). Tags `0.3.13` et `v0.3.13` vérifiés, digest commun `sha256:08b1eb241df9d726949143720f8fe96374ce513ee9210cf100b46382abb417d7`. Aucun accès à Unraid/Nginx ; le rendu réel sur l'installation reste à vérifier par l'utilisateur.

## 0.3.12 — présentation adaptative

Navigation téléphone, tablette et PC harmonisée avec le logo ; couleurs plus reposantes, cartes avec photos et repli sur le logo. Accueil hebdomadaire conservé, avec choix du jour sur téléphone ; calendrier également navigable par jour sur petit écran. Les fonctionnalités et calculs existants sont conservés.

## 0.3.11 livrée — Courses & stocks en onglets

La liste de courses, les préparations, les stocks, les magasins et les routines sont accessibles dans cinq onglets. La période des courses reste commune et visible en haut. Les saisies en cours sont conservées entre les onglets. Aucun changement de calcul ni de données.

353 tests locaux réussis. PR #159 fusionnée au commit `36dc404a107b658c3bf0c89297f9e7e2abab5ee3` ; contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41821597464. Tags `0.3.11` et `v0.3.11` vérifiés, digest commun `sha256:36534f81dc4e4648789f2c7e42104559f4499e59a3fa7cc7edeb02df718b7089`.

## 0.3.10 livrée

Accueil hebdomadaire lundi–dimanche en sept lignes de quatre cartes compactes ; fiche de consultation des portions et actions pour les repas préparés ; cases du calendrier allégées. La collation du soir disparaît des nouveaux menus, mais les repas historiques restent consultables. Les pourcentages kcal demeurent modifiables dans Administration (actuellement 20/40/10/30, total 100 %). Fiche aliment commune depuis courses, catalogue et recettes avec ses réglages d’achat. Préparations hors menus planifiées : ingrédients dans les courses dès la planification, stock réel seulement après confirmation, annulation restitutive.

353 tests locaux réussis. PR #157 fusionnée au commit `0db84ae2cb12d0922c9e59ecb11d4662e5af12ad` ; contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41811943655. Tags `0.3.10` et `v0.3.10` vérifiés, digest commun `sha256:b46eaf9e3f60e68c5ca35bb06ee1322a1db9176ccf3ddcaa2c92ff2aa4c5314a`.

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

Publication précédente vérifiée : **0.3.8**. PR #153 fusionnée au commit `7fcc8ed34d3277c27a6f7c4c479107ebbef755bb` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41293831666. Tags `0.3.8` et `v0.3.8` vérifiés, digest commun `sha256:e7d2a7a5377943b7a3ee38d89ef58d5ffb96b059bb1a35da71de71def2bc7453`. Conservation des versions numérotées sans purge automatique, au minimum les cinq dernières ; une republication documentaire ne remplace pas l’image numérotée. Voir [ROLLBACK.md](ROLLBACK.md).

Pour revenir à la 0.2.97 : ghcr.io/throlan/lapinou-dish:0.2.97. La 0.2.98 reste identifiée comme défectueuse au démarrage. Aucun changement de migration entre 0.2.97 et 0.2.99 ; une ancienne image ne restaure pas les données. Ne jamais supprimer les volumes pour changer de version. Aucun accès à Unraid/Nginx.

**314 tests complets locaux réussis**, dont tests du script (alias exacts, idempotence, conservation, erreurs/conflits sans écrasement). Livraison vérifiée : PR #135 fusionnée au commit 7af9a023c961637f780157b6665d31110d22be28 ; tests et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39991969857 . Les dix tags numériques/v des versions 0.2.95 à 0.2.99 ont été vérifiés directement dans GHCR et correspondent aux digests des images d’origine.


## Correctif de démarrage — 0.2.99

Cause reproduite sur le code 0.2.98 : app.js importe food-pagination.js, ajouté pour la pagination du catalogue, mais ce module n’était pas inscrit dans la liste des ressources statiques du serveur. GET /food-pagination.js renvoyait 404 avec un contenu JSON. Le navigateur ne pouvait donc pas exécuter app.js : connexion et tableau de bord restaient au chargement, sans gestionnaires utilisables sur les boutons.

Correction minimale : servir explicitement /food-pagination.js avec le type JavaScript, sans authentification préalable, comme les autres modules de démarrage. Version et clés de cache passent en 0.2.99. Aucun changement métier, calcul, pagination, donnée ou migration.

Un nouveau test parcourt les points d’entrée module du HTML et leurs dépendances locales via le vrai gestionnaire HTTP, avant connexion, avec contrôle du statut et du type MIME. Il échoue sur la 0.2.98 avec /food-pagination.js : 404, puis passe après correction. **311 tests complets locaux réussis**. Validation Chrome locale sur base fictive : connexion initiale et rechargement connecté, tableau de bord rempli, navigation sur les sept pages à 1440/1280/900/390/320 px, pagination haute/basse (25 puis 250 sélectionnés, 87 aliments fictifs), ouverture de la fiche aliment. Aucune erreur JS/HTTP ou ressource manquante ni débordement horizontal. Aucun appareil physique ou accès à l’installation. Dernière version publiée vérifiée avant ce correctif : 0.2.98, documentation PR #133, commit 6547d6a, workflow réussi https://github.com/throlan/Lapinou-Dish/actions/runs/39978043811 . Vérifier la publication du commit fusionné 0.2.99 avant d’annoncer la livraison. Aucun accès à Unraid/Nginx ; l’utilisateur déploie lui-même.

Les chapitres suivants archivent les livraisons précédentes ; la référence courante est **0.3.6**, décrite en tête de document.

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

Gestion des comptes individuels explicitement reportée : modèle communautaire/hébergé et droits non validés, aucun code ajouté. Depuis la 0.3.10, une seule collation l’après-midi est proposée pour les nouveaux menus et les anciens repas du soir restent consultables. Aucun quota selon l’âge n’a été appliqué. Aucun autre chantier ne démarre automatiquement.

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
- Calendrier à quatre créneaux actifs, anciens repas du soir conservés, repas multi-recettes, boissons/desserts individuels et duplication complète sur plusieurs dates. Au petit-déjeuner et à la collation après-midi, les desserts adaptés peuvent aussi être ajoutés comme recette commune et bénéficier du calcul de portions ; au déjeuner et au dîner, le dessert individuel s’ajoute avec « + Dessert ».
- Calendrier imprimable en A4 paysage sur sept colonnes ; l’impression affiche seulement les menus et les quantités pour chaque personne.
- Préparation entière en grammes estimés, deux ou trois parties indépendantes, coefficients de cuisson, conversions des repas/lots existants et conservation des ingrédients crus.
- Ingrédients en blocs lisibles ; liens en bas ; coefficient individuel affiché pour les féculents sélectionnés.
- Administration : profils compacts et datés, relevés de poids et historiques ; répartition des kcal à 100 %, modifiable par foyer. Choix actuel : 20/40/10/30 % sur les quatre créneaux actifs.
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
