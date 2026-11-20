# Choix des repas et suivi des apports — 0.18.0

Le bouton « Choisir les repas » du calendrier ouvre les plats principaux du déjeuner et du dîner ainsi que leurs participants. Les créneaux déjà occupés donnent accès à la fiche du repas. Pour les créneaux libres, l’aperçu calcule les portions et propose le petit-déjeuner, la collation, les desserts et les sauces pour les salades, selon les recettes et le budget disponible. Les suggestions sont décochables et la confirmation enregistre la sélection en une transaction.

Le calendrier retire du budget à la maison la part du déjeuner ou du dîner définie dans les réglages si le créneau est planifié sans la personne. Un créneau vide ne signifie pas une absence. Les repères affichés et le rééquilibrage quotidien utilisent cette part. Les glucides et lipides réellement consommés peuvent être renseignés en grammes pour une journée, repas extérieurs compris, et sont comparés aux repères journaliers du profil lorsqu’ils existent.

Migration additive pour les apports saisis. Lecture et écriture réservées à la personne concernée et aux gestionnaires de son foyer. Une ancienne image ignore les données de cette table.

## Sélection dynamique des quatre créneaux — 0.18.2

« Choisir les repas » affiche quatre sélecteurs avec des participants indépendants. Les calories prévues et le solde par personne sont recalculés dans la fenêtre à chaque modification. Les sauces pour les salades et les desserts sont proposés après comptage de tous les repas, avec un choix commun qui doit tenir dans le solde de chaque participant. Le choix d’un complément réduit les options disponibles pour les suivants.
