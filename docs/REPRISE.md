# Cahier de reprise — 22 novembre 2026

La 0.18.11 demande la composition des plats à variantes dans « Choisir les repas ». Les portions, apports et ingrédients suivent la combinaison enregistrée. Le récapitulatif propose des compléments de petit-déjeuner, desserts et collations sur les emplacements libres selon les soldes des personnes. La collation reste plafonnée au quota du créneau. Les ajouts sont facultatifs. Aucune migration.

La 0.18.10 rétablit la dernière page ouverte au rechargement, avec l’onglet des courses ou de l’administration. Depuis un ingrédient de la recette, la création d’une liste réutilisable revient à la ligne en cours et y sélectionne la nouvelle liste. Les autres champs de la recette restent saisis pendant ce parcours. Aucune migration.

La 0.18.9 ajoute la boisson du petit-déjeuner par défaut dans les profils. La fenêtre « Choisir les repas » propose une boisson distincte par convive après calcul des plats, selon son solde, et permet de changer ou retirer ce choix pour la journée. Le calcul et le recalcul du petit-déjeuner proposent une pièce par personne pour les recettes correspondantes. Après le plat et la boisson, un laitage ou une pâtisserie peut être ajouté si le solde du créneau et celui de la journée le permettent. Les repas existants conservent leurs boissons. Les collations suivent le pourcentage configuré pour le créneau, et ne reçoivent aucun report calorique. Le solde disponible peut augmenter les portions du déjeuner et du dîner dans les plafonds. L’arrondi d’une quantité proposée ne peut pas dépasser ce budget. Chaque choix de plat accepte une recherche dans le titre complet, avec les indications de stock. Migration additive 20261121_breakfast_drink_preferences.sql.

La 0.18.8 permet de retirer du catalogue une recette utilisée uniquement dans des repas ou productions historiques. « Supprimer » archive la fiche et ses parties en conservant les photos, portions, repas, lots et mouvements. Une recette sans référence est supprimée. Les menus d’aujourd’hui ou à venir, les préparations prévues à traiter et les recettes actives qui utilisent la fiche comme ingrédient empêchent le retrait. Aucune migration.

La 0.18.7 place « Achats et stock des produits » dans Courses & stocks → Liste de courses. La recherche catalogue ouvre le stock, la fiche et la saisie d’un achat même hors liste. Les produits regroupés utilisent le stock commun défini par « Acheter sous… ». Le stock détaillé est filtrable par nom, quantité négative, stock épuisé ou positif, commande suggérée, manque prévu et estimation incomplète. L’onglet Stocks garde les préparations produites. Aucune migration.

La 0.18.3 ajoute la confirmation par partie consommée, les comparaisons avec les repères personnalisés et le stock libre dans les sélecteurs. Le calendrier 0.18.2 a été validé sur les mardis et samedis. Conserver les quatre sélecteurs, les participants indépendants, le total dynamique et les suggestions communes selon le solde de chacun. Voir [le journal de session](SESSION-2026-11-20-CALENDRIER.md).

La 0.18.4 permet une quantité de 0 par recette et par convive, y compris pour un plat principal partagé. Le 0 est retrouvé à la réouverture et conservé au recalcul. Seules les portions servies sont enregistrées pour les courses, le stock et les confirmations. Aucune migration.

La 0.18.5 simplifie « Choisir les repas », propose le dessert aux convives dont le solde le permet et peut employer le solde du jour pour ajuster les portions proposées. La portion commune de viande, poisson et tofu est réglable dans Administration → Portions et plafonds (200 g avant cuisson par défaut). Voir [le journal de session](SESSION-2026-11-20-CALENDRIER.md).

La 0.18.6 regroupe les confirmations à la journée et affiche Kcal, P, G, L et F par personne. « Modifier » ouvre la sélection détaillée par repas. Le calcul applique le plafond de poids même aux préparations entières et ajuste les plats avant les compléments. Le petit-déjeuner propose une boisson.

## Rééquilibrage journalier par étapes — 0.17.4

Correction du 20 novembre : chaque retrait de dessert entier est évalué séparément, puis le total est recalculé avant de considérer le suivant. Le retrait n’est proposé que s’il réduit strictement l’écart absolu à la cible journalière. Le même contrôle s’applique à chaque pas de 10 g de féculents séparés. À distance égale, les quantités sont conservées ; entre deux retraits aussi proches, le plus petit est privilégié. Un petit dépassement résiduel reste visible au lieu d’une réduction qui éloignerait davantage de la cible. Aucune tolérance calorique arbitraire ni seuil protéique ajouté.

Cas de régression sur données fictives : total 1 485,1 kcal, cible 1 363 ; un dessert à 100 kcal est retiré, l’autre préparation à 195,4 kcal est conservée, résultat 1 385,1 kcal plutôt que 1 189,7. Ces énergies ne prétendent pas représenter l’étiquette du skyr réel. Le plat principal, les mineurs, les préparations déjà utilisées et les données nutritionnelles incomplètes restent protégés. Aperçu et validation explicite conservés, jeton de fraîcheur et transaction inchangés. Aucun menu recalculé au déploiement, aucune migration.


## Objectif explicite et suivi du maintien — 0.17.3

Le profil rétablit trois choix distincts : maintien, perte de poids, prise de poids. Les rythmes rapide/modéré/lent apparaissent uniquement en perte de poids. Un maintien explicitement choisi reste sans déficit même si le poids de forme est inférieur au poids mesuré ; le préréglage 35/35/30 reste réservé à la perte. Les anciens profils sans objectif explicite gardent leur interprétation précédente jusqu’à l’enregistrement du choix. Modèle profile-auto-v5.

Prise de poids : choix enregistrable, mais aucun surplus n’est inventé ni appliqué ; la cible précédente reste conservée tant que la règle n’est pas définie, selon la décision de l’utilisateur. Les objectifs de poids ont désormais leur propre formulaire et bouton, sans obligation de compléter les antécédents. Cela permet notamment de les enregistrer pour un adolescent sans lui appliquer le déficit ou la projection adultes.

Le suivi affiche les pesées réelles même quand le modèle adulte n’est pas applicable. Le volet de maintien est ouvert et explique son tableau mensuel ; la simulation adulte reste dans son domaine existant. Chez les adolescents, l’historique est affiché, sans prédire la croissance par une courbe adulte. Les quantités des menus restent inchangées. Aucune migration supplémentaire.


## Capacités personnelles et répartition en perte de poids — 0.17.2

Décision validée le 19 novembre : pour les adultes en perte de poids uniquement, appliquer le repère applicatif 35 % protéines / 35 % glucides / 30 % lipides aux calories obtenues après le rythme lent −10 %, modéré −20 % ou rapide −30 %, déficit alimentaire toujours limité à 750 kcal/j. Conversion 4/4/9, arrondie au dixième de gramme. Ce repère choisi n’est pas une recommandation thérapeutique universelle ; maintien, objectif atteint et profils mineurs ne reçoivent pas ce préréglage. Les garde-fous existants et le contrôle du minimum protéique restent actifs. Modèle profile-auto-v4 : les profils déjà en suivi automatique actualisent leurs repères à leur prochaine consultation ; les historiques et quantités des menus restent conservés.

Chaque profil dispose d’un champ facultatif « Capacité du plat principal », en grammes cuits, avec un enregistrement indépendant du questionnaire nutritionnel. Aucun plafond imposé par prénom. Le total couvre toutes les parties du plat principal, même séparées ; les ajouts individuels restent distincts. Une valeur personnelle remplace le plafond historique du plat mélangé ; les autres limites d’ingrédients restent conservées. Champ vide : retour aux réglages antérieurs. Plage technique de saisie 1–5 000 g, sans valeur présélectionnée ni prétention médicale.

La limite intervient dans les prochaines propositions ou après « Recalculer les portions », sans modifier automatiquement un menu existant. Les parties viande/poisson séparées sont conservées si possible ; les accompagnements diminuent. Si la viande seule ou une pièce indivisible ne tient pas, les quantités sont conservées et un conflit est signalé. Un plat mélangé peut être réduit globalement, avec avertissement sur ses ingrédients intégrés. Une masse cuite inconnue reste inconnue et déclenche un avertissement. Aucun dessert ou collation ajouté automatiquement ; l’aperçu de compléments validables reste à développer séparément.

Migration additive 20261119_person_meal_capacity.sql : people.main_dish_cap_g, facultatif. Accès propre profil ou gestionnaire, foyer contrôlé. Aucun accès Unraid/Nginx ni données réelles. Les travaux interrompus restent dans leur worktree ; aucun ajout de complément non validé n’est publié avec cette version.


## Rythmes validés et plafond — 0.17.1

Choix du 19 novembre : rapide 30 %, modérée 20 %, lente 10 %, maintien 0 %, déficit alimentaire limité à 750 kcal/j. Sélecteur dans le profil, niveau modéré conservé pour les profils sans choix. Calcul et application automatiques ; arrondi de l’apport à la kcal supérieure, pour respecter strictement taux et plafond. Au poids de forme, maintien. Les garde-fous médicaux et les apports trop bas restent prioritaires. Modèle profile-auto-v3, aucune migration supplémentaire.

Ces catégories et ce plafond sont des choix validés pour l’application, pas une recommandation universelle de perte de poids. Sources, origine de l’ancienne règle, limites et exemples : [DEFICIT-CALORIQUE.md](DEFICIT-CALORIQUE.md). Le plafond concerne le déficit alimentaire calculé, pas la somme de celui-ci et d’une activité supplémentaire simulée. Les quantités des menus et les stocks restent conservés.

Validation locale : 17 tests ciblés réussis couvrant les quatre niveaux, le plafond exact malgré les arrondis, le maintien et l’objectif atteint, la persistance du choix, l’interface, la suppression du champ de malaises et les droits API/SQL. Contrôles complets sur la PR de livraison.


## Correction du champ de malaises — 0.17.1

À la demande de l’utilisateur, le champ combiné « Dumping ou malaises après les repas » est retiré du formulaire et des conditions de calcul. Il ne permettait pas de distinguer un diagnostic, un antécédent et des symptômes non spécifiques. Le champ distinct sur les hypoglycémies connues ou le traitement à risque reste présent ; les autres garde-fous ne changent pas. Le modèle devient profile-auto-v2.

Les anciens questionnaires ne sont pas effacés ni réécrits : une ancienne réponse dumping=yes/unknown est simplement ignorée par le nouveau calcul. Les profils déjà activés sont recalculés à leur consultation habituelle, sans ressaisie et sans modification des quantités des menus. Les cinq repères et la projection redeviennent disponibles lorsque les autres conditions sont remplies. Aucun nouveau ratio thérapeutique ni diagnostic de dumping n’est déduit de cette suppression.

Validation locale : 16 tests ciblés réussis, incluant un profil fictif avec chirurgie ancienne et ancienne réponse positive, les cinq repères, la projection, la persistance sans réécriture du questionnaire, l’absence de champ dans l’interface et la conservation des contrôles rénaux/hypoglycémies. Contrôles complets et publication à vérifier sur la PR de correction.


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

## Lot 1 livré sur GitHub — 0.14.0

PR [#207](https://github.com/throlan/Lapinou-Dish/pull/207) fusionnée au commit `c4930d88fdf74243151764f34db9b0e07aa351e3`. [Contrôles et publication](https://github.com/throlan/Lapinou-Dish/actions/runs/44273020997) réussis. Tags GHCR `0.14.0` et `v0.14.0` : `sha256:a8b755127d209c792b1b08ba51a928d7faef844aa3cc9fded171818a45914d4d`. L’âge est calculé à la date consultée quand la naissance est connue. Poids mesuré, poids de forme choisi et objectif intermédiaire facultatif restent distincts. Les objectifs sont datés ; les corrections de profil à date identique sont conservées en révisions ordonnées. Administration et Mon compte proposent la saisie, l’historique et les dates futures. Migration additive `20261118_dated_profile_goals.sql` : la table des objectifs et un ordre de révision du profil, sans réécriture des anciens relevés, cibles kcal, menus, quantités ou stocks. Les lectures kcal du rééquilibrage et de la réserve retiennent la dernière révision applicable. Le moteur de portions n’est pas modifié. Tests ciblés et suite complète : **463 réussis** sur données fictives. La 0.13.1 reste la référence validée en production jusqu’à validation explicite de la 0.14.0.

## Référence actuelle et reprise

La **0.13.1** est la version validée en production par l’utilisateur et la référence fonctionnelle actuelle. `package.json` indique désormais `0.14.0`, publiée sur GitHub mais non encore validée sur son installation. PR [#205](https://github.com/throlan/Lapinou-Dish/pull/205), fusion `99eb6d290aedcf022e25dafd16eb4ef1f4dffdb6`, [contrôles et publication](https://github.com/throlan/Lapinou-Dish/actions/runs/43776135088) réussis. Les tags GHCR `0.13.1` et `v0.13.1` désignent `sha256:4273fb32f8bfdcec16b67936e59b744f31a140e1660f556c5a2c07d704b89e45`. La référence historique 0.3.32 et son digest restent conservés dans [ROLLBACK.md](ROLLBACK.md) et `docker/rollback-images.json`.

Pour reprendre : inventorier les worktrees, branches, stashes, modifications et commits locaux avant de récupérer `origin/main` ; ne faire ni reset destructif ni clean. Lire `AGENTS.md` s’il existe, puis REPRISE, STATUS, PRODUCT, AMELIORATIONS, TODO, ROLLBACK, ARCHITECTURE, DOMAIN, le journal le plus récent et `package.json`. Distinguer la version validée en production de la tête de développement si celle-ci avance. Ne jamais accéder à Unraid, Nginx ou à la base de production, même en lecture. L’utilisateur assure le déploiement ; les tests locaux utilisent des données fictives. Les changements passent par tests, commit/push, PR, contrôles réussis, fusion et vérification GitHub/GHCR. Une nouvelle livraison ne remplace la référence de production qu’après validation par l’utilisateur.

## Architecture et profils — audit de la 0.13.1

Les comptes, foyers privés, droits, variantes, quantités individuelles, aperçu de rééquilibrage journalier, stocks et batch cooking fonctionnent déjà. L’audit 0.13.1 a exécuté 460 tests locaux et 63 migrations sur PGlite fictif vide (58 tables). Date de naissance, poids datés, taille, activité et cible kcal avec origine/méthode sont présents. Une correction du profil à la même date remplace l’entrée actuelle. `nutrition_targets` est une table non utilisée par les écrans ou calculs ; les minima protéiques sont dans les réglages du foyer, avec certains secours liés au prénom. Aucun estimateur Mifflin–St Jeor n’est livré. Les mentions anciennes de « comptes non livrés » ou d’une référence courante 0.3.32 dans les sections historiques ne décrivent plus l’état actuel.

## Prochains lots et garde-fous

Lot 1 livré en 0.14.0 : âge à la date pertinente, poids de forme choisi et objectif intermédiaire facultatif datés, révisions de profil conservées même le même jour. Lot 2 : objectifs nutritionnels datés, avec origine, méthode et validation. Lot 3 : estimation des besoins séparée d’une cible, méthode et paramètres explicites, validation obligatoire. Lot 4 : préférences, allergies et informations facultatives privées. Les critères et tests figurent dans [TODO.md](TODO.md). Ensuite viennent nutriments, optimisation des portions, scores séparés de qualité intrinsèque et d’adéquation personne/repas, puis planification assistée. Les allégations européennes sur les protéines restent distinctes des scores. Aucun objectif de perte de poids automatique pour mineur ou âge inconnu ; aucune donnée de santé facultative envoyée automatiquement à un service externe. Préserver les menus, quantités manuelles, stocks, variantes et calculs déterministes ; les propositions de menu nécessitent un aperçu et une confirmation. Les valeurs alimentaires inconnues restent inconnues, les conflits se règlent au cas par cas, aucune suggestion externe ne s’applique seule. Nettoyage du catalogue, filtre des inutilisés et fusion guidée des doublons restent retirés.

## Icône du conteneur — 0.13.1

Le Dockerfile déclare maintenant le label net.unraid.docker.icon vers le logo public existant : https://raw.githubusercontent.com/throlan/Lapinou-Dish/main/web/icons/app-192.png. Le service app du Compose fourni porte aussi ce label. Aucun changement fonctionnel ni de données, aucune migration. Le passage à 0.13.1 permet de publier cette métadonnée sans réécrire l’image 0.13.0.

Le changement s’applique au conteneur créé depuis la nouvelle image. Un champ Icon URL ou un label explicitement configuré sur l’installation peut garder la priorité : utiliser la même adresse dans cette configuration si nécessaire. L’affichage et l’éventuel cache du serveur restent à vérifier par l’utilisateur après son déploiement. Aucun accès à Unraid ni Nginx, même en lecture. Les références précédentes restent conservées.

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

## Comptes individuels, foyers privés et partage — 0.4.1

Cette version introduit un compte de connexion distinct du profil de personne. Le rôle administrateur de l’application est cumulable avec le rôle gestionnaire ou membre dans chaque foyer. Un compte peut appartenir à plusieurs foyers et choisir son foyer actif. Les profils existants et les profils sans compte restent utilisables.

### Première connexion

L’écran de création du premier administrateur demande le mot de passe actuel de l’application (APP_PASSWORD). « Charger les foyers et profils existants » permet de sélectionner le foyer et le profil à reprendre. Le nouvel identifiant et le nouveau mot de passe personnel servent ensuite à la connexion. La création du premier administrateur est unique et transactionnelle.

Administration → Comptes et foyers permet de changer son mot de passe, gérer son profil personnel, associer les comptes aux profils et administrer les rôles. Le gestionnaire gère les membres et les données communes de son foyer. Le membre consulte les données communes et gère uniquement son propre profil et ses mesures. L’administrateur de l’application gère les comptes et les foyers. Pour gérer les données d’un autre foyer, il s’y rattache explicitement avec « Rejoindre et gérer ce foyer ». Le dernier administrateur actif et le dernier gestionnaire actif d’un foyer sont protégés.

### Isolation et partage

Les requêtes authentifiées utilisent le rôle PostgreSQL restreint lapinou_request avec des politiques de sécurité par ligne. Les données personnelles et les données des foyers sont filtrées côté base et côté serveur. Les mots de passe individuels sont dérivés avec scrypt et un sel aléatoire. Les sessions révocables sont stockées sous forme d’empreintes de jetons aléatoires, avec expiration. Le mot de passe collectif et ses anciennes sessions ne donnent plus accès aux données après cette évolution.

Les aliments Ciqual sont le catalogue officiel commun. Les gestionnaires peuvent en créer des copies privées ; seuls les administrateurs de l’application modifient les fiches officielles. Les autres aliments sont rattachés aux foyers existants. Si plusieurs foyers utilisaient l’ancien catalogue global, les fiches privées sont copiées et leurs références adaptées sans changer les quantités en stock.

Administration → Partage et démarrage permet une publication volontaire d’aliments ou de recettes, puis la récupération d’une copie privée. Les dépendances de préparation maison, les aliments, les rendements, les équivalences et la photo sont inclus. Les menus, profils et stocks sont exclus de la publication. Une publication peut être retirée. Les copies déjà importées restent disponibles.

L’administrateur compose les packages officiels à partir des recettes publiées. Chaque foyer peut choisir les recettes d’un package et les importer, au démarrage ou plus tard. Réimporter la même publication est sans doublon. Les packages sont à composer explicitement ; aucune recette privée du foyer actuel n’est publiée automatiquement.

### Migration et release de référence

La migration 20261111_accounts_households.sql est additive et crée le rôle PostgreSQL restreint ainsi que les comptes, sessions, appartenances et publications. Le compte de migration doit pouvoir créer et attribuer ce rôle, comme le compte PostgreSQL du compose fourni. Les futurs déploiements restent gérés par l’utilisateur. Aucun accès à Unraid ni à Nginx.

La release fonctionnelle 0.3.32 et son digest restent conservés. Après activation des comptes, un retour à la 0.3.32 doit utiliser la sauvegarde de base prise avant migration : cette ancienne application utilise le mot de passe collectif et ignore l’isolation des comptes. Pointer uniquement l’ancienne image sur la base contenant plusieurs foyers privés réexposerait les données de ces foyers.


## Release fonctionnelle de référence — 11 novembre 2026

La version 0.3.32 est conservée comme référence fonctionnelle à la demande de l’utilisateur. Source figée au commit `bab03e3532c923c09da327f70b65b5fcb8fdc7ee`, tag Git `v0.3.32`, release GitHub `https://github.com/throlan/Lapinou-Dish/releases/tag/v0.3.32`. Les futurs développements partent de branches dédiées et utilisent un nouveau numéro applicatif dès qu’ils changent le fonctionnement.

Image de référence `ghcr.io/throlan/lapinou-dish:0.3.32`. Référence exacte `ghcr.io/throlan/lapinou-dish@sha256:defb5b021e29975bbc6ab96576d791d54e3ca622a690082ed33341c6d87301ea`. Les tags `0.3.32` et `v0.3.32` ont été vérifiés sur GHCR. Le digest est conservé dans `docker/rollback-images.json` pour les vérifications de publication. Les retours d’image ne restaurent pas la base de données. Examiner les migrations des versions futures avant tout retour à cette référence.


## Alertes kcal et badges recettes — 0.3.32

Le calendrier signale les dépassements journaliers et hebdomadaires dans l’application, par profil, avec l’écart en kcal. Les alertes sont informatives. Les créneaux manquants et les sous-totaux partiels sont identifiés. Les fiches recettes affichent les kcal par pièce, tranche ou 100 g selon les données disponibles et un badge whey calculé depuis les ingrédients, y compris les préparations maison.

## Portion commune de protéines — 0.3.31

Dans un repas servi en trois parties, si la partie protéinée combine plusieurs types de protéines, ils se partagent une seule portion. Le calcul additionne les fractions des plafonds configurés pour la viande crue, le poisson cru et les œufs, puis conserve les proportions des ingrédients de la recette.

## Portions automatiques par type de service — 0.3.30

Le recalcul se base sur le profil et l’objectif du repas. Les pièces et tranches restent entières. Les grammes s’arrondissent à la dizaine supérieure dans les plafonds. Dans Administration → Assiettes, « Plat mélangé (g servis) » fixe un maximum par personne, à 750 g par défaut. En deux parties, le mélange varie avec le profil et les féculents ajustent en priorité l’accompagnement. En trois parties, la protéine séparée garde sa quantité commune à réglages identiques et les légumes suivent le rapport configuré avec les féculents. Le minimum de 80 g cuits est conservé même si l’objectif calorique est dépassé, sous réserve des plafonds et des unités. Le dépassement est affiché et la saisie manuelle reste possible.

## Rendement des recettes déjà produites — 0.3.29

Le rendement et les ingrédients sont modifiables sans réécrire les lots déjà produits. Quand un changement d’unité, de service, d’équivalence ou de suivi de production implique des références existantes, la recette actuelle est remplacée. Les anciens lots, repas et recettes liées gardent leur fiche de référence, identifiée « ancienne version ». Les nouveaux menus proposent la version actuelle.

## Recalcul des assiettes et recettes préparées — 0.3.28

- Pour un déjeuner ou dîner avec féculents séparés, l’objectif du créneau reste disponible si les autres repas ont entamé le budget quotidien. Le détail signale cet écart. Les ajouts consomment leurs kcal réelles.
- Les accompagnements en grammes s’arrondissent à la dizaine supérieure lorsque les plafonds le permettent. Le détail signale si les 80 g de féculents cuits ne sont pas atteints.
- Une recette liée à un repas préparé reste modifiable pour les ingrédients. Le stock déjà déduit et la structure du rendement sont protégés. Les valeurs nutritionnelles affichées suivent la fiche actuelle.

## Plafonds personnalisés par repas — 0.3.27

Administration → Assiettes permet de fixer, pour chaque personne, les plafonds de viande crue, poisson cru, œufs entiers, féculents servis et légumes servis. Un champ vide reprend le défaut (125 g, 150 g, 3 œufs, 200 g, aucun plafond légumes). À réglages identiques, la part principale de viande, poisson ou œufs est la même quel que soit le budget kcal ; un plafond personnalisé peut la modifier. Le calcul conserve le rapport féculents/légumes en trois parties et applique la première limite atteinte, sans imposer de remplir le budget kcal. Les menus déjà enregistrés ne sont pas réécrits. Migration additive 20261107_person_serving_caps.sql.


## Propositions de portions par repas — 0.3.26

Les proportions d’Administration donnent le point de départ. Les propositions respectent par personne et par repas 125 g crus de viande, 150 g crus de poisson, trois œufs entiers et 200 g servis de féculents. Les plafonds portent sur les ingrédients, y compris dans une préparation maison imbriquée. Le poids cru des ingrédients déjà cuits est reconstitué uniquement si une équivalence est disponible. En deux parties, les féculents absorbent en priorité le budget restant ; en trois parties, les féculents et légumes s’ajustent ensemble selon leur rapport configuré ; quand les féculents atteignent leur plafond, le budget kcal restant est laissé libre. Un plat servi ensemble garde sa composition. Il n’est pas nécessaire de remplir l’enveloppe kcal. Les menus enregistrés ne sont pas recalculés automatiquement.


## Catégories et classement groupé — 0.3.25

Dans Aliments, « + Catégorie » crée un nom réutilisable même sans aliment affecté. La modification groupée par catégorie demande un seul choix pour toute la sélection, existant ou nouveau, sans source. L’aperçu montre les reclassements avant validation et le contrôle de version protège les fiches modifiées entre-temps. Pour les autres champs, les valeurs restent protégées sauf choix explicite. Les outils de revue et d’export sont regroupés ; les actions groupées apparaissent à la sélection.


## Revue du catalogue : masquage et source facultative — 0.3.24

La case de masquage retire aussi les fiches sans estimation dont la saisie est préremplie par la valeur déjà enregistrée. Décoche-la pour les revoir ; les sélections et exclusions restent consultables dans leurs vues dédiées. Le compteur et le CSV de la liste filtrée suivent les filtres actifs. La source est facultative dans la revue, à la demande de l’utilisateur ; l’enregistrement reste explicite et journalisé. L’onglet « Conversions aliments » est retiré. Les règles d’achat existantes ne sont pas modifiées et les anciens conflits de cuisson restent consultables depuis « Compléter le catalogue ».


## Revue du catalogue : sélection et catégories — 0.3.23

Le filtre par catégorie est disponible dans Administration → Compléter le catalogue. La vue initiale montre les fiches avec estimation ; les fiches sans estimation restent accessibles par « Toutes les fiches », « Avec valeur actuelle » ou « Valeur actuelle sans estimation ». Pour éviter la confusion, chaque ligne indique explicitement si une estimation existe ; le chiffre prérempli peut être simplement la valeur actuelle. Cocher une valeur inchangée est refusé immédiatement. Une nouvelle valeur sans source ou mesure personnelle est signalée avec le nom de l'aliment et le curseur se place dans le champ à compléter ; si une sélection devient incomplète ensuite, le message de validation nomme les aliments à corriger. Aucune valeur ou quantité de menu n'est changée automatiquement.

## Revue du catalogue : lignes compactes — 0.3.22

Le bouton « Exclure de cuisson » reste sur la même ligne que la fiche et ses autres actions sur ordinateur. Sur mobile, les valeurs et les boutons disposent de lignes lisibles. La case « Masquer les valeurs actuelles identiques » est alignée sur son libellé. Aucun calcul, filtre ou aliment n'est modifié par cette correction d'affichage.

## Revue du catalogue : exclusions et exports — 0.3.21

Dans Administration → Compléter le catalogue, les exclusions de catégories et d'aliments concernent uniquement la liste de révision du coefficient de cuisson. Elles sont enregistrées par foyer et réversibles via le filtre « Exclues de la cuisson » ou la liste des catégories. Elles ne modifient aucune fiche, recette ni quantité de menu. La liste peut afficher les valeurs actuelles, y compris sans estimation ; le champ de saisie reprend alors la valeur présente. Les lignes dont la valeur non nulle égale l'estimation sont masquées par défaut, avec une case pour les revoir. Le CSV exporte toute la liste filtrée, au-delà de la page affichée, ou uniquement les fiches cochées ; il contient les valeurs actuelles, estimations, sources, liens et exclusions. Une valeur inchangée n'est pas envoyée en validation. Les estimations restent facultatives et aucune valeur n'est appliquée automatiquement. **372 tests locaux réussis.** Aucun accès à Unraid ni Nginx.

## Revue de tout le catalogue dans l'administration — 0.3.20

L'onglet « Catalogue à compléter » liste toutes les fiches présentes, avec recherche, pagination, valeur actuelle, estimation modifiable, source et case à cocher. Le récapitulatif est facultatif ; le bouton de validation vérifie le lot avant d'enregistrer les seules fiches cochées, avec journal et protection contre les changements concurrents. Une valeur existante peut être remplacée volontairement. Limite : 500 fiches par validation ; les fiches non sélectionnées restent intactes. Le déploiement ne remplit rien automatiquement.

Sur l'export local de 1 058 fiches, 513 ont au moins une proposition pour les champs pertinents : 331 coefficients de cuisson, 103 densités, 128 poids de cuillère à café, 130 de cuillère à soupe, 3 poids de pièce et 49 catégories hors Ciqual. Les estimations par famille couvrent 320 des 321 fiches crues/à cuire signalées ; « Jambon cru » reste sans rendement de cuisson proposé. Les 96 liquides à examiner ont une densité indicative. Les autres fiches restent visibles sans valeur inventée ; beaucoup sont déjà cuites ou n'utilisent pas ces conversions. Les masses de pincée et de scoop restent réservées à une mesure du produit. Le filet de poulet propose ×0,75, moyenne arrondie de 0,72 au four et 0,77 poché, conformément au choix utilisateur. Les valeurs par famille portent une incertitude élevée et une méthode explicite ; elles ne remplacent pas une pesée du foyer. Aucune nutrition ou quantité de menu n'est modifiée par les propositions.

Sources méthodologiques : [USDA AH-102](https://www.ars.usda.gov/ARSUserFiles/80400530/pdf/ah102.pdf), [USDA, rendements viandes et volailles](https://www.ars.usda.gov/ARSUserFiles/80400525/articles/icomst2012_meatcookingyield2.pdf), [USDA, équivalences de mesures](https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/methods-and-application-of-food-composition-laboratory/mafcl-site-pages/measurement-conversion-tables). Les propositions exactes antérieures restent prioritaires sur les estimations de famille ; les références hors Ciqual sont classées par leur nom, à vérifier avant application. 368 tests locaux réussis. Aucun accès à Unraid ni Nginx.

## État cru ou cuit des ingrédients — 0.3.19

Chaque ligne d'aliment choisit « Servi cru » (poids inchangé), « Cuit dans cette recette » (quantité crue saisie, coefficient de la fiche aliment) ou « Ajouté déjà cuit » (quantité cuite saisie, poids inchangé). Pour un aliment déjà cuit, choisir sa fiche cuite afin d'obtenir les bonnes valeurs nutritionnelles. Les recettes existantes gardent leur calcul historique, signalé dans l'éditeur, jusqu'à révision explicite. Les parties de service dérivées conservent le choix. Un coefficient utilisé ne peut pas être effacé de la fiche aliment.

Migration additive `20261106_ingredient_cooking_state.sql` : aucun recalcul des quantités de menus enregistrées ni des stocks. Aucun rendement ou nutriment inconnu n'est inventé. 365 tests locaux réussis. Après publication, contrôler un exemple cru et un exemple cuit avec le même aliment, puis un plat à parties séparées. Aucun accès à Unraid ni Nginx ; l'utilisateur gère le déploiement.

## Catalogue : nouveau lot sourcé — 0.3.18

Sur la base 0.3.17, 14 fiches Ciqual supplémentaires ont été examinées dans l'export disponible : 27 mesures USDA, dont 17 propositions sur champs vides, 2 écarts avec des mesures existantes et 8 comparateurs réservés aux formes incertaines. Le parcours de revue existant les présente sans les appliquer. Le pavot déjà renseigné reste inchangé ; le safran, l'estragon, la sarriette et le lin brun exigent une précision avant saisie. [Détail et références](CATALOGUE-SUGGESTIONS.md). Le CSV local compte 1 058 fiches ; celui du lot 0.3.17 en comptait 1 057. Sans les deux fichiers, ne pas identifier arbitrairement la fiche différente. 364 tests locaux réussis. Aucun accès à Unraid ou Nginx.

## Catalogue : propositions sourcées — 0.3.17

Dans Aliments, « Examiner les propositions sourcées » rapproche les références Ciqual exactes et affiche la valeur actuelle, les méthodes et les limites. Une proposition pour un champ vide peut être reportée volontairement dans la saisie, puis enregistrée en lot après aperçu, avec sa provenance par ligne. Les écarts sur valeurs existantes renvoient à la fiche individuelle. Aucun remplissage automatique. [Audit de l’export et conflits](CATALOGUE-SUGGESTIONS.md) : 1 057 fiches inventoriées, 44 examinées en détail, 64 lignes dont 39 écarts pour 38 couples fiche/champ. L’examen des autres références et les pesées du foyer restent à faire.

Base 0.3.16 : [PR #168](https://github.com/throlan/Lapinou-Dish/pull/168), [contrôles et publication réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/42016604589). Aucun accès à Unraid/Nginx.

## Catalogue alimentaire — 0.3.16

Une catégorie alimentaire distincte des catégories de courses, un filtre par catégorie ou champ manquant et une modification groupée de 1 à 250 fiches avec aperçu, source obligatoire, contrôle de version et protection des valeurs existantes sont ajoutés. Le classement initial utilise les codes exacts et sous-groupes du fichier officiel Anses Ciqual 2025 : 3 482 codes couverts, dont les 1 009 aliments Ciqual rapprochés de l'export utilisateur. Les 49 autres fiches restent sans catégorie jusqu'à examen. Aucun coefficient de cuisson, poids de mesure, valeur nutritionnelle ou menu n'est rempli automatiquement. Les propositions de rendement USDA et les 41 fiches crues/sèches/surgelées portant ×1 restent à arbitrer au cas par cas. 362 tests locaux réussis. Publication autorisée par l'utilisateur le 5 novembre 2026 ; contrôle GitHub et GHCR à vérifier.

## Chantier 0.3.15 — scoop de whey

Choix utilisateur : une scoop représente par défaut un doseur de 60 ml ; pour la whey sans pesée ni densité, estimation centrale de 30 g dans la plage annoncée de 25 à 35 g. Une masse de scoop explicitement enregistrée dans la fiche aliment reste prioritaire (dont les 25 g de la whey vanille existante). À défaut, la densité connue ou déduite d'une mesure de volume du même aliment convertit les 60 ml. Une scoop d'un autre aliment sans conversion reste inconnue. La recette, les courses et les stocks utilisent la même règle. Le volume de 60 ml est affiché dans l'éditeur et la fiche aliment ; aucune ancienne valeur n'est réécrite. Les grammes cuits des menus enregistrés ne sont pas recalculés automatiquement.

361 tests locaux réussis, dont les conversions ciblées en nutrition, production et achats. PR [#166](https://github.com/throlan/Lapinou-Dish/pull/166) fusionnée au commit `0eb9293a2a37f81d8f81ce5bd88bc64f13167933`. [Contrôles et publication GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/42011194348). Tags `0.3.15` et `v0.3.15` vérifiés, digest commun `sha256:33d930ad3f6d8768ac98f2be55e84c8c54f4ab307676e6bf5cc743d794f77af7`.

## Chantier 0.3.14 — export du catalogue alimentaire

La page Aliments propose « Exporter tout le catalogue (CSV) ». Le téléchargement couvre toutes les fiches, sans limite de pagination ni filtre de recherche, avec identifiant stable, noms, provenance, valeurs nutritionnelles, coefficient de cuisson, densité, poids des mesures et unité d’achat du foyer sélectionné. Le CSV est en UTF-8 avec séparateur point-virgule. Il ne modifie aucune fiche. L’accès utilise l’authentification habituelle de l’application. L’utilisateur exportera son catalogue depuis son installation et transmettra le fichier pour préparer les recherches documentaires, le classement et l’édition groupée. Aucun accès à Unraid ou Nginx.

358 tests locaux réussis. PR [#164](https://github.com/throlan/Lapinou-Dish/pull/164) fusionnée au commit `187f4607ca21e8659d81c22e27c041c45b2f7fc4`. [Contrôles et publication GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/42005139395). Tags `0.3.14` et `v0.3.14` vérifiés, digest commun `sha256:5de25477f00327f85ea7104077e9c9421acef78591f060c67436e6b180e2542b`.

Suite souhaitée : examiner le fichier réel, définir une taxonomie alimentaire distincte des catégories de courses, rechercher les valeurs manquantes avec provenance et degré de fiabilité, puis proposer une validation groupée avant toute écriture. Une mesure générique ou supposée ne doit pas remplacer une valeur propre au produit.

## Chantier 0.3.13 — cuisson par aliment et repas configurables

La fiche aliment porte désormais le coefficient poids cuit / poids cru. Une migration additive reprend uniquement les valeurs anciennes unanimes ; les contradictions sont visibles dans Administration, avec les recettes concernées. Aucun arbitrage automatique et aucune modification des grammes cuits déjà enregistrés dans les menus ou des stocks historiques. Pour les crevettes citées par l'utilisateur, 176/300 = 0,586667 est un **exemple mesuré**, à saisir dans la fiche correspondante après vérification ; aucune valeur globale n'est imposée. Les ingrédients des recettes et les courses restent en quantités crues. Les conversions entre aliments distincts pour les courses demeurent indépendantes.

Les catégories se règlent par créneau, avec option « Commun au repas » ; pâtisserie commune au petit-déjeuner et individuelle à la collation, entrée et laitage ajoutés, accompagnement/sauce/assaisonnement conservés. Le rôle historique reste en base pour les anciens menus mais ne figure plus dans l'interface d'administration. Les ratios d'assiette de l'administration déterminent les propositions initiales des plats séparés. En dépassement kcal : retirer le dessert entier, puis réduire les féculents séparés par 10 g, garder le plat principal et la viande/poisson. Le burrito à la pièce reste entier, même en dépassement. Les protéines sont seulement informatives. Rééquilibrage **journalier** sur aperçu validé, sans réduction hebdomadaire automatique ; effet sur le compte épargne affiché. Les menus existants conservent leurs quantités jusqu'au clic explicite « Recalculer les portions ». Les adolescents ne sont pas rééquilibrés automatiquement. Les proportions kcal par créneau restent modifiables dans Administration ; aucun nouveau quota d'âge.

356 tests complets locaux réussis, puis contrôle ciblé du plat indivisible et des catégories réussi. Vérification de syntaxe et des différences réussie. PR [#162](https://github.com/throlan/Lapinou-Dish/pull/162) fusionnée au commit `e5ab07d643b17762c129d6cf019fb6699000ce65`. [Contrôles et publication GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/41855028940). Tags `0.3.13` et `v0.3.13` vérifiés, digest commun `sha256:08b1eb241df9d726949143720f8fe96374ce513ee9210cf100b46382abb417d7`. Rendu sur l'installation à confirmer par l'utilisateur. Ne jamais accéder à Unraid ni à Nginx ; l'utilisateur déploie.

## Présentation application téléphone, tablette et PC — 0.3.12

Charte harmonisée avec le logo lapin (aubergine, framboise, violet et bleu), avec fonds plus doux et navigation adaptée : barre latérale sur PC, rail sur tablette, barre basse sur téléphone. L’accueil conserve sept jours et quatre créneaux ; sur téléphone, un sélecteur de jour montre les quatre cartes du jour. Le calendrier propose le même accès par jour sur petit écran. Les cartes des repas, recettes et préparations affichent la photo disponible ou le logo en repli. Les pages Courses & stocks, aliments, recettes, calendrier et administration partagent les mêmes surfaces, champs et accents. Aucun calcul, donnée ni migration modifié.

**353 tests locaux réussis.** Vérification syntaxique du navigateur et contrôle des différences réussis. Le navigateur de contrôle n’a pas pu joindre le serveur local de test dans cet environnement ; vérifier le rendu réel après publication.

## Courses & stocks en onglets — 0.3.11

La page Courses & stocks est répartie en cinq onglets : liste de courses, préparations, stocks, magasins et routines. La période des courses reste visible au-dessus des onglets et pilote également les préparations. Les formulaires et listes restent montés dans la page : changer d’onglet conserve les saisies, les sélections et les rubriques ouvertes. Navigation au clavier par flèches, Début et Fin. Aucun calcul, stock ou schéma de données modifié.

**353 tests locaux réussis.** PR #159 fusionnée au commit `36dc404a107b658c3bf0c89297f9e7e2abab5ee3`. Contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41821597464. Tags `0.3.11` et `v0.3.11` vérifiés, digest commun `sha256:36534f81dc4e4648789f2c7e42104559f4499e59a3fa7cc7edeb02df718b7089`.

## Semaine d’accueil, fiche aliment commune et préparations hors menus — 0.3.10 livrée

L’accueil présente la semaine civile en cours, du lundi au dimanche : sept lignes et quatre créneaux par ligne (petit-déjeuner, déjeuner, collation de l’après-midi, dîner). Les cartes compactes ouvrent les portions par personne. Dans le calendrier, la fiche du repas reste accessible une fois préparé ; elle contient les quantités en lecture seule et les actions de préparation. Les cases du calendrier conservent le titre, l’état et « Dupliquer », sans participants ni total kcal.

La collation du soir n’est plus proposée pour les nouveaux menus. Ses repas historiques restent consultables. La répartition des kcal reste **réglable dans Administration**, sur les quatre créneaux actifs, et doit totaliser 100 %. Réglage choisi actuellement : 20/40/10/30 ; il n’est pas figé dans le calcul. Les données des foyers existants ne sont pas réécrites par la migration des valeurs par défaut.

Une même fiche aliment s’ouvre depuis les courses, le catalogue et les recettes ; elle réunit valeurs nutritionnelles, conversions, unité d’achat, magasin, catégorie et format de paquet. Les préférences de regroupement et d’exclusion liées à la période restent dans la liste de courses.

Une préparation supplémentaire peut être planifiée hors menus. Son lot minimum reste propre à la recette ; ses ingrédients entrent dans les courses à la date prévue. La production virtuelle couvre les menus postérieurs dans la projection, mais ne devient du stock physique qu’à la confirmation explicite. Annuler le lot remet cette préparation en attente et rétablit les ingrédients dans les courses. Migrations additives `20261104_four_meal_defaults.sql` et `20261104_planned_extra_productions.sql`. Les historiques et le calcul de viande/poisson restent inchangés. Aucun accès à Unraid/Nginx.

**353 tests locaux réussis**. PR #157 fusionnée au commit `0db84ae2cb12d0922c9e59ecb11d4662e5af12ad`. Contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41811943655. Tags `0.3.10` et `v0.3.10` vérifiés directement sur GHCR, digest commun `sha256:b46eaf9e3f60e68c5ca35bb06ee1322a1db9176ccf3ddcaa2c92ff2aa4c5314a`.

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

# Féculents des recettes composées — 0.3.5 livrée

Après la livraison 0.3.4, la ligne « Féculents » d’une recette composée était encore traitée comme un accompagnement individuel lors de la proposition automatique. Elle recevait 1 g par défaut, restait hors du calcul des proportions de l’assiette et pouvait être perdue au recalcul. Le formulaire 0.3.5 traite les parties liées comme des composants d’un même plat pour leur affichage, leur calcul par personne et leur enregistrement. Les accompagnements ajoutés séparément restent des choix individuels. Un repas déjà enregistré avec 1 g doit être ouvert et recalculé par l’utilisateur ; ses quantités ne sont pas réécrites silencieusement. Les cartes d’ingrédients retrouvent un fond et des libellés lisibles dans le thème clair. Aucun changement du calcul de viande/poisson. PR #146 fusionnée au commit `86c220c9676cb69c80a85ae68a07edaad704965c` ; contrôles et publication : https://github.com/throlan/Lapinou-Dish/actions/runs/41210728818.

# Parties liées des recettes au calendrier — 0.3.4 livrée

Les parties générées d’une recette composée (protéines, légumes, féculents) sont identifiées dans l’éditeur comme des composants liés à la recette. Elles ne sont plus proposées comme des recettes indépendantes. Leurs quantités par personne restent modifiables.

Le mode trois parties peut devenir deux parties en réaffectant les ingrédients : légumes et protéines ensemble, féculents à part. Une partie retirée est archivée au lieu d’être supprimée ; les menus déjà planifiés et références de stock gardent leur recette et leurs ingrédients historiques. Les nouveaux menus n’expansent que les parties actives. Si la partie est réactivée plus tard, une nouvelle identité est créée pour ne pas réécrire l’ancienne partie historique.

L’utilisateur a demandé de laisser en attente la règle qui devrait augmenter la viande/poisson selon un objectif moyen de 125 g par portion : aucun changement du calcul de quantité de viande n’est demandé pour le moment. Retirer un composant lié retire la recette composée entière du repas. Migration `20261031_archived_serving_parts.sql`. **328 tests complets locaux réussis.** PR #144 fusionnée au commit `79c790dd6f564157410d2020007d5bdcc44c4560`. Tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41208298921. Aucun accès à Unraid/Nginx.

# Cahier de reprise — 29 octobre 2026, lots minimums de production

## Fonction livrée — administration et lots minimums par recette, 0.3.3

PR #142 fusionnée au commit `f997a39eb1a23d12e276e8ac5b815036d77f2421`. L’administration se parcourt par sept onglets accessibles au clavier. À son ouverture, ses types de production sont chargés et rendus avant qu’on puisse les modifier, corrigeant l’erreur `invalid-production-types` lors de l’ajout du premier type.

Les types ne définissent plus le minimum de lot : ils classent seulement les préparations. Chaque recette possède son minimum et son unité, convertis avec son rendement/équivalences, puis appliqués aux ingrédients, aux préparations à faire et au surplus de stock. Exemple : un pain de 350 g équivalent à 1 pain et 10 tranches peut avoir un lot minimum de 1 pain ; bagels 24 pièces et pancakes 36 pièces se configurent indépendamment. La migration reprend l’ancien minimum commun si une seule recette racine était concernée ; si plusieurs recettes partageaient le type, elle laisse leurs nouveaux minima à zéro pour éviter une hypothèse trompeuse. **324 tests locaux réussis.** Publication GHCR réussie : https://github.com/throlan/Lapinou-Dish/actions/runs/40905467035 ; image `ghcr.io/throlan/lapinou-dish:0.3.3`, digest `sha256:dc2ec2fafaf286712f99a4b1dd4e3fd17326e5e05ae9bf6ff1d8debff5026a73`. Aucun accès à Unraid/Nginx.

## Fonction livrée — catégories personnalisées au calendrier, 0.3.2

PR #140 fusionnée au commit `d17030f18ba4546334cf78b6e116b1f1c4863baf`. Une recette de type personnalisé apparaît sous sa catégorie configurée même si celle-ci utilise un rôle standard, par exemple Assaisonnement lié au rôle Sauce. Ce rôle ne force plus les recettes personnalisées à 30 g : elles démarrent à une unité. La catégorie et le rôle ne créent pas de doublon de recette ; des catégories distinctes configurées sur un créneau gardent leurs boutons respectifs. **321 tests locaux et contrôles GitHub réussis.** Publication GHCR vérifiée : https://github.com/throlan/Lapinou-Dish/actions/runs/40858994728 ; image `ghcr.io/throlan/lapinou-dish:0.3.2`, digest `sha256:09d71fc82d9e6862f7a982bdeb5b3d6cdb84a6e9cbeed24cc02661733a25ee5a`. Aucun accès à Unraid/Nginx.

## Fonction livrée — types de production et lots minimums, 0.3.1

Version livrée : **0.3.1**. Administration permet d’ajouter des types de production personnalisés, de les affecter à des recettes et de définir un minimum par type avec son unité (pièces, tranches, portions, g ou ml). Le besoin des menus et le stock réservé déterminent si une fabrication est nécessaire ; si un manque subsiste, la quantité planifiée atteint au moins le minimum. Les ingrédients de la fabrication complète sont inclus dans les courses et le surplus réserve les menus suivants. Après enregistrement d’un lot, le stock de production réel évite les achats et fabrications en double. Une unité minimum doit être définie par le rendement ou les équivalences de toutes les recettes assignées au type ; l’enregistrement la refuse sinon. Sans minimum, le comportement reste inchangé.

Exemple validé en test : un burger utilise un bagel, quatre burgers demandent quatre bagels ; minimum 24 pièces → liste de courses pour les ingrédients de 24 bagels ; après fabrication, le stock disponible est 20 pour ces quatre menus et couvre une prochaine commande de quatre sans nouvelle production. « Productions à suivre » a des types supplémentaires configurables, et l’ajout de productions indépendantes des menus reste disponible via la production supplémentaire existante.

Correctif du calendrier : les catégories configurées du foyer sont maintenant rechargées avec les données de la semaine, afin que leurs boutons d’ajout apparaissent dès l’ouverture du calendrier, sans passage préalable par l’administration.

PR #138 fusionnée au commit `351de3a47b82328efeb301923bb089c38f8970c9` ; 319 tests locaux et tests GitHub réussis. Publication GHCR réussie : https://github.com/throlan/Lapinou-Dish/actions/runs/40856567306. Image `ghcr.io/throlan/lapinou-dish:0.3.1`, digest `sha256:a9c9548561fdfddc3a785fd3857ab6d753d33d60ade91f53318e10ac6285b0bf`.

## Fonction livrée — catégories configurables et choix individuels, 0.3.0

PR #137 fusionnée au commit `5349f9b407400d44b6a0376ffb8f787a48b6883d`; contrôles et publication réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/40849807550. **315 tests locaux réussis** à cette livraison.

Administration configure les ajouts complémentaires par créneau, leur type de recette et leur rôle connu (accompagnement, boisson, sauce ou dessert). Les types personnalisés sont proposés dans les fiches recettes et les filtres. Le plat principal reste commun. Chaque ajout complémentaire est propre à chaque personne ; « Aucun » ou quantité 0 signifie qu’elle n’en prend pas. Les quantités nulles ne sont pas enregistrées ni ajoutées aux courses. Les repas et quantités historiques restent conservés. Migration ajoutant `households.meal_additions` et `planned_meal_items.category_id` ; les anciens rôles sont repris comme catégories.

## Archive de la reprise du 29 octobre

## Travail courant — catégories configurables et choix individuels

Version précédente : **0.3.0**. Administration configure les ajouts complémentaires par créneau, leur type de recette et leur rôle connu (accompagnement, boisson, sauce ou dessert). Les types personnalisés sont proposés dans les fiches recettes et les filtres. Le plat principal reste commun. Chaque ajout complémentaire est propre à chaque personne ; « Aucun » ou quantité 0 signifie qu’elle n’en prend pas. Ces quantités nulles ne sont pas enregistrées ni ajoutées aux courses. Les repas et quantités historiques restent conservés. Migration ajoutant `households.meal_additions` et `planned_meal_items.category_id` ; les anciens rôles sont repris comme catégories.

315 tests complets locaux réussis à l’époque. Aucun accès à Unraid/Nginx. PR #137 est depuis fusionnée et publiée.

## Publication : versions numérotées et retour arrière

Livraison précédente vérifiée : **0.3.9**. PR #155 fusionnée au commit `571d72bab17c4970f838a6799234e95d40495077` ; contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41302800569. Tags `0.3.9` et `v0.3.9` vérifiés, digest commun `sha256:bf2735d821b157d05562fbc6d9ed28e3ead111e4de5bb12d92640a38b678ea32`. Les cinq versions 0.3.5 à 0.3.9 sont présentes ; les digests antérieurs sont conservés. Conservation des versions numérotées sans purge automatique, au minimum les cinq dernières ; une republication documentaire ne remplace pas l’image numérotée. Voir [ROLLBACK.md](ROLLBACK.md).

Pour revenir à la 0.2.97 : ghcr.io/throlan/lapinou-dish:0.2.97. La 0.2.98 reste identifiée comme défectueuse au démarrage. Aucun changement de migration entre 0.2.97 et 0.2.99 ; une ancienne image ne restaure pas les données. Ne jamais supprimer les volumes pour changer de version. Aucun accès à Unraid/Nginx.

**314 tests complets locaux réussis**, dont tests du script (alias exacts, idempotence, conservation, erreurs/conflits sans écrasement). Livraison vérifiée : PR #135 fusionnée au commit 7af9a023c961637f780157b6665d31110d22be28 ; tests et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39991969857 . Les dix tags numériques/v des versions 0.2.95 à 0.2.99 ont été vérifiés directement dans GHCR et correspondent aux digests des images d’origine.


## Correctif de démarrage — 0.2.99

Cause reproduite sur le code 0.2.98 : app.js importe food-pagination.js, ajouté pour la pagination du catalogue, mais ce module n’était pas inscrit dans la liste des ressources statiques du serveur. GET /food-pagination.js renvoyait 404 avec un contenu JSON. Le navigateur ne pouvait donc pas exécuter app.js : connexion et tableau de bord restaient au chargement, sans gestionnaires utilisables sur les boutons.

Correction minimale : servir explicitement /food-pagination.js avec le type JavaScript, sans authentification préalable, comme les autres modules de démarrage. Version et clés de cache passent en 0.2.99. Aucun changement métier, calcul, pagination, donnée ou migration.

Un nouveau test parcourt les points d’entrée module du HTML et leurs dépendances locales via le vrai gestionnaire HTTP, avant connexion, avec contrôle du statut et du type MIME. Il échoue sur la 0.2.98 avec /food-pagination.js : 404, puis passe après correction. **311 tests complets locaux réussis**. Validation Chrome locale sur base fictive : connexion initiale et rechargement connecté, tableau de bord rempli, navigation sur les sept pages à 1440/1280/900/390/320 px, pagination haute/basse (25 puis 250 sélectionnés, 87 aliments fictifs), ouverture de la fiche aliment. Aucune erreur JS/HTTP ou ressource manquante ni débordement horizontal. Aucun appareil physique ou accès à l’installation. Dernière version publiée vérifiée avant ce correctif : 0.2.98, documentation PR #133, commit 6547d6a, workflow réussi https://github.com/throlan/Lapinou-Dish/actions/runs/39978043811 . Vérifier la publication du commit fusionné 0.2.99 avant d’annoncer la livraison. Aucun accès à Unraid/Nginx ; l’utilisateur déploie lui-même.

Les chapitres suivants archivent les livraisons précédentes ; la référence courante est **0.3.10**, décrite en tête de document.

## Dernière version livrée — 0.2.98

La nouvelle pagination du catalogue ajoute Précédent/Suivant au-dessus et au-dessous de la liste et le choix de 25/50/100/150/200/250 produits. Le serveur plafonne aussi à 250. Les suppressions simples et groupées gardent la page ; si elle devient vide après suppression, l’affichage se place sur la dernière page valide. Les lignes du catalogue sont compactées sur ordinateur : aliment, recettes liées, provenance, valeurs nutritionnelles et boutons sont alignés sur une ligne, avec boutons moins hauts et noms longs accessibles au survol.

PR #132 fusionnée au commit `be007ef6b030bf22f800cbb703117227b9d2e578`. **310 tests complets réussis**, puis **30 tests ciblés catalogue/API** après la dernière retouche d’affichage. Contrôles et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39977314240. L’utilisateur gère le déploiement ; aucun accès à Unraid/Nginx.

## Dernière version livrée — 0.2.97

PR #130 fusionnée au commit `5d90528e2dd26f3b836221959be9a86379988231`. **308 tests locaux réussis** ; contrôles GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39966604840. Les conversions de rendement administrables, les courses en sens inverse, la table catalogue sans scrollbar imbriquée et la suppression groupée avec aperçu/protection sont livrées. L’utilisateur gère son déploiement ; aucun accès à Unraid ou Nginx.

## Fonction livrée — 0.2.97

La page Administration ajoute des conversions de rendement propres au foyer : aliment de départ → aliment obtenu, facteur en grammes obtenus par gramme de départ. La règle alimente les choix de coefficient de cuisson uniquement sur l’ingrédient de départ concerné ; les coefficients déjà sauvegardés ne sont pas modifiés. Pour les courses, une ligne de recette utilisant l’aliment obtenu peut être convertie en sens inverse vers l’aliment de départ. Une préférence explicite « Acheter sous… » prend la priorité. Exemple : 1 g sec → 1,25 g égoutté ; 250 g égouttés donnent 200 g secs. Ne pas appliquer une même valeur à des aliments différents sans conversion explicitement enregistrée.

Dans le catalogue alimentaire, la table n’est plus enfermée dans une zone de défilement interne. La pagination existante reste en place. La sélection groupée permet la page actuelle ou tous les résultats du filtre courant, puis affiche un aperçu des fiches supprimables/protégées. Seules les fiches inutilisées sélectionnées sont supprimées ; les recettes, stocks, regroupements d’achat et conversions les protègent. Le serveur recontrôle les références au moment de la suppression.

La base de cette modification était 0.2.96 / PR #129. La 0.2.97 est maintenant sur `origin/main` et vérifiée côté GitHub/GHCR. Au prochain redémarrage, vérifier le nouvel état Git et ces documents avant tout changement. Jamais d’accès à Unraid ni Nginx ; l’utilisateur déploie lui-même.

## Dernière modification en préparation — 0.2.96

Dans le catalogue **Aliments**, la fiche modifiable permet de régler l’unité d’achat habituelle du foyer (libellé singulier/pluriel, quantité et unité par sachet/paquet, note). Exemple : l’aliment reste en cuillères à café dans les recettes ; renseigner 2 g par cuillère et un sachet de 500 g affiche les sachets nécessaires dans les courses. Les équivalences entre aliments cuits et secs restent des regroupements explicites dans les préférences d’achat : ex. pois chiches cuits égouttés → pois chiches secs, coefficient 0,8. Les recettes, leur nutrition et leurs ingrédients restent inchangés. Catalogue dédié Aliments, édition complète et suppression protégée déjà disponibles ; aucun remplacement de cette page n’est à refaire. Version `package.json` : 0.2.96. **306 tests locaux réussis**, dont conversions cuillères/sachets et pois chiches cuits/secs. Branche de travail basée sur origin/main au commit 75761384252b13d7a5e25e20496b07d9c85506d3 (PR #128). PR et publication GHCR de la 0.2.96 à vérifier après livraison.

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

## Version et publication vérifiées

- Dépôt : https://github.com/throlan/Lapinou-Dish ; branche de référence : `origin/main`.
- Version du code : **0.2.91** : publication Instagram intégrable dans Cuisiner depuis le lien source, à la demande, puis webapp installable (manifeste, icônes et guide) sur la refonte visuelle claire Magazine culinaire · Encre framboise, responsive PC/tablette/mobile, sans changement métier. La 0.2.88 conserve la saisie des achats et du stock compté dans l’unité d’achat (œufs, pots, paquets…), conversion unique vers l’unité de stock. Regroupements et exclusions de la 0.2.87 conservés. Le calcul 0.2.86 reste fondé sur la **base fonctionnelle validée 0.2.83**, sans les calculs abandonnés 0.2.84/85.
- Dernière publication applicative vérifiée avant ce chantier : **0.2.91**, PR #122, commit c3bf80e, [contrôles et GHCR réussis](https://github.com/throlan/Lapinou-Dish/actions/runs/39129593328). La présente mise à jour ne change que les documents et conserve la version applicative.
- Validation 0.2.91 : **298 tests locaux réussis**. Lecteur testé sur publication fictive interceptée : chargement seulement au clic, arrêt au masquage/fermeture/Escape et aucune incrustation sans source Instagram compatible. Lecture d’une publication réelle non confirmée ; dépend des autorisations et restrictions Instagram. Chrome local : manifeste sans erreur et aucun motif de non-installabilité ; bouton natif proposé dans le profil jetable. Pas de service worker ni de nouvelle couche de cache hors ligne. Parcours des sept pages dans Chrome local sur base fictive PGlite, largeurs 1440, 1280, 900, 390 et 320 px ; fiches repas/aliment/cuisine et éditeur de recette, navigation mobile et absence de débordement horizontal vérifiés. Impression existante conservée ; tests par émulation de viewport, pas sur appareils physiques.
- Références : [état](STATUS.md), [prochaines tâches](TODO.md), [produit](PRODUCT.md), [améliorations](AMELIORATIONS.md), [journal du 23 octobre](SESSION-2026-10-23.md).

## Interdiction d'accès à l'installation

**Ne jamais accéder à Unraid ni à Nginx, même pour lire, vérifier ou diagnostiquer. L'utilisateur effectue seul le déploiement.** Le périmètre de l'agent couvre le dépôt local, les tests sur données fictives, GitHub et la vérification des publications GHCR.

## Reprendre sur un autre PC

1. Retrouver le dépôt par son remote GitHub ; le chemin local dépend du PC. Ne pas confondre avec les anciens dossiers Norish ni supposer que le chemin de la session précédente existe encore.
2. Lire les éventuels `AGENTS.md`. Examiner l'état Git, la branche, les derniers commits et **tous les stashes**. Préserver les modifications, branches et stashes existants ; aucune réapplication automatique d'un ancien chantier.
3. Récupérer `origin/main` sans écrasement. Sur un main propre, avancer seulement en fast-forward ; sinon inspecter et isoler le travail avant de changer de base. Aucun reset destructif ni nettoyage forcé.
4. Vérifier GitHub, `package.json` et les documents liés ci-dessus. Le dernier journal est `SESSION-2026-10-23.md` ; les précédents sont historiques.
5. Faire un état bref et proposer les prochaines étapes ; **attendre la demande de l'utilisateur avant une nouvelle modification fonctionnelle**.

## Décisions de périmètre récentes

- Comptes individuels reportés explicitement après discussion du projet communautaire/hébergé ; aucune implémentation commencée et aucun modèle de droits validé.
- Une seule collation proposée pour les nouveaux menus, l’après-midi ; transition de l’interface livrée en 0.3.10. Les anciennes collations du soir et leurs quantités restent consultables.
- La recherche nutritionnelle n’a pas changé les pourcentages ni ajouté de quotas selon l’âge. Ne pas prendre un repère de discussion pour un réglage validé.

## Dernières fonctions à ne pas refaire

- PR #92 : duplication d'aliment et diagnostic du stockage des images. Photos personnelles et génération IA existent déjà, avec dossier configurable `RECIPE_IMAGE_DIR` et repli PostgreSQL. Le diagnostic décrit le stockage utilisé par l'application ; l'agent ne vérifie pas l'hôte.
- PR #93 à #95 : recettes liées aux produits des courses, une par ligne, liens ouvrant la recette mère des parties de service.
- PR #96 : filtres de données manquantes, dont nutrition incomplète dans les recettes planifiées depuis le début du mois courant et au-delà, badge des préparations et retour interne.
- PR #97 / 0.2.70 : kcal dans les listes de choix des recettes du calendrier, par pièce/portion ou pour 100 g/ml ; données partielles signalées.
- PR #98 / 0.2.71 : volet fermé « Dans X recettes » sur chaque aliment, liens séparés, zéro explicite et comptage des recettes mères distinctes.
- PR #99 / 0.2.72 : **Salade** et **Sauce**. Le nom demandé est Sauce, pas Vinaigrette. Salades utilisables comme plat ou accompagnement, avec les mêmes services, calculs, courses et stocks. « + Sauce » : 30 g/ml ou une unité par défaut, quantité modifiable par personne, zéro possible, apports inclus et quantité fixe pendant les ajustements automatiques.
- PR #101 / 0.2.73 : plafonnement des suggestions de salade à une portion, couleurs des créneaux et repère kcal comparé sur la semaine.
- PR #102 : apports protéiques quotidiens visibles sous le résumé de chaque jour.
- PR #103 / 0.2.75 : minima protéiques configurables par personne dans Administration.
- PR #104 : calendrier hebdomadaire imprimable en A4 paysage ; seuls les menus et quantités par personne sont imprimés.
- PR #105 / 0.2.76 : version et clés de cache alignées. Tests locaux (219) et publication GHCR réussis.
- PR #107 / 0.2.77 : réglage `RECIPE_IMAGE_DIR=/images` visible dans le template ; sans variable, repli PostgreSQL. Contrôles et publication réussis. L’utilisateur vérifie seul son installation.
- 0.2.78 puis **0.2.79** : Cuisiner utilise les besoins des menus. Depuis la 0.2.79, les services viande-légumes/féculents et viande/légumes/féculents sont calculés indépendamment. Les portions/pièces originales ne sont pas arrondies vers un lot plus grand. Une partie absente ou couverte reste à zéro. Ouverture depuis la recette : rechargement des besoins de la période des courses, aucune proposition de recette complète en repli. Les quantités restent modifiables explicitement.
- **0.2.80** : Hors menus — quantité libre dans la fiche cuisine. Pour une base de 4 portions, 6 portions multiplient tous les ingrédients par 1,5 ; le poids estimé reste un repère. Pour les services séparés, ce mode libre conserve les proportions de la recette source, tandis que Selon les menus garde les quantités indépendantes. Les valeurs sont conservées lors des changements de mode. Une recette hors planning ouvre le mode libre explicitement ; si les besoins des menus sont indisponibles, seule la préparation libre est accessible.
- **0.2.81** : suppression des recettes inutilisées depuis les vignettes et l’éditeur ; indisponible pour une nouvelle recette/copie non enregistrée. Les menus et historiques de production (y compris annulés) protègent la recette et ses parties. Photos en base supprimées avec la recette ; fichiers nettoyés seulement après commit, échec de nettoyage signalé sans prétendre que la suppression en base a échoué.
- **0.2.82** : « + Préparation maison » dans les ingrédients. Rendement natif « tranches » et équivalences par recette de base (ex. 1 pain = 20 tranches). Ne pas inventer un poids de tranche. Les besoins imbriqués sont additionnés avec les menus directs ; seul le manque après stock remonte aux courses et aux fabrications. Une préparation suivie en stock est fabriquée avant l’assemblage du plat ; les sauces non suivies sont faites avec le plat depuis leurs ingrédients. Mouvements de préparations réversibles, sans seconde déduction des matières premières. Cycles et références hors foyer refusés ; les références protègent aussi la suppression. Migration 20261018_recipe_ingredients.sql.
- **0.2.83** : le schéma et le validateur de l’import IA acceptent un rendement en tranches (slice), avec instruction explicite de ne pas le convertir en pains/personnes ni inventer son poids. L’import texte conserve également les tranches. Fiche prête à copier : docs/recettes/pain-de-mie-graines-francine-t110.txt, 20 tranches et huit ingrédients avec quantités fixes. Aucun calcul nutritionnel inventé ; association au catalogue à vérifier dans le brouillon.
- **0.2.86** : moteur de portions et rééquilibrage quotidien restaurés depuis 0.2.83. Le bouton Recalculer applique ensuite un arrondi au plus proche en pièces/tranches selon les équivalences, puis ajuste la partie en grammes pour préserver les kcal proposées. La saisie manuelle compense le delta depuis les quantités précédentes pour la même personne. Aucun forçage des proportions après arrondi, aucun calcul à partir du seul poids des unités, aucun grand bloc d’écarts 0.2.85. Les grammes canoniques alimentent menus/courses/productions. Les anciennes quantités ne sont pas modifiées à l’ouverture.
- **0.2.87** : dans Détails et réglages → Acheter sous… et exclusions, choisir un aliment cible et une équivalence explicite. Le stock, magasin et format du produit cible sont utilisés ; les recettes/nutrition restent distinctes. Addition des besoins avant arrondi, sans doublage du stock. Les exclusions sont permanentes ou propres aux dates exactes de la liste et restent réactivables dans le panneau Regroupements et exclusions, même si la liste est vide. Migration 20261018_shopping_products.sql. Aucun regroupement/exclusion créé automatiquement, notamment pour les blancs d’œufs.
- **0.2.88** : un achat affiché à 26 œufs se saisit comme 26, et non 1300 g. Le comptage existant se fait aussi en œufs, avec équivalence et stock affichés (8 œufs pour 400 g à 50 g/œuf). Même principe pour les règles explicites de pots/unités et les paquets configurés ; le format de paquet reste prioritaire. Les paquets partiellement consommés peuvent être comptés en fractions. Conversion unique lors de l’envoi aux API existantes ; aucun changement du schéma de stock.
- **0.2.89** : charte claire Magazine culinaire · Encre framboise validée par l’utilisateur. Navigation latérale PC, barre haute tablette et navigation basse mobile avec menu Plus. Photos des recettes valorisées, formulaires adaptés et contrastes revus. Tous les champs, réglages et calculs restent conservés ; aucune migration. La feuille originale et son impression A4 restent intactes. La PWA installable est livrée en 0.2.90 ; hors ligne reste distinct.
- **0.2.90** : manifeste stable, ouverture standalone, icônes lapin/cocotte dérivées du logo fourni, bouton Installer l’app (menu Plus sur mobile), invitation native quand disponible et guide iOS/Android/PC. Pas de service worker/cache hors ligne ; API/session et calculs inchangés. Recharger ou rouvrir pour les mises à jour après avoir terminé les saisies. Installation OS physique non effectuée par l’agent.
- **0.2.91** : Cuisiner affiche un volet Publication et vidéo Instagram pour une source HTTPS Instagram de type p/reel/tv. Chargement au clic dans une iframe isolée, lien de repli permanent, lecteur retiré à la fermeture et au masquage. Pas de téléchargement, de scraping, de détection certaine vidéo/photo ni de clé API. Les recettes sans source ou avec une autre source gardent leur fiche habituelle.
- La page Importer dédiée, les vignettes de recettes avec photos, les filtres latéraux et les photos persistantes sont déjà en place.

## Règles métier à préserver

- Catalogue canonique et conversions documentées : inconnu ne signifie jamais zéro. Les besoins kcal des profils sont saisis et datés, sans calcul automatique depuis poids/taille/activité.
- Quatre créneaux actifs et anciennes collations du soir consultables ; répartition modifiable par foyer dans Administration, choix actuel **20/40/10/30 %**, total 100 %. Prévisions au calendrier, aucune saisie de consommation après repas.
- Rendement original, préparation entière en grammes estimés, deux ou trois parties ; aucune pesée obligatoire après cuisson. Proportions en poids indépendantes de la répartition kcal.
- Suggestions plafonnées et modifiables, petit-déjeuner limité automatiquement à deux pièces selon le rendement. Réouverture et duplication préservent les quantités ; recalcul explicite.
- Boissons individuelles fixes, quantité initiale 1 au choix, zéro possible ; desserts communs autorisés au petit-déjeuner et à la collation de l’après-midi. « + Dessert » ouvre le choix individuel dans les repas.
- Rééquilibrage adulte avec aperçu puis application explicite ; mineurs exclus, aperçu périmé refusé. Boissons, desserts individuels et sauces conservés.
- Réserve kcal adulte livrée en 0.2.42 : fenêtre glissante de 30 jours, écarts calculés depuis les menus planifiés, épargne supplémentaire sans double crédit, occasions avec estimation globale hors quotas ordinaires. Le [brouillon de réserve](drafts/ENERGY-RESERVE.md) est une archive, pas une tâche à réappliquer.
- Planifier réserve les stocks sans les consommer physiquement. Productions et repas marqués « Préparé » produisent les mouvements explicites, sans double déduction des ingrédients d'un batch.
- Préparations regroupées par recette mère : Pâtisserie, Pain, Pâtes et Batch cooking par semaine lundi–dimanche. Lien recette et fiche Cuisiner avec rendement ajustable.
- Pas de données personnelles réelles, secrets ou clés API dans Git ni dans les fixtures.

## Vérifier et livrer

Node.js **24+**, dépendances installées depuis `package.json`. Tests :

```powershell
node --experimental-strip-types --test test/*.test.ts test/*.test.mjs
```

`npm test` exécute cette commande. Les tests PGlite appliquent les migrations SQL réelles sur une base jetable. Tester l'interface localement avec des données fictives si elle change.

Après une modification autorisée : branche, tests adaptés, commit/push, PR, contrôles GitHub, fusion puis vérification de publication de l'image. Aucun déploiement sur l'installation. Un échec réseau du shell ne prouve pas une déconnexion du compte GitHub : distinguer réseau local, connexion et état réel des workflows.

## Prompt à copier pour reprendre le projet

```text
Reprends Lapinou Dish depuis https://github.com/throlan/Lapinou-Dish. Retrouve le dépôt local par son remote, préserve modifications, branches et stashes puis récupère origin/main sans écrasement, reset destructif ni clean. Lis AGENTS.md s’il existe, docs/REPRISE.md, STATUS.md, PRODUCT.md, AMELIORATIONS.md, TODO.md, ROLLBACK.md et le journal le plus récent.

Référence de livraison à vérifier : application 0.13.1, icône du conteneur ; fonctions de fiches alimentaires et mesures de contenants 0.13.0 préservées. Vérifie la dernière PR fusionnée, les contrôles/publication GitHub/GHCR et package.json avant de poursuivre. La référence fonctionnelle 0.3.32 reste conservée pour retour arrière, selon ROLLBACK.md.

Préserver les fonctions livrées : comptes et foyers privés, partage, listes réutilisables de variantes, recettes modifiables après production avec protection des historiques, portions selon les réglages Administration, planification multi-dates et copies journée/semaine, stocks et réservations, batch cooking et préparations hors menus, apports selon les choix. Ne pas repartir des anciennes règles de portions ni redévelopper les fonctions livrées.

Nouveaux chantiers documentés mais non développés : menus hebdomadaires par IA, équilibrage automatique des semaines, suggestions pour compléter les créneaux libres selon les kcal restantes par profil, les ratios par repas et les stocks déjà préparés. Exemple : déjeuner et dîner saisis, proposer petit-déjeuner et collation sans modifier les repas existants. Voir les critères en tête de TODO.md et AMELIORATIONS.md. Le nettoyage du catalogue, le filtre des aliments inutilisés et la fusion guidée des doublons sont retirés du périmètre demandé ; la qualité des données reste un sujet distinct.

Images : tags numériques et v depuis package.json, sans écraser une version publiée ; conservation sans purge automatique, au minimum cinq versions. Ne pas modifier les digests historiques de docker/rollback-images.json. Une republication documentaire conserve l’image numérotée. La 0.2.98 est défectueuse ; 0.2.97 reste disponible, mais les versions 0.3.x ont ajouté des migrations : un retour aussi ancien ne doit pas être supposé compatible. Une image ne restaure pas les données ; vérifier les migrations avant tout retour arrière, sans supprimer de volumes.

Fais un bilan bref puis attends ma demande avant toute modification. Jamais d’accès à Unraid ni Nginx, même en lecture : je déploie. Tests locaux fictifs autorisés. Pour les travaux demandés : tests, commit/push, PR, fusion après contrôles réussis, vérification GitHub/GHCR et documentation de reprise.
```
