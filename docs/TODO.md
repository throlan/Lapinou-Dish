# Prochaines tâches — 19 novembre 2026

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


## Livraison 0.17.0 — automatisation du suivi

Implémenté : profil factuel unique, cinq repères nutritionnels calculés et appliqués, cholestérol, actualisation sur nouvelles données et bilan mensuel, disponibilités d’activité, séances réalisées séparées et projection dynamique mensuelle. Les anciennes propositions manuelles ne sont plus le parcours utilisateur. Menus, quantités et stocks conservés. Détails : [ACTIVITE-PROJECTION.md](ACTIVITE-PROJECTION.md).

Restant : validation d’usage par l’utilisateur après son déploiement ; enrichissement éventuel du catalogue d’activités ; connexion aux montres différée. Les autres chantiers précédemment décidés restent à confirmer. Ne pas réintroduire la saisie nutritionnelle personnelle ni le rééquilibrage automatique de la semaine. Les situations médicales hors domaine ne reçoivent pas de cible inventée. Les ajustements des quantités des repas conservent leur aperçu à valider.


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

Version 0.15.0 : cibles kcal et minima protéiques datés, origine, méthode et confirmation explicite, révisions conservées. Administration et Mon compte partagent le formulaire avec aperçu. Les anciennes cibles et les anciens minima sont repris ; les secours par prénom sont matérialisés une seule fois par identifiant à la migration, puis retirés du calcul courant. Calories utilisées par le calendrier, les propositions, le rééquilibrage journalier et la réserve ; protéines indicatives. Aucun menu, quantité ou stock réécrit.

Estimation facultative de maintien : Mifflin–St Jeor simplifiée (1990), poids mesuré et taille datés, âge à la date choisie, paramètre sexué et PAL explicitement sélectionnés (1,4 / 1,6 / 1,8 / 2). Le choix de combiner cette formule et ces repères PAL EFSA est une estimation générale, pas une prescription ni une mesure de dépense. Résultat, entrées et sources reportés dans la méthode uniquement après choix explicite, puis confirmation de la cible. Aucun déficit imposé. Estimation adulte seulement ; âge manquant, mineur ou hors plage 18–78 : saisie personnalisée. Situations médicales particulières, grossesse et allaitement : privilégier une cible professionnelle. Sources : https://pubmed.ncbi.nlm.nih.gov/2305711/ et https://www.efsa.europa.eu/sites/default/files/assets/DRV_Summary_tables_jan_17.pdf .

Bilan mensuel à la date anniversaire de la première pesée, ajustée au dernier jour des mois courts sans décaler les mois suivants. Alerte supplémentaire à ±5 kg du poids mesuré de référence lors de la dernière cible validée. Affichage sur l’accueil et dans le profil ; tendance descriptive, aucun diagnostic de stagnation. Confirmation possible du maintien de la cible. Les pesées récentes insuffisantes sont signalées. Une nouvelle cible est proposée avec aperçu ; aucun changement automatique, aucune modification des repas existants.

Migration additive 20261118_nutrition_goals.sql. La 0.13.1 reste la référence validée sur l’installation de l’utilisateur ; la 0.14.0 et la 0.3.32 restent conservées. Déploiement uniquement par l’utilisateur, aucun accès Unraid/Nginx/base réelle.

Les sections antérieures ci-dessous conservent le contexte de leurs versions. Le prochain lot est celui des préférences, allergies et informations privées ; ne pas recommencer les cibles et l’estimation générale.

## Lots à livrer dans cet ordre

Le lot 1 est livré sur GitHub en 0.14.0 : PR #207 fusionnée, 463 tests locaux, contrôles et publication GHCR réussis. La 0.13.1 demeure la référence validée en production tant que l’utilisateur n’a pas validé la 0.14.0 sur son installation. Le prochain développement est le lot 2.

1. **Profils et objectifs de poids datés.** Calculer l’âge depuis la date de naissance à la date affichée, avec état inconnu si elle manque. Ajouter poids de forme choisi et objectif intermédiaire facultatif, distincts du poids mesuré, avec dates d’effet passées/futures et révisions conservées à date identique. Une version applicable doit être déterministe. Réutiliser Administration et Mon compte ; tester droits des membres, gestionnaires et profils sans compte, isolation entre foyers, anniversaires, valeurs manquantes et migration additive depuis des données fictives de type 0.13.1. Ne pas toucher au moteur de portions dans ce lot. Livrer sous un nouveau numéro ; la 0.13.1 reste la référence de production jusqu’à validation de l’utilisateur.
2. **Objectifs nutritionnels datés.** Brancher les cibles sur les écrans et calculs après migration compatible des réglages kcal/protéines existants. Conserver origine, méthode, date et validation, lever les secours liés au prénom sans modifier silencieusement les cibles. Tester les révisions et les permissions.
3. **Estimation des besoins et validation.** Séparer besoin estimé et cible choisie. Mifflin–St Jeor exige des paramètres explicites ; conserver entrées, méthode, date et validation. Aucun objectif automatique de perte de poids pour mineurs ou âge inconnu. Une estimation ne devient cible qu’après confirmation.
4. **Préférences, allergies et informations facultatives privées.** Droits du compte et du foyer vérifiés côté API et base ; aucune inclusion automatique des informations de santé dans les appels externes.

Ensuite : nutriments plus complets, optimisation déterministe des portions, score de qualité intrinsèque et score d’adéquation personne/repas distincts, puis planification assistée (kcal et stocks pour les créneaux libres, équilibre hebdomadaire, menus hebdomadaires avec aide IA facultative). Les allégations européennes sur les protéines restent distinctes. Un plat principal commun garde les quantités individuelles ; aucun changement de menu sans aperçu et confirmation. Le nettoyage du catalogue, le filtre des inutilisés et la fusion guidée des doublons restent hors feuille de route. Les valeurs inconnues ne deviennent pas zéro ; arbitrer les écarts alimentaires au cas par cas sans application externe automatique.

## Livré en 0.13.0 — fiches alimentaires

Fiche simplifiée, accès direct depuis les calculs incomplets, conditionnement unique, mesures de contenants calculées depuis une mesure/densité connue (5/15/60/240 ml) et pincées non bloquantes sans poids. Les valeurs contradictoires restent à arbitrer personnellement ; aucune recherche ni correction automatique du catalogue réel. Vérifier le rendu et les mesures sur les appareils réels après déploiement.

## Planification assistée — demandes du 15 novembre 2026, non développées

- **Menus automatiques pour la semaine via l’IA** : proposer une semaine de menus à partir des recettes du catalogue, des profils et des réglages du foyer. Présenter les propositions avant leur ajout au calendrier ; conserver les repas déjà saisis.
- **Équilibrage automatique des semaines** : proposer un ajustement de la semaine selon les objectifs de chaque personne. Ce chantier est distinct du rééquilibrage journalier et des alertes hebdomadaires déjà livrés ; ses règles et son aperçu restent à définir avant développement.
- **Compléter une journée selon les kcal restantes** : proposer des recettes et quantités pour les créneaux encore libres, en tenant compte des repas déjà planifiés, du quota journalier de chaque profil, des ratios kcal configurés par repas et des stocks de préparations déjà produits. Exemple demandé : déjeuner et dîner renseignés → suggestions de petit-déjeuner et de collation adaptées au budget restant. Favoriser les stocks disponibles après réservations, sans les compter plusieurs fois ; conserver les plafonds de portions et les variantes choisies. Rendre visibles les écarts et laisser l’utilisateur choisir avant enregistrement.

Ces trois demandes sont inscrites au cahier d’améliorations ; elles ne sont pas encore développées. Leur ordre de réalisation reste à choisir.

Le nettoyage du catalogue, le filtre des aliments inutilisés et la fusion guidée des doublons sont retirés des chantiers à prévoir à la demande de l’utilisateur. Les outils du catalogue déjà livrés restent disponibles ; la fiabilisation des données nutritionnelles, conversions et mesures personnelles reste un sujet distinct.

## À vérifier après déploiement — 0.12.0

Comparer les protéines sur les vraies recettes depuis Apports selon les choix, vérifier le batch avec des préparations hors menus sur la semaine retenue et actualiser les repas utilisant une ancienne recette après contrôle des unités. L’aperçu de l’éditeur porte sur la version enregistrée ; enregistrer les nouvelles quantités avant comparaison. Une unité sans équivalence nécessite une saisie manuelle et un découpage incompatible une reprise dans le calendrier.


## À vérifier après déploiement — 0.11.0

Essayer la sélection mercredi/samedi, la copie d’une journée et d’une semaine sur les appareils réels. Les copies gardent les quantités ; elles ne sont pas recalculées selon les profils futurs. Les données changées par une autre session peuvent attendre au plus une minute avant actualisation lors de la navigation. Aucun écrasement des créneaux occupés. Les semaines proposées pour planifier sont relatives à aujourd’hui ; les périodes de Cuisiner restent ancrées sur le repas sélectionné, comme en 0.10.0.


## À vérifier après déploiement — 0.10.0

Tester Planifier depuis le catalogue et Cuisiner depuis le calendrier sur les appareils réels. Les créneaux sont proposés selon les moments de la recette ; les compléments restent un choix au moment de planifier. Semaine/deux semaines/mois sont explicitement ancrés sur la date du repas sélectionné, sans changer la période des courses. Les recettes sans suivi de stock conservent ce réglage.


## Après déploiement des recettes modulables — 0.9.0

Vérifier les listes et les choix sur les appareils réels. Configurer progressivement les recettes existantes (ex. flan saveur/topping et bowl légumineuse/protéine) ; aucune fusion ni conversion automatique du catalogue. Les quantités de chaque nouvelle option sont à vérifier pour la recette de base. Les préparations maison restent des ingrédients liés existants ; les nouvelles listes de choix portent sur des aliments du catalogue.


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
2. **Comptes individuels et foyers — livrés** : ne pas redévelopper les comptes et droits existants. Les invitations par courriel et la récupération autonome du mot de passe restent à traiter.
3. **Correction des données nutritionnelles** : les filtres et badges existent. Améliorer l'explication des causes de calcul incomplet et l'accès aux ingrédients/conversions à corriger ; définir les critères avant développement.
4. **Communauté publique** : cadrer bibliothèque volontaire, droits et attribution des images/recettes, modération et isolation des données privées avant toute ouverture.

Détails dans [AMELIORATIONS.md](AMELIORATIONS.md). Les listes réutilisables de variantes et les photos en mode cuisine sont déjà livrées. Les nouvelles demandes de planification assistée figurent en tête de ce document.

## Décisions récentes à conserver

- Les comptes et foyers sont livrés ; les nouvelles pistes restent à choisir, sans lancement automatique.
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
