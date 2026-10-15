# Cahier des améliorations proposées

Mis à jour le 15 octobre 2026. Ce document rassemble des pistes demandées ou suggérées. Elles ne sont pas encore engagées dans le développement ; chaque chantier devra être précisé avant sa mise en œuvre. Les fonctionnalités livrées restent décrites dans [STATUS.md](STATUS.md).

## Expérience des recettes

### Séparer l’import des recettes

Déplacer l’import de recettes dans une page dédiée. La page Recettes serait consacrée à la consultation, la recherche, aux filtres et aux fiches. La page Importer proposerait l’import par texte, archive ou lien, puis une file de brouillons à vérifier et à associer au catalogue avant validation. Conserver les brouillons et les doublons repérables.

### Afficher les recettes en vignettes avec des filtres latéraux

Remplacer progressivement la liste paginée actuelle par une grille de fiches compactes, avec une colonne de filtres à gauche sur ordinateur. Chaque vignette pourrait montrer le nom, la photo si elle existe, les tags (type, moment, production), le rendement et un indicateur de complétude. Sur petit écran, la colonne devient un panneau de filtres repliable. Conserver la recherche, la pagination ou le chargement progressif et les réglages rapides sans ouvrir chaque fiche.

### Ajouter des photos aux recettes

Permettre d’ajouter, remplacer et retirer une photo dans la fiche recette, avec aperçu dans les vignettes et dans le mode cuisine. Décider avant développement où stocker les fichiers, leurs limites de taille et de format, les miniatures, les sauvegardes et les règles de suppression. Ne pas intégrer automatiquement les images des publications externes sans vérification des droits et sans action explicite.

### Filtrer les recettes incomplètes

Ajouter un filtre « Données manquantes » et, si utile, des sous-filtres indiquant la cause : valeurs nutritionnelles absentes, ingrédient non associé au catalogue, conversion inconnue, rendement ou instructions absents, photo manquante. Distinguer les champs facultatifs des champs qui empêchent un calcul nutritionnel fiable. Un indicateur doit expliquer ce qui manque, sans convertir une valeur inconnue en zéro.

## Usage mobile et webapp

Améliorer l’interface pour les petits écrans et l’usage tactile : navigation simple, boutons adaptés, calendrier lisible, formulaires praticables, filtres repliables et pages de cuisine faciles à consulter pendant la préparation. Évaluer une PWA installable (manifest, icônes et comportement de mise à jour). Le mode hors ligne et la synchronisation différée sont des sujets distincts à étudier après l’expérience mobile de base, car ils ajoutent des conflits de données et des contraintes de sécurité.

## Comptes utilisateurs et foyer

Aujourd’hui, l’accès est centré sur le foyer et ses profils de personnes. L’évolution doit distinguer explicitement le compte de connexion de la personne dont les menus et données sont suivis :

- Un compte appartient à un foyer et est associé à un profil de personne de ce foyer. Le foyer peut conserver des profils sans compte, notamment pour les enfants.
- Une personne connectée peut consulter son profil, ses mesures et son historique, modifier les informations autorisées et consulter les menus de la semaine du foyer.
- Prévoir des rôles compréhensibles, au minimum gestionnaire du foyer et membre. Le gestionnaire invite ou retire un membre et gère les profils du foyer ; les droits d’un membre sur les données des autres personnes doivent être définis explicitement.
- Prévoir invitation sécurisée, acceptation, révocation, départ d’un foyer, transfert de gestion et récupération de compte. Éviter le partage d’un mot de passe unique par toute la famille.
- Protéger particulièrement les informations de poids, taille, âge et besoins nutritionnels. Les membres mineurs nécessitent une gestion par un adulte responsable et ne devraient pas recevoir de compte autonome sans décision explicite.
- Définir les règles de conservation, d’export et de suppression du compte et des données du foyer avant la mise en production.

Une première étape raisonnable serait un compte par adulte, une association explicite à une personne du foyer, un rôle gestionnaire/membre et un contrôle d’accès côté serveur à chaque opération. Les invitations et la récupération de compte peuvent suivre dans un second temps.

## Projet communautaire public

Envisager une bibliothèque publique de recettes partageables, consultables et importables, distincte des foyers privés. Une publication doit être volontaire et ne jamais exposer le calendrier, les profils, les mesures, les stocks ou l’identité du foyer. Étudier avant ouverture : attribution et droits sur les recettes et images, modération et signalement, contenu nutritionnel sourcé, versions des recettes, import dans un foyer sans écraser ses fiches existantes, anti-spam et coûts d’hébergement.

Une première expérimentation pourrait se limiter à un catalogue public en lecture seule, alimenté par des recettes explicitement proposées par leurs auteurs et approuvées. Les commentaires, comptes publics, notes et contributions ouvertes sont des extensions à évaluer séparément.

## Ordre de discussion suggéré

1. Clarifier les critères de complétude nutritionnelle et la page de recettes : vignettes, filtres et filtre des données manquantes.
2. Décider le périmètre du formulaire d’import et du traitement des brouillons.
3. Choisir une stratégie de stockage et de gestion des photos.
4. Valider les parcours mobiles, puis l’intérêt d’une PWA installable.
5. Dessiner le modèle de comptes, d’associations personne/foyer et de droits avant toute modification d’authentification.
6. Étudier la bibliothèque publique après avoir défini les droits, la modération et l’isolation stricte avec les données privées.
