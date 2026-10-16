# Lapinou Dish

Application familiale indépendante pour planifier les repas, calculer leur nutrition à partir d'un catalogue alimentaire unique, préparer des lots et suivre les stocks réellement produits et consommés.

Ce dépôt est une application neuve. Il ne dépend pas du code, du schéma, des écrans ou des migrations de Norish. Norish Family reste une installation de test séparée pendant la reconstruction.

## Produit

Lire [le cahier de reprise](docs/REPRISE.md), [l'état actuel](docs/STATUS.md) et [le journal de session](docs/SESSION-2026-10-16.md), puis [le cahier produit](docs/PRODUCT.md), [le modèle métier](docs/DOMAIN.md) et [les décisions techniques](docs/ARCHITECTURE.md).

## Principes

- L'aliment du catalogue est la source unique des noms et données nutritionnelles.
- Une recette contient des références à des aliments, des quantités et des unités structurées. Le texte importé n'est qu'une proposition à valider.
- Toutes les valeurs nutritionnelles sont calculées depuis les ingrédients; une donnée absente reste inconnue.
- Le calendrier suit les apports prévus ; aucune saisie de consommation après repas n’est demandée. Les mouvements de stock restent explicites.
- Le rendement fabriqué, les quantités attribuées et le stock restant doivent toujours se réconcilier.
- Interface d'abord conçue pour ordinateur, compacte, avec calendrier semaine visible sans défilement vertical de page.
- Les données personnelles et médicales réelles ne sont pas des données de développement.

## État

Version applicative de référence : **0.2.72**. Catalogue et recettes, calendrier à cinq créneaux, duplication, desserts/boissons individuels, parties de service en grammes estimés, stocks et courses, profils compacts, objectifs kcal administrables et rééquilibrage avec aperçu sont implémentés. Voir [les règles kcal et portions](docs/MEAL-ENERGY.md).

L'import de texte et d'archives crée des brouillons à vérifier. Avec l'analyse OpenAI optionnelle, un lien Instagram peut permettre de récupérer sa description ; si la lecture est bloquée, coller le texte. Une transcription YouTube doit être fournie. Les ingrédients sont associés au catalogue avant enregistrement et les valeurs nutritionnelles sont recalculées depuis celui-ci.

Le conteneur applique les migrations et le catalogue Ciqual au démarrage. **L'agent ne doit jamais accéder, vérifier, modifier ou déployer sur Unraid ni Nginx ; l'utilisateur effectue lui-même toutes les mises à jour.** La réserve kcal et les occasions sont livrées depuis 0.2.42 ; leur brouillon est une archive. Les prochaines tâches sont dans [TODO.md](docs/TODO.md).

## Démarrage de test avec Docker Compose

Prérequis : Docker avec Compose. Depuis ce dossier, crée un fichier `.env` à partir de l'exemple :

```powershell
Copy-Item .env.example .env
notepad .env
docker compose up -d --build
```

Remplace les deux exemples par des mots de passe longs et différents. L'application refuse un mot de passe de moins de 12 caractères. Ouvre ensuite `http://localhost:3000` et connecte-toi avec `APP_PASSWORD`. PostgreSQL reste sur le réseau Docker et ses données persistent dans le volume `lapinou_db`.

```powershell
docker compose logs -f app
docker compose down       # arrête les services, garde la base
docker compose down -v    # supprime aussi les données de la base
```

La dernière commande est destructive pour les données locales. Pour le déploiement Unraid, voir [le guide](docs/UNRAID.md). Le dépôt GitHub et l'image GHCR sont publics; le téléchargement anonyme de `ghcr.io/throlan/lapinou-dish:latest` a été vérifié.

## Développement sans Docker

Prérequis : Node.js 24+, npm et PostgreSQL 16+ accessible. Crée une base vide dédiée, renseigne `DATABASE_URL`, puis :

```powershell
npm install
npm run migrate
npm run seed:ciqual
npm start
```

Avant de démarrer l'API, définis `APP_PASSWORD` (12 caractères minimum). Pour charger les données Ciqual, exécute le script d'import automatisé après les migrations :

```powershell
$env:DATABASE_URL = "postgres://lapinou:mot-de-passe@localhost:5432/lapinou_dish"
node scripts/seed-database.mjs
```

Les migrations et l'import Ciqual sont relancés sans créer de doublons. Les modifications manuelles au catalogue sont protégées lors d'une mise à jour du jeu Ciqual.

## Vérification

```powershell
npm test
```

La version 0.2.41 passe **138 tests**, dont des intégrations PostgreSQL/PGlite avec les migrations et requêtes réelles. Les parcours ont aussi été vérifiés dans Chrome sur données synthétiques. Aucun contrôle de l'installation Unraid de l'utilisateur n'a été réalisé par l'agent.
