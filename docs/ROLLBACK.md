# Images versionnées et retour arrière

Le mécanisme de publication versionnée a été introduit avec la 0.2.99 ; le code applicatif courant est en **0.3.8**. La 0.3.6 ajoute le regroupement du batch cooking sans migration ; la 0.3.7 ajoute `preparation_stock_counts` pour historiser les comptages physiques. Une ancienne image qui ignore cette table ne tient pas compte des corrections : ne pas considérer un retour vers 0.3.6 comme un retour fonctionnel équivalent après comptage. Les versions 0.3.0 à 0.3.4 ont ajouté des migrations : la compatibilité d’un retour vers 0.2.97 ne doit pas être déduite du seul fait que son image existe.

## Choisir une version

Utiliser une référence explicite à la place de latest, par exemple :

```text
ghcr.io/throlan/lapinou-dish:0.2.97
```

Le préfixe v est aussi disponible : v0.2.97. latest suit les publications de main ; un numéro de version reste attaché à son image déjà publiée. Les tags techniques sha-* restent disponibles pour le diagnostic. La publication fournit les numéros package.json automatiquement et vérifie les alias après écriture.

## Historique conservé

Les cinq versions 0.2.95, 0.2.96, 0.2.97, 0.2.98 et 0.2.99 ont été retrouvées dans GHCR sous leurs tags de commit. Le fichier docker/rollback-images.json conserve leurs digests exacts et révisions, vérifiés avant restauration. Le workflow crée les alias numériques et v sans reconstruire ces anciennes images, puis vérifie leur digest.

Les versions numérotées ne sont pas supprimées automatiquement : cela conserve au minimum les cinq dernières versions publiées, et les précédentes tant qu’aucune purge externe n’intervient. Une republication documentaire de la même version ne remplace pas son image numérotée. Un désaccord entre deux alias existants ou avec une image historique attendue fait échouer la vérification, sans écrasement du numéro. Le workflow sérialise ses publications.

**La 0.2.98 est conservée pour la traçabilité mais contient le blocage de démarrage connu. Préférer 0.2.97 pour un retour arrière, ou 0.2.99 pour le correctif.**

## Application et base de données

Choisir une ancienne image ne restaure pas la base de données et ne doit supprimer aucun volume. Le dépôt ne contient aucune différence de migration SQL ni de script de migration entre les commits livrés 0.2.97 et 0.2.99. Le retour de 0.2.99/0.2.98 à 0.2.97 ne nécessite donc pas de migration inverse connue. Cette constatation ne vaut pas automatiquement pour toutes les futures versions : vérifier leurs migrations et conserver une sauvegarde avant un retour arrière.

L’utilisateur gère seul le déploiement et les sauvegardes. L’agent n’accède jamais à Unraid ni à Nginx.

## Vérification de livraison

Le workflow doit réussir sa dernière étape Preserve versioned images and restore rollback aliases. Son résumé liste les versions et digests. Vérifier aussi les manifests GHCR par tags numériques après livraison. Les documents de reprise et le journal du 23 octobre décrivent la mise en place ; les sources des anciens digests sont enregistrées dans docker/rollback-images.json.

Références : [Docker imagetools create](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/), [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Restauration des alias vérifiée

Livraison vérifiée : PR #135 fusionnée au commit 7af9a023c961637f780157b6665d31110d22be28 ; tests et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/39991969857 . Les dix tags numériques/v des versions 0.2.95 à 0.2.99 ont été vérifiés directement dans GHCR et correspondent aux digests des images d’origine.

## Livraison 0.3.6 vérifiée

PR #149 fusionnée au commit `2359b2d287488e5b429ff5a7f9d3276a9250484a` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41244538868. Les tags `0.3.6` et `v0.3.6` ont été vérifiés directement dans GHCR et pointent vers `sha256:5f57f1c72002ae863f34ab9b82c8995ce93f54eb667bce1c88ddcdcf5d9d57fb`. Aucun changement de migration entre 0.3.5 et 0.3.6.

## Livraison 0.3.7 vérifiée

PR #151 fusionnée au commit `cf5f69f18ab9f9aabc0027a2bd12b5dd2cd0fb61` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41285703265. Tags `0.3.7` et `v0.3.7` vérifiés, digest commun `sha256:406f87c2cf3b61bce67e29f2b61b6d8c7b3588a47af62fc7258e330b083bd651`. Migration additive de comptage physique ; les versions antérieures ignorent ces corrections.

## Migration de la 0.3.8

La 0.3.8 permet les soldes d’ingrédients négatifs sans réécrire les données existantes. Les anciennes versions peuvent à nouveau refuser les productions sur ces soldes. Ne pas rétablir la contrainte SQL de quantité positive tant que des soldes négatifs subsistent ; vérifier les migrations avant tout retour arrière.

## Livraison 0.3.8 vérifiée

PR #153 fusionnée au commit `7fcc8ed34d3277c27a6f7c4c479107ebbef755bb` ; tests GitHub et publication GHCR réussis : https://github.com/throlan/Lapinou-Dish/actions/runs/41293831666. Tags `0.3.8` et `v0.3.8` vérifiés, digest commun `sha256:e7d2a7a5377943b7a3ee38d89ef58d5ffb96b059bb1a35da71de71def2bc7453`.

## Migration de la 0.3.9

La migration additive ajoute les plages des productions et les sorties automatiques par ligne de repas. Les anciennes versions ignorent les plages, les protections des repas déjà utilisés automatiquement et la correction du cumul manuel/automatique. Un retour à une ancienne image après activation ne doit donc pas être supposé compatible avec ces nouveaux usages ; examiner ces données avant de réactiver d’anciens boutons de préparation. Aucun retrait de colonne ni suppression de données n’est nécessaire. Les versions numérotées restent conservées, sans purge automatique (au moins cinq versions).
