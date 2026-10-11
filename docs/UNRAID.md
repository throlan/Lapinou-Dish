# Installation Unraid (premier déploiement)

Les deux templates installent deux conteneurs séparés : `lapinou-dish-db` pour PostgreSQL et `lapinou-dish` pour l'application. La base n'expose aucun port sur le réseau local; l'application la joint sur le réseau Docker privé `lapinou-dish`. Les données de PostgreSQL sont stockées sous `/mnt/user/appdata/lapinou-dish/postgres`.

## Préparer l'image

Le workflow GitHub Actions teste le code puis publie l'image `ghcr.io/<propriétaire>/<dépôt>:latest` après chaque push sur la branche principale. Les templates sont préremplis avec `throlan/Lapinou-Dish`; vérifie que le dépôt GitHub porte bien ce nom avant la première publication. Si le nom est différent, adapte aussi l'image et les liens `Project`, `ReadMe` et `TemplateURL` du template.

Après la première exécution du workflow, ouvre les paramètres du package Container dans GitHub et règle sa visibilité sur Public pour qu'Unraid puisse télécharger l'image sans identifiants. Les images publiques GHCR peuvent être tirées sans connexion; une image privée nécessite une authentification et un droit de lecture du package. [Documentation GitHub sur la visibilité des packages](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).

## Installer les templates

1. Dans le terminal Unraid, crée le réseau Docker une fois : `docker network create lapinou-dish`. Ce réseau doit exister avant d'installer les templates; les réseaux Docker personnalisés Unraid doivent être recréés si le fichier image Docker est reconstruit. [Documentation Unraid sur la restauration des réseaux personnalisés](https://docs.unraid.net/unraid-os/troubleshooting/common-issues/docker-troubleshooting/).
2. Une fois le dépôt public, télécharge les deux XML bruts depuis GitHub vers `/boot/config/plugins/dockerMan/templates-user/` (par SMB sur le partage `flash` ou avec `curl` dans le terminal Unraid). Ouvre Docker → Add Container, puis choisis chacun dans la liste « User Templates ». Le champ `TemplateURL` de chaque XML permettra ensuite à Unraid de récupérer les mises à jour du modèle. [Guide Unraid sur les templates](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/).
3. Pour PostgreSQL, choisis un mot de passe robuste dans `POSTGRES_PASSWORD` et conserve-le dans un gestionnaire de mots de passe. Laisse le chemin de données sur `/mnt/user/appdata/lapinou-dish/postgres`.
4. Pour l'application, saisis exactement le même `DB_PASSWORD`; choisis un `APP_PASSWORD` distinct d'au moins 12 caractères. Garde `DB_HOST=lapinou-dish-db`, le réseau `lapinou-dish` et le port web `3000` (ou modifie le port hôte).
5. Démarre d'abord PostgreSQL et attends son état healthy/démarré, puis démarre l'application. Au premier démarrage, elle attend la base, applique les migrations, importe les 3 484 aliments Ciqual et démarre le serveur. Consulte le journal du conteneur pour voir ces étapes.
6. Ouvre `http://<IP-UNRAID>:3000` et connecte-toi avec `APP_PASSWORD`.

Les mises à jour remplacent le conteneur applicatif et préservent le volume PostgreSQL. Ne supprime pas le dossier appdata lors d'une mise à jour. Fais une sauvegarde cohérente de PostgreSQL avant une mise à jour majeure ou une manipulation de la base. Le mot de passe PostgreSQL est lu lors de l'initialisation initiale : changer ensuite la variable dans le template ne change pas le mot de passe du rôle déjà créé.

Le service n'intègre pas encore de TLS. Pour l'accès extérieur au réseau domestique, utilise un reverse proxy HTTPS correctement configuré ou un VPN; n'expose pas directement ce port HTTP sur Internet.

## État du guide

Les templates et le workflow sont prêts dans le dépôt de travail, mais les URL et le nom d'image présument `throlan/Lapinou-Dish`. Aucun remote GitHub n'est encore configuré et l'image n'a pas encore été publiée. L'installation réelle reste à valider après publication du dépôt et du premier package.
