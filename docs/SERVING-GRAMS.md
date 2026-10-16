# Portions en grammes et féculents séparés

Dans une recette, « Portions dans le calendrier » propose quatre modes :

- Proportions du rendement de la recette : conserve l’unité et le rendement d’origine (pièces, portions, etc.).
- Préparation servie ensemble : une seule quantité estimée en grammes par personne. Convient aux lasagnes, gratins ou autres plats mélangés ; ne sépare pas physiquement les ingrédients.
- Viande et légumes ensemble, féculents à part : choisir la partie de chaque ingrédient. Le calendrier crée deux lignes liées au même plat, ajustables indépendamment en grammes.
- Viande, légumes et féculents séparés : affecter les ingrédients à Viande / protéines et sauce, Légumes ou Féculents. Les trois parties sont ajustables indépendamment en grammes. Chaque partie doit contenir au moins un ingrédient.

Le coefficient du plat est ×1 par défaut : somme des poids des ingrédients, sans déduire une perte d'eau ou de graisse à la cuisson. Il est réglable. Pour les féculents, les coefficients demandés sont proposés : riz ×3 ; pâtes sèches et pois chiches ×2,5 ; pâtes fraîches ×1,25 ou ×1,5 ; lentilles vertes/brunes et haricots ×2,4 ou ×2,5 ; lentilles corail et pois cassés ×2,3. Il s'agit d'estimations de poids et pas de mesures après cuisson.

Le coefficient peut aussi être choisi par ingrédient : les pâtes des lasagnes gonflent, mais les autres ingrédients ne doivent pas tous être multipliés par le coefficient des pâtes. Le choix individuel apparaît uniquement pour une ligne sélectionnée comme féculent. En mode préparation entière, choisir « Féculent intégré au plat » pour régler son coefficient sans créer une partie servie séparément. Un coefficient de ligne remplace le coefficient de sa partie. Les ingrédients en ml, cuillères ou pièces nécessitent une conversion en grammes documentée dans leur fiche. Sans conversion, l'enregistrement en grammes est refusé ; aucune densité ou masse n'est inventée.

Les ingrédients gardent leurs quantités et unités d'origine. L'eau absorbée augmente le poids estimé sans ajouter de nutriments. La nutrition de chaque partie est calculée sur ses ingrédients puis répartie selon ses grammes estimés, avec une précision conservée par gramme. Le moteur propose des portions avec les profils existants ; les quantités saisies à la main restent prioritaires et acceptent les décimales.

## Composition de l'assiette

Administration → Composition des assiettes règle des proportions **en poids estimé servi** par foyer, après coefficients de cuisson :

| Mode | Plat / viande-protéines | Féculents | Légumes |
| --- | --- | --- | --- |
| Tout ensemble | 100 % | intégrés | intégrés |
| Deux parties | 70 % viande et légumes | 30 % | intégrés à la viande |
| Trois parties | 25 % viande/protéines | 25 % | 50 % |

Les deux modes séparés sont modifiables ; chaque mode doit totaliser 100 % et chaque partie rester positive. Il s'agit de grammes servis estimés, pas de pourcentages de kcal, de volume ou de protéines nutritionnelles. Une assiette de 400 g en mode trois parties contient par défaut 100 g de viande/protéines, 100 g de féculents et 200 g de légumes. Les ingrédients crus et les coefficients restent ceux de la recette.

Le moteur calcule la densité énergétique de cette composition, puis ajuste son poids global dans le budget du repas et sous les plafonds de chaque partie. L'ajustement protéique conserve les proportions et peut signaler que le repère ne peut pas être atteint. Les grammes peuvent être décimaux pour respecter les pourcentages ; le poids total proposé varie par pas de 10 g. Boissons, desserts et recettes sans parties liées restent indépendants. Si une partie est absente ou répétée, la composition n'est pas appliquée et le calcul le signale.

Les quantités existantes et les copies ne changent pas : utiliser explicitement « Recalculer les portions ». Le rééquilibrage quotidien réduit ensemble les parties liées en conservant leur répartition déjà saisie, même si elle a été modifiée manuellement. Les protections des profils et du repère protéique restent appliquées.

## Conservation des données existantes

Configurer le mode et les coefficients une fois par recette. Aucune classification automatique ne déplace le riz d'un plat existant : les féculents restent mélangés tant que la séparation n'est pas choisie.

Lors de l'activation des grammes, les repas qui utilisaient les portions de cette recette sont convertis proportionnellement, sans rééquilibrage automatique : par exemple 1 portion sur un rendement de 4 devient un quart du poids estimé de chaque partie. Les quantités deviennent ensuite indépendantes. Les duplications copient ces grammes. Pour une recette servie entièrement en une seule partie, repasser aux proportions de la recette reconvertit les repas en fonction du poids estimé du batch et de son rendement d’origine. Les lots de stock liés retrouvent le lot complet en unité d’origine, sans nouvelle déduction des ingrédients. Les préparations déjà marquées comme faites restent verrouillées.

Lors du passage de deux à trois parties, les grammes planifiés et les lots de viande-légumes sont répartis proportionnellement entre viande et légumes selon les poids du batch. La partie féculents garde ses quantités. Cette conversion ne redéduit pas les ingrédients et ne se répète pas à chaque sauvegarde. Les identifiants des parties existantes restent stables.

Les propositions automatiques du plat principal en grammes et des légumes séparés sont plafonnées à la portion moyenne du batch, arrondie vers le bas à 10 g. La saisie manuelle reste libre. Le calendrier général masque les portions détaillées ; elles restent accessibles dans l'éditeur. Voir [les objectifs kcal et le rééquilibrage](MEAL-ENERGY.md).

Les lots existants actifs sont convertis de la même façon, sans déduire à nouveau les ingrédients. Enregistrer un nouveau batch complet crée les stocks de ses parties et déduit les ingrédients une seule fois. Annuler le lot de l'une des parties annule le batch complet et restaure une seule fois les déductions enregistrées. Les courses utilisent les ingrédients crus nécessaires aux grammes planifiés, en tenant compte du stock préparé.

Les parties techniques restent rattachées à la recette et ne créent pas de cartes supplémentaires dans le catalogue. Leurs identifiants restent stables lors d'une modification. Les stocks déjà produits conservent leurs grammes enregistrés ; modifier ensuite une recette ou un coefficient actualise sa nutrition et ses nouveaux rendements, pas rétroactivement les poids des anciens lots. Le mode « Préparation servie ensemble » peut revenir au rendement d’origine avec conversion des repas et des lots. Les modes à plusieurs parties ne peuvent pas être regroupés automatiquement : leur répartition indépendante serait perdue.

## Vérification

Tests PostgreSQL/PGlite : calcul brut→grammes estimés, recette entière sans séparation, précision nutritionnelle, portions indépendantes, duplication, courses, conversions aller-retour des repas et lots en mode préparation entière, déduction unique, annulation de batch et transactions annulées si une conversion manque. Aucun serveur Unraid utilisé.

## Catégories Salade et Sauce — 0.2.72

Une salade conserve les mêmes rendements, modes de service (entier, deux ou trois parties), coefficients, courses et stocks qu’un plat. Changer Plat en Salade ne supprime pas les services existants. La sauce est une recette ajoutée avec une quantité par personne, fixe pendant les ajustements automatiques et incluse dans la nutrition.
