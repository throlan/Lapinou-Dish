# Import de recettes avec OpenAI

Dans Recettes → Importer des recettes, cocher « Analyser avec OpenAI » et coller un lien de publication ou reel Instagram. L'application tente de récupérer la légende publique, puis appelle l'API OpenAI pour créer un brouillon. La légende peut être inaccessible ou tronquée : dans ce cas aucun appel OpenAI n'est effectué et le texte doit être collé. YouTube nécessite toujours le texte ou une transcription.

L'analyse conserve le texte original, distingue les ingrédients communs des variantes et laisse les quantités, unités et rendements inconnus à préciser. Les variantes figurent dans les instructions et doivent être choisies puis ajoutées aux ingrédients avant enregistrement. Les calories annoncées par l'auteur ne sont pas importées : le calcul utilise les aliments du catalogue. Le format structuré et les contrôles locaux ne garantissent pas l'exactitude de l'interprétation : vérifier le brouillon reste nécessaire.

## Configuration à réaliser par le propriétaire

- `OPENAI_API_KEY` : clé API dans l'environnement du serveur uniquement, jamais dans Git, le navigateur ou une conversation.
- `OPENAI_RECIPE_MODEL` : `gpt-4.1-mini` par défaut, modifiable pour un modèle accessible au compte et compatible avec Responses et Structured Outputs.
- `OPENAI_IMAGE_MODEL` : `gpt-image-2.5-sunburst` par défaut, utilisé séparément pour créer les illustrations des recettes. Le modèle doit être autorisé pour le projet associé à `OPENAI_API_KEY`.

Le fichier `.env.example` et Compose déclarent ces variables facultatives. Sans clé, l'import classique par texte et archives fonctionne normalement. Le processus Node lit son environnement ; il ne charge pas lui-même un fichier `.env`.

Les photos personnelles et illustrations sont stockées dans `RECIPE_IMAGE_DIR`. Compose monte un volume dédié à cet emplacement. Le template Unraid monte `/mnt/user/appdata/lapinoudish/images` vers `/images`; conserve ce mapping et sauvegarde ce dossier. Au premier démarrage avec le dossier configuré, les images déjà enregistrées dans PostgreSQL y sont déplacées automatiquement. Si le dossier n'est pas configuré, l'application conserve le stockage PostgreSQL existant.

Une erreur API `403 model_not_found` n'indique pas un problème de sauvegarde locale : vérifie que `OPENAI_IMAGE_MODEL` est l'identifiant exact d'un modèle image disponible dans le projet auquel appartient la clé. La page officielle de génération d'images liste les modèles et les noms acceptés par l'API. Changer `OPENAI_RECIPE_MODEL` ne modifie pas le modèle utilisé pour les images.

Une analyse utilise l'API payante du propriétaire. Seul le texte de la recette est envoyé à OpenAI, avec `store: false` ; aucune donnée de profil ou de planning n'est transmise. `store: false` ne constitue pas une garantie d'absence de toute rétention par le fournisseur. L'appel est limité à 30 000 caractères et 6 000 tokens de sortie, sans nouvelle tentative automatique. Une seule analyse simultanée est acceptée par foyer. Les limites et crédits se configurent également sur la plateforme OpenAI.

## Vérification

Tests automatisés avec des réponses OpenAI simulées : schéma, ingrédients cités dans le texte, erreurs, refus, sortie incomplète, variantes, unités inconnues, légende inaccessible, redirections, taille maximale et sauvegarde PostgreSQL. Aucun compte réel ni serveur Unraid n'est utilisé par ces tests. L'appel réel au modèle et l'accès au post Instagram doivent être vérifiés après configuration par le propriétaire.

Documentation officielle : [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [API Quickstart](https://developers.openai.com/api/docs/quickstart).
