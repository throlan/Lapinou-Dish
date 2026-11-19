# Profils automatiques et projection d’activité — 0.17.0

## Parcours retenu le 19 novembre 2026

L’utilisateur renseigne des faits, ses objectifs de poids et son temps disponible. Il ne choisit plus de calories, de protéines, de pourcentages nutritionnels ni de formule. Enregistrer le profil active le mode automatique pour cette personne. Les anciens profils gardent leurs cibles tant que ce parcours n’a pas été renseigné. Les valeurs calculées ont une date d’effet et une provenance ; les versions précédentes restent conservées.

Les nouvelles données de profil/pesée/objectif déclenchent le calcul, de même que la consultation après anniversaire mensuel de la première pesée (dernier jour des mois courts). Il s’agit d’un recalcul depuis les faits disponibles, pas d’une réduction punitive des calories en cas de stagnation. Il n’y a pas de tâche de fond quotidienne ni de déduction d’activité à partir d’un journal vide. Les menus déjà saisis et les stocks gardent leurs quantités. Le rééquilibrage des portions conserve son aperçu volontaire.

## Repères nutritionnels

Mifflin–St Jeor simplifiée : repos = 10 × kg + 6,25 × cm − 5 × âge + constante (+5 masculin, −161 féminin). Maintien = repos × activité habituelle (PAL 1,4 / 1,6 / 1,8 / 2). Âge, taille et poids applicables à la date consultée. Référence formule : https://pubmed.ncbi.nlm.nih.gov/2305711/ ; repères PAL : https://www.efsa.europa.eu/sites/default/files/assets/DRV_Summary_tables_jan_17.pdf .

La direction est déduite du poids de forme choisi, avec une bande de maintien de ±0,5 kg ; atteindre un objectif intermédiaire ne doit pas inverser cette direction. Ajustement de 20 % du maintien plafonné à 500 kcal/j, soustrait pour perdre, ajouté pour gagner, cible arrondie à 10 kcal. **Ce réglage est une stratégie d’application**, pas un déficit prescrit spécifiquement par une recommandation de diabète ou de chirurgie. Le calcul n’est pas calibré pour retrouver artificiellement l’ancienne cible personnelle à 1 750 kcal.

Minimum de référence protéique général : plafond entier de 0,83 g/kg de poids mesuré (EFSA https://doi.org/10.2903/j.efsa.2012.2557). Après chirurgie ancienne admissible : max(60 g, 1,1 g × poids de référence Lorentz), selon HAS R98, source conservée dans NUTRITION-RECOMMANDATIONS.md. Lorentz dépend de la taille et du paramètre sexué, pas du poids souhaité. Le repère de répartition applicatif réserve 20 % des calories aux protéines si supérieur à ce minimum ; ce n’est pas un besoin médical mesuré. Les protéines restent une information du planning, pas un objectif de rééquilibrage imposé.

Glucides : 45 % de l’énergie (4 kcal/g) ; lipides par différence après protéines et glucides (9 kcal/g). Ce sont des règles de répartition applicatives explicites, pas une proportion universelle du diabète. Fibres : minimum de référence 25 g/j (EFSA https://doi.org/10.2903/j.efsa.2010.1462), au moins 14 g/1 000 kcal si diabète de type 2 (ADA https://doi.org/10.2337/dc26-S005). Les arrondis des grammes peuvent créer moins d’une kcal d’écart.

Cholestérol connu : oui/non/inconnu. Si oui, repère de qualité des graisses (remplacer les graisses saturées par des insaturées), source OMS https://www.who.int/publications/i/item/9789240073630 . Pas de prédiction LDL, de traitement ni d’abaissement chiffré arbitraire des calories sur ce seul diagnostic.

Hors domaine : âge inconnu, mineur ou >78 ans ; faits manquants ; objectif de perte sous IMC 18,5 ; cible ≤1 200 kcal/j ; maladie rénale, grossesse/allaitement, hypoglycémies/traitement à risque, dumping ou leurs statuts incertains ; diabète de type 1/inconnu ; chirurgie non précisée, récente (<365 jours) ou sans date. Le système explique le blocage et garde les repères antérieurs, sans fabriquer de prescription.

## Activité prévue et réellement effectuée

Marche tranquille : MET 2,8 (code 17152) ; marche 4 km/h : MET 3 (17170) ; marche soutenue : MET 3,8 (17190). Source primaire : https://pacompendium.com/walking/ . Le journal propose ces trois activités pour commencer ; il ne prétend pas mesurer leur intensité individuelle.

Le programme enregistre minutes/séance et séances/semaine. Le journal enregistre date, type et minutes réellement réalisés, avec annulation conservée. Une clé UUID empêche les doublons après un rejeu réseau. Les sept derniers jours du journal sont totalisés indépendamment du programme. Le programme ne crée pas de séances réalisées ; les séances ne sont pas ajoutées au programme dans la projection.

Dépense nette supplémentaire moyenne : (MET − 1) × 3,5 × kg / 200 × minutes × séances par semaine / 7, seulement si l’activité est déclarée en plus des habitudes. Le repos de ce temps est retranché, et une activité déjà incluse dans le PAL n’est pas ajoutée. Cette moyenne ne devient jamais un crédit de calories alimentaires. Repère OMS adulte 150–300 min modérées/semaine, progression graduelle : https://www.who.int/publications/i/item/9789240015128/ . Pas de connexion Watch/HealthKit dans cette livraison.

## Projection dynamique réduite

Source primaire : annexe Hall/NIDDK, équations 3–9 et table des paramètres : https://www.niddk.nih.gov/-/media/Files/Labs-Branches-Sections/laboratory-biological-modeling/integrative-physiology-section/Hall-Lancet-Web-Appendix_508.pdf . Les pages d’équations ont été rendues et vérifiées visuellement. Ce module est une **réduction à deux compartiments**, pas une reproduction intégrale validée du Body Weight Planner NIDDK.

Unités internes : kJ, kg, jours ; 1 kcal = 4,184 kJ. Compartiments F (masse grasse) et L (reste), masse initiale F estimée par la formule Jackson de l’annexe (âge, sexe, IMC) ; L = poids − F. p = C/(C+F), C = 10,4 × 7 600/39 500. dF/dt = (1−p)(EI−EE)/39 500 ; dL/dt = p(EI−EE)/7 600.

Dépense fermée EE = (K + 13F + 92L + δW + TEF + AT + EI × e)/(1+e), e = p × 960/7 600 + (1−p) × 750/39 500. δ = (0,9 × PAL − 1) × repos / poids initial ; K calibré pour l’équilibre au maintien initial. TEF = 0,1 × variation d’apport ; dAT/dt = (0,14 × variation d’apport − AT)/14 jours. L’activité nette supplémentaire ajoute une dépense proportionnelle au poids évolutif. Intégration Runge–Kutta 4, pas de 0,25 jour.

Hypothèses : cible alimentaire courante constante, disponibilités respectées en moyenne, composition initiale estimée. Eau extracellulaire, variation de glycogène (dG/dt posé à zéro), malabsorption et adaptations cliniques individuelles non modélisées. Les dates sont des mois approximatifs d’un scénario, pas une probabilité ni une promesse. Le modèle est recalculé avec les données ultérieures ; il ne simule pas de futurs changements automatiques de cible non encore connus.

Domaine produit : 19–59 ans pour la projection avec ces MET adultes, cible >1 200 kcal/j, taille 140–230 cm, composition initiale estimée 3–65 % ; arrêt sous IMC 18,5 ou compartiment non positif. Horizon au maximum 1 095 jours. Tableau des douze premières échéances mensuelles, variation de chaque mois et atteinte des objectifs sur trois ans. Si un objectif n’est pas atteint dans le scénario, aucune date n’est inventée. Les fins de mois sont conservées sans dérive ; calculs calendaires en UTC, dates de suivi courantes Europe/Paris côté serveur.

## Confidentialité et retour arrière

Tables privées protégées par API et RLS : personne liée au compte ou gestionnaire de son foyer. Aucun transfert à l’IA ou service de santé tiers. Les sources externes sont des liens à consulter volontairement, sans données personnelles dans leurs paramètres. Migration additive ; un retour d’image ne supprime pas les nouveaux faits ni ne restaure les anciennes cibles. Voir ROLLBACK.md.
