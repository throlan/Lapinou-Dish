# Choix des repas et suivi des apports — 0.18.0

Le bouton « Choisir les repas » du calendrier ouvre les plats principaux du déjeuner et du dîner ainsi que leurs participants. Les créneaux déjà occupés donnent accès à la fiche du repas. Pour les créneaux libres, l’aperçu calcule les portions et propose le petit-déjeuner, la collation, les desserts et les sauces pour les salades, selon les recettes et le budget disponible. Les suggestions sont décochables et la confirmation enregistre la sélection en une transaction.

Le calendrier retire du budget à la maison la part du déjeuner ou du dîner définie dans les réglages si le créneau est planifié sans la personne. Un créneau vide ne signifie pas une absence. Les repères affichés et le rééquilibrage quotidien utilisent cette part. Les glucides et lipides réellement consommés peuvent être renseignés en grammes pour une journée, repas extérieurs compris, et sont comparés aux repères journaliers du profil lorsqu’ils existent.

Migration additive pour les apports saisis. Lecture et écriture réservées à la personne concernée et aux gestionnaires de son foyer. Une ancienne image ignore les données de cette table.

## Confirmation des repas à la maison — 0.18.1

Dans le calendrier, « Valider les repas consommés » permet de cocher, par personne et par date, les repas du planning effectivement pris à la maison. Les absents et les repas extérieurs ne sont pas comptés. Les glucides et lipides des portions planifiées sont enregistrés au moment de la confirmation, avec un indicateur lorsqu’une valeur manque. Ils sont comparés au repère à la maison après retrait de la part des créneaux extérieurs. Décocher un repas corrige le relevé.

La migration ajoute une table privée pour les confirmations et leurs valeurs. Les anciennes saisies manuelles restent archivées séparément, car elles peuvent inclure des repas extérieurs. Le relevé n’enregistre aucun mouvement de stock.
