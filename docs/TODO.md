# Prochaines tâches — 16 octobre 2026

Référence : application **0.2.72**, PR #99 fusionnée et publiée. Aucun chantier fonctionnel ni publication de cette version ne reste en attente à la clôture. La prochaine modification doit être choisie avec l'utilisateur ; l'ordre ci-dessous est une proposition, pas une autorisation de commencer.

## Pistes à choisir et préciser

1. **Nettoyage du catalogue alimentaire** : le compteur et les liens « Dans X recettes » sont livrés. En complément, envisager un filtre « inutilisés » et une fusion sûre des doublons, avec aperçu des références et conservation des recettes, conversions, associations magasins et stocks. Ne pas supprimer automatiquement des aliments.
2. **Correction des données nutritionnelles** : les filtres et badges existent. Améliorer l'explication des causes de calcul incomplet et l'accès aux ingrédients/conversions à corriger ; définir les critères avant développement.
3. **Confort mobile** : auditer calendrier, éditeur de repas, recettes et fiche cuisine sur petit écran. Les courses ont déjà reçu une première passe. Décider ensuite d'une PWA installable ; le hors-ligne est un chantier distinct.
4. **Comptes individuels et foyer** : concevoir compte/personne, rôles gestionnaire/membre, droits côté serveur, invitations et récupération. L'accès actuel reste une session par mot de passe du foyer.
5. **Communauté publique** : cadrer bibliothèque volontaire, droits et attribution des images/recettes, modération et isolation des données privées avant toute ouverture.

Détails et variantes dans [AMELIORATIONS.md](AMELIORATIONS.md). Les variantes indépendantes de recettes et l'affichage de photos en mode cuisine restent des pistes à confirmer, sans priorité décidée.

## Déjà livré — ne pas remettre dans le reste à faire

- Page Importer distincte, brouillons à vérifier ; vignettes de recettes, photos et filtres latéraux.
- Photos personnelles et génération IA, stockage configurable et diagnostic du stockage.
- Filtres données manquantes / nutrition / recettes planifiées ce mois et après ; badges des préparations et retour interne.
- Duplication d'aliment ; liens de recettes depuis les courses et depuis chaque aliment.
- Calories dans les choix de recettes du calendrier.
- Catégories Salade et Sauce ; ajout de sauce par personne avec quantité fixe modifiable et zéro autorisé.
- Regroupement des préparations par recette et semaine, fiche Cuisiner, stocks et achats par magasin.
- Réserve kcal et occasions, livrées depuis 0.2.42. Aucun journal de consommation après repas à ajouter.

## Règles de reprise et livraison

Préserver modifications locales et stashes ; lire [REPRISE.md](REPRISE.md) et [STATUS.md](STATUS.md). Développer et vérifier localement sur données fictives, puis PR, contrôles, fusion et vérification de publication. **Jamais d'accès à Unraid ou à Nginx.**
