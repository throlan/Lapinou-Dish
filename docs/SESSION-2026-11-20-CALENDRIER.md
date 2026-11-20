# Choix des repas et suivi des apports — 0.18.0

Le bouton « Choisir les repas » du calendrier ouvre les plats principaux du déjeuner et du dîner ainsi que leurs participants. Les créneaux déjà occupés donnent accès à la fiche du repas. Pour les créneaux libres, l’aperçu calcule les portions et propose le petit-déjeuner, la collation, les desserts et les sauces pour les salades, selon les recettes et le budget disponible. Les suggestions sont décochables et la confirmation enregistre la sélection en une transaction.

Le calendrier retire du budget à la maison la part du déjeuner ou du dîner définie dans les réglages si le créneau est planifié sans la personne. Un créneau vide ne signifie pas une absence. Les repères affichés et le rééquilibrage quotidien utilisent cette part. Les glucides et lipides réellement consommés peuvent être renseignés en grammes pour une journée, repas extérieurs compris, et sont comparés aux repères journaliers du profil lorsqu’ils existent.

Migration additive pour les apports saisis. Lecture et écriture réservées à la personne concernée et aux gestionnaires de son foyer. Une ancienne image ignore les données de cette table.

## Sélection dynamique des quatre créneaux — 0.18.2

« Choisir les repas » affiche quatre sélecteurs avec des participants indépendants. Les calories prévues et le solde par personne sont recalculés dans la fenêtre à chaque modification. Les sauces pour les salades et les desserts sont proposés après comptage de tous les repas, avec un choix commun qui doit tenir dans le solde de chaque participant. Le choix d’un complément réduit les options disponibles pour les suivants.

## Parties consommées et stock dans le calendrier — 0.18.3

La confirmation se fait par personne, date et ligne de repas à la maison. Plat, composants, sauce et dessert peuvent être cochés séparément. Une absence au déjeuner laisse les autres créneaux disponibles selon leurs propres participants. Chaque partie cochée conserve la portion planifiée et un instantané de ses glucides et lipides. Une correction peut retirer des parties et en ajouter d’autres. Les parties encore cochées gardent leur instantané après modification de la recette ou retrait du planning. Une correction concurrente impose de rouvrir le relevé. La confirmation nutritionnelle est indépendante du stock.

Le calendrier distingue les grammes prévus, confirmés et les sous-totaux incomplets. Les repères personnalisés en grammes suivent le profil à la date du repas et la part du budget à la maison. La HAS recommande d’adapter les apports à la personne pour le diabète de type 2. Le repère général OMS sur les graisses saturées est de 10 % maximum de l’énergie totale dès deux ans. Le moteur ne calcule pas les graisses saturées, ce qu’indique la fiche de confirmation. Les repères affichés proviennent du profil, sans plafond universel de glucides ni conversion du LDL en plafond de lipides totaux.

Les choix de plats et de compléments affichent le stock physique libre et son unité. L’édition d’un repas restitue sa propre réservation dans l’aperçu. Les lots affectés à d’autres repas et les productions simplement prévues sont exclus de cette quantité. Les préparations à produire restent sélectionnables. Une recette séparée affiche le stock par composant suivi.

Migration additive 20261120_home_consumption.sql, avec accès aux confirmations limité au profil concerné et aux gestionnaires de son foyer. Un retour à la 0.18.2 conserve la table et rétablit l’ancien écran de saisie manuelle. Les anciens relevés manuels restent en base et ne sont pas convertis en confirmations.

- [HAS, parcours de soins du diabète de type 2](https://www.has-sante.fr/jcms/p_3634754/fr/parcours-de-soins-du-patient-adulte-vivant-avec-un-diabete-de-type-2)
- [OMS, recommandations sur les graisses saturées et trans](https://www.who.int/publications/i/item/9789240073630)

## Portions à zéro dans le calendrier — 0.18.4

Chaque convive peut prendre 0 d’un plat et recevoir une autre recette au même repas. La saisie accepte aussi 0 pour les parties exprimées en grammes ou converties en pièces ou tranches. Les présences sont conservées et une portion absente est affichée à 0 lorsque le plat est servi à un autre convive. Le recalcul respecte ce choix. Une recette servie à personne est ignorée et un repas ordinaire demande au moins une portion servie.
