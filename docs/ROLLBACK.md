# Images versionnées et retour arrière

L’application reste en **0.2.99** : cette modification concerne la publication, pas les fonctions ni les données.

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
