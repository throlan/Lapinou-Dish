# Lapinou Dish

Application familiale indépendante pour planifier les repas, calculer leur nutrition à partir d'un catalogue alimentaire unique, préparer des lots et suivre les stocks réellement produits et consommés.

Ce dépôt est une application neuve. Il ne dépend pas du code, du schéma, des écrans ou des migrations de Norish. Norish Family reste une installation de test séparée pendant la reconstruction.

## Produit

Lire [le cahier produit](docs/PRODUCT.md), [le modèle métier](docs/DOMAIN.md) et [les décisions techniques](docs/ARCHITECTURE.md).

## Principes

- L'aliment du catalogue est la source unique des noms et données nutritionnelles.
- Une recette contient des références à des aliments, des quantités et des unités structurées. Le texte importé n'est qu'une proposition à valider.
- Toutes les valeurs nutritionnelles sont calculées depuis les ingrédients; une donnée absente reste inconnue.
- Le plan et la consommation réelle sont deux enregistrements distincts.
- Le rendement fabriqué, les quantités attribuées et le stock restant doivent toujours se réconcilier.
- Interface d'abord conçue pour ordinateur, compacte, avec calendrier semaine visible sans défilement vertical de page.
- Les données personnelles et médicales réelles ne sont pas des données de développement.

## État

Le premier parcours catalogue → recette → calcul est en place : interface de bureau, aliments consultables/modifiables, création d'aliments manuels et de recettes structurées. Le conteneur applique les migrations et le catalogue Ciqual à son premier démarrage. Aucun service Unraid existant n'est modifié par ce dépôt.

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

La dernière commande est destructive pour les données locales. Pour le déploiement Unraid, voir [le guide](docs/UNRAID.md). Il demande un dépôt GitHub et une image GHCR publiés avant d'installer les templates. Le dépôt n'a pas encore de remote GitHub configuré, donc aucun registre ni serveur Unraid n'a été contacté.

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

Le contrôle actuel couvre le calcul nutritionnel, l'import Ciqual et l'API avec une base simulée. Le démarrage réel contre PostgreSQL et l'installation sur Unraid doivent encore être exécutés sur une machine qui dispose de Docker/PostgreSQL.
