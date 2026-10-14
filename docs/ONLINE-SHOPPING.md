# Achats en ligne et listes par boutique

Dans **Courses & stocks → Achats en ligne**, enregistrer le nom et l'URL HTTPS des boutiques utilisées. Les liens de commande existants sont réutilisés : il n'est pas nécessaire de les recréer.

## Associer les aliments

1. Ouvrir **Associer les aliments aux boutiques**.
2. Rechercher un aliment, par exemple « whey » ou « farine ».
3. Cocher les aliments concernés, ou cliquer sur **Sélectionner les résultats affichés**.
4. Choisir une boutique puis **Associer la sélection**.

Exemples : les différentes wheys chez Nutripure ; les farines et certains produits bio chez Greenwhiz. L'affectation reste explicite, sans classifier tous les aliments bio ou toutes les farines automatiquement.

La sélection est conservée entre recherches et peut être vidée. Au maximum 50 résultats sont affichés par recherche et 200 aliments peuvent être affectés en une fois. Le nombre et les noms des aliments sélectionnés sont affichés avant validation. Affiner la recherche si tous les résultats ne tiennent pas dans la liste.

Un aliment a une boutique par foyer, pour toutes ses unités et périodes de courses. Les autres foyers gardent leurs propres choix. Les affectations enregistrées peuvent être modifiées dans ce même panneau, même si l'aliment n'est pas nécessaire dans la période actuelle. Choisir **Sans boutique** retire l'affectation ; ce choix est également disponible pour une sélection de plusieurs aliments.

## Préparer les courses

La liste calculée pour la période choisie regroupe les aliments affectés dans **Achats en ligne**, avec une sous-liste par boutique et un lien **Ouvrir la boutique**. Le sélecteur Boutique de chaque ligne permet de déplacer un aliment vers un autre marchand ou de retirer son affectation.

Les aliments sans boutique restent visibles dans leur catégorie habituelle ; ceux de l'ancienne catégorie whey/farines restent dans **Achats en ligne → Sans boutique attribuée**. Tant qu'une boutique est affectée, la catégorie de la ligne est fixée à Achats en ligne. Retirer l'affectation retrouve la catégorie précédemment enregistrée.

Les besoins proviennent des recettes et portions du calendrier. Les stocks préparés, réservations et stocks d'ingrédients surveillés restent déduits selon les règles existantes. Les formats de paquet, arrondis d'achat, cases acheté par période, liens vers les recettes et quantités sources sont conservés. Une simple modification du paquet met à jour la ligne sans reconstruire la liste ni changer le défilement.

La routine précédemment nommée « Commande whey et farines » s'appelle désormais **Achats en ligne**. Les identifiants internes et réglages de fréquence/date sont conservés.

Supprimer une boutique ayant des aliments affectés demande confirmation et retire ces affectations. Les aliments, leurs besoins et les réglages de courses restent conservés.

## Technique et validation

- Migration `20261014_food_stores.sql` : relation par foyer/aliment vers un lien de commande du même foyer, protégée par clé étrangère composée.
- API authentifiée `GET/PUT /api/household-food-stores`. L'affectation d'une sélection est transactionnelle ; un aliment ou une boutique inconnue annule toute l'opération.
- Tests `test/food-stores.test.mjs` : validation, isolation des foyers, persistance, réaffectation, retrait, stocks, paquets, cases acheté, protection de la migration des réglages existants et suppression d'une boutique.
- Parcours Chrome local sur données synthétiques : ajout de boutiques, affectation par sélection, listes par marchand, conservation après rechargement et affichage mobile.
