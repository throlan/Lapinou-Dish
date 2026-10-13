# Import de recettes avec OpenAI

Dans Recettes → Importer des recettes, cocher « Analyser avec OpenAI » et coller un lien de publication ou reel Instagram. L'application tente de récupérer la légende publique, puis appelle l'API OpenAI pour créer un brouillon. La légende peut être inaccessible ou tronquée : dans ce cas aucun appel OpenAI n'est effectué et le texte doit être collé. YouTube nécessite toujours le texte ou une transcription.

L'analyse conserve le texte original, distingue les ingrédients communs des variantes et laisse les quantités, unités et rendements inconnus à préciser. Les variantes figurent dans les instructions et doivent être choisies puis ajoutées aux ingrédients avant enregistrement. Les calories annoncées par l'auteur ne sont pas importées : le calcul utilise les aliments du catalogue. Le format structuré et les contrôles locaux ne garantissent pas l'exactitude de l'interprétation : vérifier le brouillon reste nécessaire.

## Configuration à réaliser par le propriétaire

- `OPENAI_API_KEY` : clé API dans l'environnement du serveur uniquement, jamais dans Git, le navigateur ou une conversation.
- `OPENAI_RECIPE_MODEL` : `gpt-4.1-mini` par défaut, modifiable pour un modèle accessible au compte et compatible avec Responses et Structured Outputs.

Le fichier `.env.example` et Compose déclarent ces variables facultatives. Sans clé, l'import classique par texte et archives fonctionne normalement. Le processus Node lit son environnement ; il ne charge pas lui-même un fichier `.env`.

Une analyse utilise l'API payante du propriétaire. Seul le texte de la recette est envoyé à OpenAI, avec `store: false` ; aucune donnée de profil ou de planning n'est transmise. `store: false` ne constitue pas une garantie d'absence de toute rétention par le fournisseur. L'appel est limité à 30 000 caractères et 6 000 tokens de sortie, sans nouvelle tentative automatique. Une seule analyse simultanée est acceptée par foyer. Les limites et crédits se configurent également sur la plateforme OpenAI.

## Vérification

Tests automatisés avec des réponses OpenAI simulées : schéma, ingrédients cités dans le texte, erreurs, refus, sortie incomplète, variantes, unités inconnues, légende inaccessible, redirections, taille maximale et sauvegarde PostgreSQL. Aucun compte réel ni serveur Unraid n'est utilisé par ces tests. L'appel réel au modèle et l'accès au post Instagram doivent être vérifiés après configuration par le propriétaire.

Documentation officielle : [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [API Quickstart](https://developers.openai.com/api/docs/quickstart).
