# Déficit calorique : choix, sources et limites

## Règle validée le 19 novembre 2026 — 0.17.1

L’utilisateur a choisi quatre niveaux : perte rapide 30 %, perte modérée 20 %, perte lente 10 %, maintien 0 %. Le plafond du déficit alimentaire calculé est fixé à 750 kcal/j. Ce sont des réglages de l’application explicitement validés, pas quatre catégories médicales normalisées ni des vitesses de perte garanties.

Le maintien M reste estimé par la formule documentée Mifflin–St Jeor × activité habituelle. Pour une perte de poids : déficit demandé = min(M × taux choisi, 750) ; apport appliqué = ceil(M − déficit demandé), en kcal entières. Le déficit effectif affiché est M − apport appliqué. Arrondir l’apport vers le haut évite de dépasser le plafond ou le taux choisi, même d’une kcal. Le maintien utilise M sans déficit. Le bilan et la projection utilisent l’apport réellement appliqué, pas un déficit théorique non respecté par l’arrondi.

| Choix | Taux | Maintien d’exemple | Déficit effectif | Apport |
|---|---:|---:|---:|---:|
| Rapide | 30 % | 2 500 | 750 | 1 750 |
| Modérée | 20 % | 2 500 | 500 | 2 000 |
| Lente | 10 % | 2 500 | 250 | 2 250 |
| Maintien | 0 % | 2 500 | 0 | 2 500 |
| Rapide plafonnée | 30 % | 3 000 | 750 | 2 250 |

Les profils existants sans choix gardent le niveau modéré (20 %), avec le nouveau plafond validé. Aucun passage implicite au mode rapide. Le choix est conservé avec les faits privés du profil ; les cibles et leur modèle sont historisés. À l’objectif (bande de 0,5 kg), le calcul revient au maintien. Un objectif personnel situé au-dessus du poids actuel ne déclenche pas une prise de poids automatique dans ce parcours de perte/maintien.

Le plafond porte sur la réduction alimentaire par rapport au maintien de base. L’activité supplémentaire simulée reste distincte : elle peut produire un écart énergétique total supérieur à ce seul plafond alimentaire. Aucune calorie de séance n’est automatiquement ajoutée aux apports. Le seuil des apports trop bas, les restrictions d’âge et les conflits médicaux restent prioritaires ; le plafond de 750 ne garantit pas à lui seul une cible adaptée.

## Ce qui est réellement documenté

[ADA 2026, chapitre 8, recommandations 8.8a et 8.9](https://diabetesjournals.org/care/article/49/Supplement_1/S166/163915/8-Obesity-and-Weight-Management-for-the-Prevention) : interventions nutrition/activité/comportement avec accompagnement fréquent pour viser un déficit de 500–750 kcal/j chez des adultes avec diabète de type 2 et surpoids/obésité, et individualisation des recommandations nutritionnelles. Cette plage n’est pas un plafond universel de sécurité ni une consigne propre aux personnes opérées d’un bypass. La règle du programme n’est pas un équivalent automatique de cet accompagnement.

[Recommandations européennes EASO de 2015, section alimentation, page 410](https://easo.org/wp-content/uploads/2018/12/2015-OMTF-European-Guidelines-for-Obesity-Management.pdf) : réduction de 15–30 % par rapport aux apports habituels d’une personne au poids stable, avec adaptation individuelle. Il s’agit d’un document ancien et d’une plage générale : il ne définit pas les trois niveaux retenus ici. Le niveau lent de 10 % est un choix applicatif inférieur à cette plage. Appliquer un pourcentage à un maintien estimé suppose que cette estimation représente correctement le maintien réel ; ce n’est pas une mesure des apports habituels.

[NICE NG246, recommandations 1.16.1, 1.16.3 et 1.16.5](https://www.nice.org.uk/guidance/ng246/chapter/Physical-activity-and-diet) : approche individualisée, déficit énergétique et accompagnement/suivi, sans imposer notre combinaison de pourcentages et de plafond. Les comorbidités font partie de l’adaptation.

Ces sources permettent d’expliquer le contexte et les limites des réglages. Elles ne prouvent pas que 30/20/10 % soit optimal pour une personne donnée. Le poids réellement suivi sert à réexaminer les estimations ; une stagnation ne démontre pas à elle seule que les apports doivent être abaissés.

## Origine de l’ancienne règle 0.17.0

La combinaison initiale de 20 % plafonnés à 500 kcal/j a été choisie lors de l’implémentation pour associer une réduction proportionnelle et une limite absolue. Elle n’a pas été dérivée d’une formule personnalisée ni d’une recommandation prescrivant exactement cette combinaison. Les sources citées ci-dessus ne doivent pas être présentées comme une justification rétrospective de ce choix initial. Le défaut de justification a été expliqué à l’utilisateur avant la validation des nouveaux réglages.

Le modèle profile-auto-v3 remplace cette combinaison par les niveaux et le plafond désormais choisis. Les autres allocations nutritionnelles ne sont pas modifiées dans cette correction. Aucun menu, stock ou quantité déjà enregistrée n’est réécrit.
