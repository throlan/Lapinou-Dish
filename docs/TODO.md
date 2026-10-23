# Prochaines tâches — 23 octobre 2026

Référence préparée : **0.2.96**, réglages d’unité d’achat par aliment et équivalences entre aliments explicites dans les courses ; 306 tests locaux réussis. Vérifier les contrôles GitHub et la publication après fusion. Les fonctions des versions 0.2.92 à 0.2.94 restent livrées. La 0.2.88 conserve la saisie en unités d’achat et stock compté cohérents, après les produits communs et exclusions 0.2.87. Le calcul 0.2.86 (base 0.2.83) reste conservé ; les calculs 0.2.84/85 sont abandonnés. Aucun nouveau chantier sans demande de l’utilisateur.

## Pistes à choisir et préciser

1. **Webapp — livrée en 0.2.90** : installation, icônes et guide iOS/Android/PC en place, critères vérifiés dans Chrome local. Recueillir le retour sur appareils physiques. Le hors-ligne et la synchronisation restent des chantiers distincts, sans demande de lancement.
2. **Comptes individuels et foyer — reportés** : décision de l’utilisateur après discussion du futur usage communautaire et d’une distribution/hébergement. Le modèle de comptes, profils, appartenances et droits reste à cadrer ; le choix gestionnaire/membre proposé initialement n’est pas validé. Aucun développement d’authentification individuelle n’a commencé. L’accès actuel reste une session par mot de passe du foyer. Ne pas reprendre ce chantier sans nouvelle demande.
3. **Correction des données nutritionnelles** : les filtres et badges existent. Améliorer l'explication des causes de calcul incomplet et l'accès aux ingrédients/conversions à corriger ; définir les critères avant développement.
4. **Communauté publique** : cadrer bibliothèque volontaire, droits et attribution des images/recettes, modération et isolation des données privées avant toute ouverture.
5. **Nettoyage du catalogue alimentaire — dernière priorité, après consolidation du cahier de recettes** : le compteur et les liens « Dans X recettes » sont livrés. Première étape proposée : filtre « inutilisés ». Ensuite, envisager une fusion guidée des doublons, avec aperçu des références et conservation des recettes, conversions, associations magasins et stocks. Ne pas supprimer automatiquement des aliments.

Détails et variantes dans [AMELIORATIONS.md](AMELIORATIONS.md). Les variantes indépendantes de recettes et l'affichage de photos en mode cuisine restent des pistes à confirmer, sans priorité décidée.

## Décisions récentes à conserver

- La gestion des utilisateurs est différée ; les autres pistes restent à choisir, sans lancement automatique.
- Une seule collation est souhaitée, l’après-midi. La suppression du créneau du soir n’est pas implémentée : cadrer la transition et préserver les menus historiques avant de modifier les cinq créneaux actuels.
- Les répartitions horaires restent actuellement communes au foyer, avec objectifs kcal propres à chaque personne. Aucun quota par âge ni nouvelle répartition nutritionnelle n’a été ajouté à la suite de la recherche documentaire.

## Déjà livré — ne pas remettre dans le reste à faire

- 0.2.94 : renommage direct des recettes depuis les fiches grille/liste, avec conservation des ingrédients/calculs et actualisation du titre des parties.

- 0.2.93 : coefficients individuels dans l’éditeur et les fiches, Semoule ×2, retrait des champs globaux visibles ; anciens coefficients appliqués conservés. 303 tests locaux et parcours Chrome fictif.

- 0.2.92 : filtre par service, service et rendement dans les réglages rapides, grille/liste, colonnes et taille des pages configurables. 302 tests locaux et parcours Chrome sur données fictives.

- Instagram dans Cuisiner (0.2.91) : publication de la source chargée au clic, vidéo si disponible, lecteur arrêté à la fermeture et lien d’origine conservé. Lecture dépendante d’Instagram ; aucune vidéo téléchargée.

- Webapp installable : manifeste, icônes lapin/cocotte, guide et invitation native quand disponible, ouverture standalone. Aucune couche de cache hors ligne ; mises à jour à la réouverture/actualisation.

- Charte Magazine culinaire · Encre framboise claire et responsive, navigation adaptée aux trois formats, cartes photos et formulaires conservant tous les réglages. Impression A4 d’origine préservée.

- Produits d’achat communs avec équivalence explicite, stock partagé, recettes et nutrition distinctes ; exclusions réversibles permanentes ou pour les dates de la liste. Aucun choix automatique pour les blancs d’œufs. Ceci ne fusionne pas les aliments du catalogue.

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
