# Stock des produits

Dans **Courses & stocks**, chaque produit peut avoir un stock de départ. Sur une ligne de courses, ouvrir **Saisir le stock déjà présent**, indiquer la quantité totale possédée dans l’unité de cette ligne, puis enregistrer. Cette saisie **remplace** le stock compté ; elle ne s’y ajoute pas. Le formulaire **Stock des produits** permet aussi de corriger directement le nombre de grammes et de régler, si souhaité, un minimum, une cible et un délai. Mettre ces trois seuils à zéro pour un simple inventaire.

La liste de courses retire le stock déjà disponible des besoins des recettes de la période. Si le stock suffit, l’article disparaît de la liste. S’il manque une conversion entre la pièce, le volume et les grammes, l’application conserve la ligne et l’indique : elle n’invente pas de poids.

Après les courses, **Valider l’achat et ajouter au stock** enregistre la quantité réellement achetée, exprimée dans l’unité de la ligne. Cette action **ajoute** au stock ; elle est distincte de la case à cocher qui masque seulement une ligne pour la période. Une demande d’achat répétée ne crédite pas deux fois le stock. Le détail de chaque produit montre les derniers mouvements.

Une production enregistrée retire les ingrédients suivis du stock une seule fois. Depuis le calendrier, **Marquer préparé** retire les ingrédients suivis d’une recette cuisinée pour ce repas. Si une recette vient d’un batch déjà enregistré, le repas utilise les portions produites et ne retire pas de nouveau les ingrédients. Si aucune portion produite n’est disponible, enregistrer d’abord la production. **Annuler la préparation** rétablit le stock déduit. Un repas marqué préparé ne peut être modifié ou supprimé avant cette annulation ; une recette liée est également protégée. Le simple fait de planifier un repas ne diminue pas le stock réel.

La base de stock est en grammes. Une quantité saisie en pièces ou en volume exige une conversion documentée dans la fiche aliment ; un zéro peut toujours être saisi pour vider un stock. Les aliments sans stock renseigné restent sur la liste de courses selon leurs besoins planifiés. La tenue du stock correspond à la préparation enregistrée, pas à un journal de consommation réelle.

Technique : migration `20261014_product_inventory.sql`, mouvements d’inventaire et de réception, déduction atomique des repas préparés et annulation, verrouillage du foyer et identifiant de demande pour les achats. Les tests PGlite vérifient les conversions, la concurrence par version, l’absence de double crédit/déduction, les batchs et l’annulation.
