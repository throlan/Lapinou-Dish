# Décisions techniques initiales

État: décisions de départ, à vérifier par un prototype technique. Toute modification se fait ici avant d'accumuler des compromis dans le code.

## ADR-0001 — Application neuve, domaine et interface propres

**Décision.** Lapinou Dish vit dans son propre dépôt, son propre schéma, son propre vocabulaire produit et ses propres écrans. Aucun package, migration ou modèle Norish n'est importé comme dépendance d'exécution. Le dépôt Norish sert uniquement de référence historique pour les besoins et un chemin d'export/import ponctuel pourra être écrit plus tard.

**Pourquoi.** Les entités et écrans hérités ont créé plusieurs représentations concurrentes des ingrédients et de la nutrition, et l'interface actuelle ne convient pas aux parcours desktop du foyer.

## ADR-0002 — Web monolithique desktop-first

**Décision provisoire.** Un seul service web TypeScript pour l'application et ses routes métier, PostgreSQL comme stockage, ORM avec migrations versionnées, validation des entrées côté serveur. Pas de microservices, Redis, workers ou app mobile avant un besoin validé.

**Interface.** Pages métier conçues autour des parcours bureau; composants de calendrier et éditeur testés sur navigateur réel aux dimensions desktop avant toute livraison. PWA/mobile responsive après validation du bureau.

**À décider par spike court.** Framework web et auth: comparer la simplicité d'exploitation sur Unraid, la qualité des formulaires/tableaux desktop et les migrations. Choisir un framework familier n'autorise pas à reprendre son modèle de domaine.

## ADR-0003 — Catalogue alimentaire canonique

**Décision.** Une table métier `food` unique est la référence à l'exécution. Import Ciqual et saisie étiquette sont des provenances de fiches dans la même table. Les aliments sont liés par clé étrangère aux lignes de recette. Les noms importés ne deviennent pas des fiches séparées tant que l'utilisateur ne les valide pas.

## ADR-0004 — Pas de calcul sur des calories importées

**Décision.** Nutrition de recette/repas/personne est calculée depuis les aliments et masses déterminables. Les valeurs externes sont affichées avec leur provenance comme repère non validé, sans écraser le calcul. Les manques restent visibles.

## ADR-0005 — Interface semaine sans défilement imbriqué

**Décision.** Sur desktop, la grille hebdomadaire et ses créneaux doivent être visibles dans la fenêtre standard; les détails s'ouvrent dans un panneau latéral. La page n'enferme pas une liste de repas dans une boîte à scroll. Les résumés journaliers/personnels sont des éléments de la grille ou un panneau latéral persistant.

## ADR-0006 — Déploiement distinct et réversible

**Décision.** Nouveau nom d'image et nouveau conteneur, nouvelle base dédiée et volumes dédiés sur Unraid. Aucun partage de tables, migrations, uploads ou secrets avec le Norish existant ou le conteneur de test. Un import de données ne se fera qu'après sauvegarde et répétition sur copie jetable.

## Dépendances minimales prévues

- Application web monolithique, HTML accessible et interactions standard.
- PostgreSQL déjà maîtrisé sur l'hôte, mais une base neuve propre au service.
- Aucun service externe nécessaire pour calculer la nutrition, planifier ou produire.
- Ciqual livré/versionné comme jeu initial attribué à l'Anses; produits de marque importés depuis les étiquettes par l'administrateur.
