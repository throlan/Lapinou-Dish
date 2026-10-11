# Installation Unraid (premier déploiement)

Les deux templates installent deux conteneurs séparés : `lapinou-dish-db` pour PostgreSQL et `lapinou-dish` pour l'application. Ils sont tous les deux connectés au réseau Docker partagé `proxy-net`; la base n'expose aucun port sur l'hôte. Les données de PostgreSQL sont stockées sous `/mnt/user/appdata/lapinou-dish/postgres`.

## Préparer l'image

Le dépôt public `throlan/Lapinou-Dish` publie l'image `ghcr.io/throlan/lapinou-dish:latest` après chaque push sur `main`. Le workflow a réussi : tests et publication de l'image sont terminés. Les templates pointent vers ce dépôt.

Le dépôt et le package GHCR sont publics. Un téléchargement anonyme du manifeste `latest` a répondu `HTTP 200`; Unraid peut donc tirer l'image sans identifiants de registre. Les images publiques GHCR peuvent être tirées sans connexion; une image privée nécessite une authentification et un droit de lecture du package. [Documentation GitHub sur la visibilité des packages](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).

## Installer les templates

1. Vérifie que le réseau Docker partagé existe : `docker network inspect proxy-net`. Il doit exister avant de charger les templates; sélectionne `Custom: proxy-net` comme « Network Type » pour chacun des deux conteneurs. Si Unraid affiche `None`, ne valide pas encore le formulaire : le conteneur serait isolé et ne pourrait pas joindre l'autre. Les réseaux personnalisés Unraid doivent être recréés si le fichier image Docker est reconstruit. [Documentation Unraid sur la restauration des réseaux personnalisés](https://docs.unraid.net/unraid-os/troubleshooting/common-issues/docker-troubleshooting/).
2. Télécharge les deux XML bruts depuis GitHub vers `/boot/config/plugins/dockerMan/templates-user/` (par SMB sur le partage `flash` ou avec `curl` dans le terminal Unraid). Ouvre Docker → Add Container, puis choisis chacun dans la liste « User Templates ». Le champ `TemplateURL` de chaque XML permettra ensuite à Unraid de récupérer les mises à jour du modèle. [Guide Unraid sur les templates](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/).
3. Pour PostgreSQL, choisis un mot de passe robuste dans `POSTGRES_PASSWORD` et conserve-le dans un gestionnaire de mots de passe. Laisse le chemin de données sur `/mnt/user/appdata/lapinou-dish/postgres`.
4. Pour l'application, saisis exactement le même `DB_PASSWORD`; choisis un `APP_PASSWORD` distinct d'au moins 12 caractères. Garde `DB_HOST=lapinou-dish-db`, le réseau `proxy-net` et le port web `3000` (ou modifie le port hôte). Si un champ de mot de passe masqué apparaît vide en modifiant un conteneur, ressaisis sa valeur actuelle avant d'appliquer.
5. Démarre d'abord PostgreSQL et attends son état healthy/démarré, puis démarre l'application. Au premier démarrage, elle attend la base, applique les migrations, importe les 3 484 aliments Ciqual et démarre le serveur. Consulte le journal du conteneur pour voir ces étapes.
6. Ouvre `http://<IP-UNRAID>:3000` et connecte-toi avec `APP_PASSWORD`.

Les mises à jour remplacent le conteneur applicatif et préservent le volume PostgreSQL. Ne supprime pas le dossier appdata lors d'une mise à jour. Fais une sauvegarde cohérente de PostgreSQL avant une mise à jour majeure ou une manipulation de la base. Le mot de passe PostgreSQL est lu lors de l'initialisation initiale : changer ensuite la variable dans le template ne change pas le mot de passe du rôle déjà créé.

Le service n'intègre pas encore de TLS. Pour l'accès extérieur au réseau domestique, utilise un reverse proxy HTTPS correctement configuré ou un VPN; n'expose pas directement ce port HTTP sur Internet.

## État du guide

Le dépôt et le workflow sont actifs, et l'image est publiquement téléchargeable sans authentification. L'installation réelle et les migrations restent à valider sur le serveur Unraid.
