# Prochaines tâches — 18 octobre 2026

Référence du code : **0.2.85**, arrondi coordonné et écarts aux proportions visibles. Dernière livraison antérieure vérifiée : **0.2.84**, PR #114 fusionnée et publiée. Priorité validée : unités entières avec écarts explicites. Vérifier les contrôles et la publication de la tête de main. Aucun nouveau chantier ne doit démarrer sans demande de l’utilisateur.

## Pistes à choisir et préciser

1. **Nettoyage du catalogue alimentaire** : le compteur et les liens « Dans X recettes » sont livrés. Première étape proposée : filtre « inutilisés ». Ensuite, envisager une fusion guidée des doublons, avec aperçu des références et conservation des recettes, conversions, associations magasins et stocks. Ne pas supprimer automatiquement des aliments.
2. **Correction des données nutritionnelles** : les filtres et badges existent. Améliorer l'explication des causes de calcul incomplet et l'accès aux ingrédients/conversions à corriger ; définir les critères avant développement.
3. **Confort mobile** : auditer calendrier, éditeur de repas, recettes et fiche cuisine sur petit écran. Les courses ont déjà reçu une première passe. Décider ensuite d'une PWA installable ; le hors-ligne est un chantier distinct.
4. **Comptes individuels et foyer** : concevoir compte/personne, rôles gestionnaire/membre, droits côté serveur, invitations et récupération. L'accès actuel reste une session par mot de passe du foyer.
5. **Communauté publique** : cadrer bibliothèque volontaire, droits et attribution des images/recettes, modération et isolation des données privées avant toute ouverture.

Détails et variantes dans [AMELIORATIONS.md](AMELIORATIONS.md). Les variantes indépendantes de recettes et l'affichage de photos en mode cuisine restent des pistes à confirmer, sans priorité décidée.

## Déjà livré — ne pas remettre dans le reste à faire

- Arrondi coordonné œufs/tranches/services en grammes et affichage, par personne, des grammes, pourcentages réels, repères et écarts en points, hors des détails repliés. Les unités entières sont prioritaires selon le choix explicite de l’utilisateur.

- Unités mixtes des services séparés simples : œufs/pièces, soupe/grammes, pain/tranches, conversion de saisie et suggestions en unités entières ; anciens menus conservés sans arrondi implicite.

- Import IA et texte d’un rendement en tranches, conservé du brouillon à la recette. Fiche pain de mie aux graines Francine/T110 prête à copier.

- Recettes comme composants : bagels à la pièce, pain à la tranche avec équivalence explicite, sauces/pâtes/accompagnements, nutrition dynamique, besoins des menus et matières premières calculés après stock des composants ; assemblage et annulations sans double déduction.

- Bouton Supprimer sur les vignettes de recettes et dans l’éditeur : suppression d’une recette inutilisée, de ses parties et photos, confirmation et protection des menus/historiques de production.
- Page Importer distincte, brouillons à vérifier ; vignettes de recettes, photos et filtres latéraux.
- Photos personnelles et génération IA, stockage configurable, diagnostic et champ de dossier visible dans le template (PR #107).
- Cuisine hors menus : quantité libre en portions/pièces ou unités d’origine, sans ajustement aux objectifs des profils ; équivalence en poids estimé et conservation des valeurs lors du changement de mode.
- Fiche Cuisiner selon les menus : quantités nécessaires des menus pour tous les services, ingrédients ajustés séparément et production atomique des parties. Pas de recette complète proposée en repli ni d’arrondi aux unités entières de fabrication. Le calcul des pièces entières reste dans le choix des portions des menus, pas dans la fiche cuisine.
- Filtres données manquantes / nutrition / recettes planifiées ce mois et après ; badges des préparations et retour interne.
- Duplication d'aliment ; liens de recettes depuis les courses et depuis chaque aliment.
- Calories dans les choix de recettes du calendrier.
- Plafond à une portion pour les salades suggérées automatiquement ; couleurs des créneaux, repère hebdomadaire kcal et minima protéiques quotidiens configurables par personne dans Administration.
- Calendrier hebdomadaire imprimable en paysage, menus et quantités par personne uniquement.
- Catégories Salade et Sauce ; ajout de sauce par personne avec quantité fixe modifiable et zéro autorisé.
- Regroupement des préparations par recette et semaine, fiche Cuisiner, stocks et achats par magasin.
- Réserve kcal et occasions, livrées depuis 0.2.42. Aucun journal de consommation après repas à ajouter.

## Règles de reprise et livraison

Préserver modifications locales et stashes ; lire [REPRISE.md](REPRISE.md) et [STATUS.md](STATUS.md). Développer et vérifier localement sur données fictives, puis PR, contrôles, fusion et vérification de publication. **Jamais d'accès à Unraid ou à Nginx.**
