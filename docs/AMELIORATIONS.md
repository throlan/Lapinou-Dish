# Cahier des améliorations proposées

Mis à jour le 17 octobre 2026 pour suivre le chantier 0.2.77 relatif au stockage des photos. Ce document rassemble des pistes demandées ou suggérées. Chaque chantier devra être précisé avant sa mise en œuvre. Les fonctionnalités livrées restent décrites dans [STATUS.md](STATUS.md) et le dernier journal est [SESSION-2026-10-17.md](SESSION-2026-10-17.md).

## Expérience des recettes

### Séparer l’import des recettes

**Livré** : page Importer dédiée, imports et brouillons à vérifier avant association au catalogue et validation. Les améliorations de détection des doublons et de confort du parcours restent à préciser ; ne pas recréer cette page.

### Afficher les recettes en vignettes avec des filtres latéraux

**Livré** : grille paginée de vignettes avec photos, recherche et filtres latéraux sur ordinateur. Les réglages rapides sont conservés. Restent à évaluer la densité des fiches et le confort mobile des filtres, notamment un panneau repliable ; la grille elle-même n’est plus à créer.

### Améliorer l'affichage des photos dans les recettes

L'ajout, le remplacement, la suppression et la génération à la demande sont livrés. Le stockage persistant est configurable par `RECIPE_IMAGE_DIR`, avec repli PostgreSQL ; le template Unraid relie `/mnt/user/appdata/lapinoudish/images` à `/images` et rend visible le champ de configuration. Le montage seul ne suffit pas si `RECIPE_IMAGE_DIR` est absent ; la confirmation sur l’installation revient à l’utilisateur. Les photos sont affichées dans les vignettes. Reste à décider si le mode cuisine en a besoin. Ne pas intégrer automatiquement les images des publications externes sans vérification des droits et sans action explicite.

### Filtrer les recettes incomplètes

**Livré** : filtres données manquantes, nutrition, instructions et photo ; filtre nutrition incomplète parmi les recettes planifiées depuis le premier jour du mois courant et à venir, et badge dans les préparations à faire. Les liens et les quantités restent indépendants de ces filtres. Prolongement possible : détailler la cause par ingrédient ou conversion et faciliter sa correction. Une donnée inconnue ne devient jamais zéro.

## Usage mobile et webapp

Le calendrier dispose d’une impression hebdomadaire A4 paysage, avec menus et quantités par personne uniquement (PR #104). La page Courses & stocks a reçu une première amélioration mobile en 0.2.68 : résumés Home Assistant plus courts, besoin visible sans déplier les produits et accès rapide aux mesures. Il reste à parcourir les autres pages sur petit écran, notamment calendrier, éditeurs de repas, recettes et mode cuisine. Évaluer une PWA installable (manifest, icônes et comportement de mise à jour) après ces améliorations. Le mode hors ligne et la synchronisation différée sont des sujets distincts à étudier ensuite, car ils ajoutent des conflits de données et des contraintes de sécurité.

## Calendrier et repères nutritionnels

**Livré** : plafond de suggestion automatique à une portion pour les salades, couleurs de créneaux, comparaison kcal hebdomadaire, protéines quotidiennes par personne, minima configurables dans Administration et impression paysage avec quantités par personne (PR #101 à #105). Ne pas remettre ces fonctions dans les tâches restantes.

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

## Prochaines décisions

La liste synthétique à jour est dans [TODO.md](TODO.md). Première piste proposée : filtre des aliments inutilisés, puis étude d’une fusion guidée des doublons avec aperçu des références et préservation des stocks, conversions et magasins. Ensuite : aide à la correction des données manquantes, confort mobile, comptes et communauté. Cet ordre reste une proposition ; attendre la demande de l’utilisateur avant de commencer.

## Recettes utilisées comme composants — réalisé en 0.2.82

« + Préparation maison » permet d’utiliser pain/bagel, sauce, pâtes et accompagnements dans les plats. Unités à la pièce, à la tranche, en portion, g ou ml selon les équivalences explicites ; apports dérivés et besoins des menus étendus aux composants après couverture par le stock. Les composants suivis sont produits avant les plats ; les ingrédients ne sont pas déduits deux fois. Les références, annulations et services indépendants sont protégés. Ce chantier ne doit pas être proposé à nouveau.

## Services séparés en pièces/tranches/grammes — réalisé en 0.2.84

Reprise automatique des unités d’une partie séparée à une seule ligne en pièce ou tranche : œufs à la pièce, soupe en grammes, pain à la tranche. Éditeur, choix, accueil et impression cohérents ; données canoniques en grammes conservées, suggestions et rééquilibrage tenant compte des unités entières. Les plats mélangés ne reçoivent pas d’unité supposée.

## Répartition réelle des assiettes — réalisé en 0.2.85

Choix utilisateur confirmé : garder les unités entières avec l’écart aux pourcentages affiché. Arrondi coordonné des comptes et des grammes au recalcul, rapport visible par personne (poids, pourcentage réel, repère, écart en points), mise à jour après saisie manuelle et suppression du 70/20 % ambigu sur les parties liées.
