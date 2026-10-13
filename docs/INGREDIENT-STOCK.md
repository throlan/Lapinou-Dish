# Courses et ingrédients surveillés

Dans **Courses & stocks → Ingrédients à surveiller**, rechercher un aliment du catalogue et choisir sa fiche exacte (par exemple whey neutre, farine T65 ou T110). Renseigner le stock compté, le minimum et la cible en grammes, puis le délai de commande en jours. Cette inscription est le marquage « Surveillé » de l'aliment pour le foyer. Après réception ou correction d'inventaire, ouvrir **Inventaire / réception / seuils** et saisir le nouveau total réellement présent.

Le minimum sert de réserve de sécurité. La cible indique le niveau souhaité après réapprovisionnement. Une alerte apparaît dans les stocks et sur l'accueil si le stock actuel, ou le stock projeté après les repas prévus pendant le délai de commande, atteint le minimum. Les besoins ne tiennent compte que des repas enregistrés; une usine future sans menu associé n'est pas anticipée automatiquement.

## Produire un lot

Dans la recette, choisir une **Production à suivre** (pâtisserie, pain, pâtes ou batch cooking). Dans **Enregistrer une production**, sélectionner cette préparation et saisir la quantité effectivement produite, dans l'unité de rendement de la recette. Une recette de 24 unités contenant 80 g de whey et 160 g de chacune des farines T65 et T110 consomme exactement ces quantités pour 24 unités; 48 unités les doublent.

Seuls les ingrédients inscrits dans la surveillance sont déduits. Les unités de masse sont converties exactement; les pièces et volumes nécessitent les conversions documentées de la fiche alimentaire. Si une conversion manque ou qu'un stock suivi est insuffisant, aucune partie de la production n'est enregistrée. Corriger l'inventaire ou la conversion puis réessayer. Le lot fini, les déductions et les mouvements d'inventaire sont enregistrés dans une transaction. Une relance de la même tentative ne débite pas deux fois les ingrédients.

Les productions déjà enregistrées avant cette mise à jour ne sont pas recalculées. Saisir un inventaire actuel avant la première nouvelle production. Un inventaire ouvert avant une autre modification du stock doit être rouvert pour éviter d'effacer une déduction récente.

## Liste de courses

Pour corriger une saisie de production (par exemple un lot de test), ouvrir **Stock des préparations**, puis **Annuler le lot** sur le lot daté concerné et confirmer. Seul ce lot est retiré des totaux; la recette et les autres lots sont conservés. Les déductions d'ingrédients enregistrées pour ce lot sont remises en réserve, même si la recette a été modifiée depuis. Les anciens lots sans déductions enregistrées n'ajoutent aucun ingrédient. L'annulation reste historisée et une seconde tentative ne crédite pas deux fois le stock. Cette action corrige une saisie erronée; elle ne déclare pas une consommation réelle.

La période choisie sert à additionner les quantités prévues par personne et par recette. Les lots finis déjà enregistrés couvrent d'abord les repas; leurs ingrédients ne sont pas achetés une seconde fois. Les mêmes ingrédients et unités sont consolidés. Pour les bases surveillées, les besoins convertibles sont ramenés en grammes et le stock compté est déduit, en conservant le minimum. Si un réapprovisionnement est nécessaire, la suggestion atteint au moins la cible. Les conversions manquantes restent visibles, sans assimiler une pièce à un gramme.

Les bases surveillées à commander apparaissent par défaut dans **Whey et farines**; la catégorie est modifiable. Les cases « acheté » sont mémorisées pour la période exacte. Cocher un achat ne remplit pas automatiquement l'inventaire : mettre à jour le stock compté après réception. Les suggestions sont des besoins en grammes; l'arrondi aux conditionnements commerciaux reste manuel.

Le stock des préparations reste un rapprochement entre productions enregistrées et repas planifiés. Le journal de consommation réelle et le suivi des pertes ne sont pas encore intégrés.

## Validation de ce lot

Les tests utilisent un PostgreSQL embarqué local avec toutes les migrations, des données synthétiques et les vraies requêtes : production de 24 muffins, déduction atomique, reprise sans doublon, refus d'un inventaire obsolète, manque de stock, conversions manquantes, couverture des menus par les lots et anticipation d'une commande. Aucun accès à Unraid n'est nécessaire.
