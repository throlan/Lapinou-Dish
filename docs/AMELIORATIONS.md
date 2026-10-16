# Cahier des améliorations proposées

Mis à jour le 16 octobre 2026. Ce document rassemble des pistes demandées ou suggérées. Chaque chantier devra être précisé avant sa mise en œuvre. Les fonctionnalités livrées restent décrites dans [STATUS.md](STATUS.md).

## Expérience des recettes

### Séparer l’import des recettes

Déplacer l’import de recettes dans une page dédiée. La page Recettes serait consacrée à la consultation, la recherche, aux filtres et aux fiches. La page Importer proposerait l’import par texte, archive ou lien, puis une file de brouillons à vérifier et à associer au catalogue avant validation. Conserver les brouillons et les doublons repérables.

### Afficher les recettes en vignettes avec des filtres latéraux

Remplacer progressivement la liste paginée actuelle par une grille de fiches compactes, avec une colonne de filtres à gauche sur ordinateur. Chaque vignette pourrait montrer le nom, la photo si elle existe, les tags (type, moment, production), le rendement et un indicateur de complétude. Sur petit écran, la colonne devient un panneau de filtres repliable. Conserver la recherche, la pagination ou le chargement progressif et les réglages rapides sans ouvrir chaque fiche.

### Améliorer l'affichage des photos dans les recettes

L'ajout, le remplacement, la suppression et la génération à la demande sont livrés. Le stockage persistant est configurable par `RECIPE_IMAGE_DIR`, avec repli PostgreSQL ; la configuration retenue dans le conteneur est `/images`. Il reste à afficher les photos dans les futures vignettes et à décider si le mode cuisine en a besoin. Ne pas intégrer automatiquement les images des publications externes sans vérification des droits et sans action explicite.

### Filtrer les recettes incomplètes

Ajouter un filtre « Données manquantes » et, si utile, des sous-filtres indiquant la cause : valeurs nutritionnelles absentes, ingrédient non associé au catalogue, conversion inconnue, rendement ou instructions absents, photo manquante. Distinguer les champs facultatifs des champs qui empêchent un calcul nutritionnel fiable. Un indicateur doit expliquer ce qui manque, sans convertir une valeur inconnue en zéro.

## Usage mobile et webapp

La page Courses & stocks a reçu une première amélioration mobile en 0.2.68 : résumés Home Assistant plus courts, besoin visible sans déplier les produits et accès rapide aux mesures. Il reste à parcourir les autres pages sur petit écran, notamment calendrier, éditeurs de repas, recettes et mode cuisine. Évaluer une PWA installable (manifest, icônes et comportement de mise à jour) après ces améliorations. Le mode hors ligne et la synchronisation différée sont des sujets distincts à étudier ensuite, car ils ajoutent des conflits de données et des contraintes de sécurité.

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

1. Définir la prochaine évolution de la page Recettes : vignettes plus compactes, filtres et explication des données nutritionnelles incomplètes. La liste actuelle est déjà paginée et possède des réglages rapides.
2. Préciser le parcours d'import : page dédiée, file de brouillons, association au catalogue et détection des doublons.
3. Vérifier les parcours mobiles des pages restantes ; les courses ont déjà reçu leur première passe en 0.2.68. Décider ensuite si une PWA installable apporte une vraie valeur.
4. Dessiner le modèle de comptes, d'associations personne/foyer et de droits avant toute modification d'authentification.
5. Étudier la bibliothèque publique après avoir défini les droits, la modération et l'isolation stricte avec les données privées.

## Prochaine décision

Le meilleur prochain chantier à préciser est la page Recettes, en commençant par les filtres de complétude et la densité des fiches, puis en cadrant séparément la page d'import. Les photos persistantes sont déjà opérationnelles ; leur présentation dans les vignettes peut être intégrée à ce chantier.
