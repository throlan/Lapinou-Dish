# Décisions techniques initiales

État : les ADR initiales ci-dessous sont historiques ; les décisions appliquées plus bas font autorité.

Les ADR initiales ci-dessous gardent leur contexte historique. L'implémentation actuelle est décrite dans [STATUS.md](STATUS.md) et les décisions de session ci-après ; l'agent ne doit jamais accéder ni intervenir sur Unraid.

## Architecture actuelle — 0.2.72

Node.js 24+, serveur HTTP monolithique, modules métier JavaScript et domaine TypeScript natif ; interface HTML/CSS/JavaScript sans framework. PostgreSQL via pg, migrations SQL explicites et tests PGlite ; aucun ORM. Session de foyer, comptes individuels non livrés. Images dans un dossier configurable avec repli PostgreSQL. GitHub Actions teste les PR puis publie sur GHCR après fusion sur main. Les propositions historiques de framework/ORM ne sont plus des tâches ouvertes. Aucun accès de l’agent à Unraid ni à Nginx.

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

## Décisions appliquées au 13 octobre 2026

- Service Node.js 24 monolithique : routes HTTP dans `src/server/app.mjs`, modules métier JavaScript, domaine typé exécuté avec le support TypeScript natif, interface HTML/CSS/JavaScript dans `web`. PostgreSQL via `pg`, migrations SQL explicites ; aucun ORM n'a été ajouté.
- Les tests d'intégration utilisent PGlite sur une base jetable et exécutent les migrations et transactions réelles. Les parcours Chrome utilisent des données synthétiques locales.
- Les parties de service sont des recettes dérivées en grammes, rattachées à la recette mère. Leurs identifiants restent stables ; les lots liés au batch empêchent les doubles déductions d'ingrédients.
- Répartition kcal : configuration JSON par foyer, validation commune à l'API et à l'interface dans `web/meal-config.js`. Un seul référentiel des cinq créneaux et pourcentages par défaut.
- Rééquilibrage : calcul séparé dans `src/server/daily-rebalance.mjs`, aperçu sans mutation, empreinte des entrées et propositions, application transactionnelle sérialisable avec verrou du foyer. Les quantités sauvegardées et le stock physique restent distincts.
- Administration utilise la session existante du foyer ; il n'y a pas de nouveau rôle administrateur ni système de comptes individuel introduit par cet onglet.
- Livraison : GitHub/CI/GHCR seulement dans le périmètre de l'agent. L'utilisateur applique lui-même les mises à jour sur son installation. Cette règle prévaut sur les anciennes intentions de validation ou déploiement Unraid des ADR initiales.
- Les sources importées et valeurs annoncées ne deviennent pas des valeurs nutritionnelles calculées. OpenAI est optionnel, produit des brouillons et reçoit le texte de recette, pas les profils du foyer.
