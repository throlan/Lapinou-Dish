# Décisions techniques initiales

## Suivi automatique — 0.17.0

La migration additive 20261119_automatic_activity.sql crée person_automatic_profiles (faits médicaux privés datés), person_automatic_state (empreinte et résultat courant), person_activity_plans (disponibilités datées) et person_activity_sessions (réalisé, annulation conservée). Les cibles calculées sont ajoutées à person_nutrition_goals avec origine estimate, version de modèle et questionnaire contenant entrées/résultat/sources. Les historiques antérieurs ne sont pas modifiés.

Le serveur calcule avec web/automatic-nutrition.js, partagé et déterministe. Verrou par personne dans la transaction de requête ; empreinte du résultat et période mensuelle pour éviter les répétitions. Recalcul après enregistrement des faits/pesées/objectifs/profil et à la lecture des profils pour les anniversaires et données devenues applicables. Les POST d’activité utilisent une clé de requête UUID : même contenu rejoué sans doublon, contenu différent refusé. API et RLS limitent les faits médicaux, programmes et séances à la personne concernée ou au gestionnaire de son foyer.

web/automatic-profile-ui.js est commun à Mon compte et Administration, remplace les formulaires nutritionnels manuels et distingue prévu/réalisé. web/activity-model.js calcule localement la projection réduite Hall ; aucune donnée de santé envoyée à une API extérieure. Les cibles peuvent changer automatiquement ; les rééquilibrages des quantités de menus restent volontaires. Modèles et limites : [ACTIVITE-PROJECTION.md](ACTIVITE-PROJECTION.md).


## Cibles nutritionnelles — 0.15.0

person_nutrition_goals conserve les cibles kcal/protéines confirmées, leurs dates d’effet, origine, méthode, poids de référence et ordre de révision. Les anciennes données restent conservées ; la table initiale nutrition_targets reste historique et n’est pas le support du nouveau formulaire. La vue effective_energy_history réunit les calories historiques et les nouvelles cibles avec priorité déterministe. Les droits du profil sont appliqués dans la passerelle API et par RLS.

web/nutrition-goals.js partage entre Administration et Mon compte l’estimation générale documentée, les bilans mensuels et l’aperçu de validation. Le calendrier et le serveur lisent la cible applicable à la date. Les protéines restent indicatives ; aucune réécriture de menu ni action sur stock. Le bilan suit les anniversaires mensuels de la première pesée et le seuil ±5 kg depuis le poids de référence validé. Aucun calcul ne devient une cible automatiquement.

État : les ADR initiales ci-dessous sont historiques ; les décisions appliquées plus bas font autorité.

Les ADR initiales ci-dessous gardent leur contexte historique. L'implémentation actuelle est décrite dans [STATUS.md](STATUS.md) et les décisions de session ci-après ; l'agent ne doit jamais accéder ni intervenir sur Unraid.

## Architecture actuelle — 0.13.1

Node.js 24+, serveur HTTP monolithique, modules métier JavaScript et domaine TypeScript natif ; interface HTML/CSS/JavaScript sans framework. PostgreSQL via `pg`, migrations SQL explicites et tests PGlite ; aucun ORM. Comptes individuels et appartenances aux foyers privés livrés, avec rôles global et par foyer, profils pouvant rester sans compte, contrôles API et isolation SQL. Recettes modulables par listes de choix, instantanés des combinaisons utilisées, quantités individuelles, rééquilibrage journalier avec aperçu, stocks de préparations et batch cooking sont livrés. Images dans un dossier configurable avec repli PostgreSQL. GitHub Actions teste les PR puis publie sur GHCR après fusion sur main. Les propositions historiques de framework/ORM ne sont plus des tâches ouvertes. Aucun accès de l’agent à Unraid ni à Nginx.

L’audit de la 0.13.1 a constaté **460 tests locaux réussis** et **63 migrations** exécutées sur une base PGlite fictive vide, donnant **58 tables**. Les profils possèdent déjà date de naissance, relevés de poids, taille, activité et cible kcal avec origine et méthode. Une correction du profil à la même date remplace actuellement l’entrée. `nutrition_targets` existe en base mais n’est pas utilisé par les écrans ou les calculs. Les minima protéiques sont enregistrés dans les réglages du foyer ; certains chemins de secours les relient encore au prénom. Aucun estimateur Mifflin–St Jeor n’est livré. Les lots de développement prévus sont détaillés dans [TODO.md](TODO.md).

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
- À la date de cette décision (13 octobre), Administration utilisait une session de foyer. Depuis 0.4.0, les comptes individuels, l’administrateur global et les rôles de foyer sont livrés ; cette phrase est conservée comme historique.
- Livraison : GitHub/CI/GHCR seulement dans le périmètre de l'agent. L'utilisateur applique lui-même les mises à jour sur son installation. Cette règle prévaut sur les anciennes intentions de validation ou déploiement Unraid des ADR initiales.
- Les sources importées et valeurs annoncées ne deviennent pas des valeurs nutritionnelles calculées. OpenAI est optionnel, produit des brouillons et reçoit le texte de recette, pas les profils du foyer.
