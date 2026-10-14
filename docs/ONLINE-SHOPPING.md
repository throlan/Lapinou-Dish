# Courses par magasin et achats en ligne

Dans **Courses & stocks → Magasins et achats en ligne**, ajouter un nom. Le site HTTPS est facultatif : Grand Frais, Aldi ou Carrefour Market peuvent donc être des magasins physiques ; Nutripure et les autres boutiques en ligne conservent leur lien. Les boutiques déjà enregistrées restent disponibles.

Ouvrir **Associer les aliments aux magasins** pour rechercher et sélectionner les aliments d'un magasin habituel. Une affectation s'applique à toutes les périodes et unités de l'aliment dans ce foyer. Dans la liste de courses, **Détails et réglages** permet aussi de changer le magasin, la catégorie ou le format d'achat. Sans magasin, l'article reste dans la liste **Sans magasin**. La suppression d'un magasin retire seulement les affectations de ses aliments.

La liste prend toute la largeur de la page et se regroupe par magasin. Le filtre affiche un seul magasin ou tous. La ligne montre d'abord la quantité à acheter ; le détail conserve le besoin issu des recettes. Les cases cochées sont exclues de l'export. **Copier** place la liste du magasin dans le presse-papiers ; **Télécharger** produit un fichier texte par magasin. Les quantités de recettes, les stocks et les calculs nutritionnels ne sont pas changés par la présentation d'achat.

## Unités d'achat indicatives

- Ail à la pièce : la pièce du catalogue correspond à une **gousse**. La liste propose une tête pour neuf gousses indicatives ; trois gousses donnent environ un tiers de tête. La quantité de gousses nécessaire reste visible.
- Basilic à la pièce : le libellé d'achat est **bouquet**. Si la recette donne des grammes, la liste propose **un bouquet minimum** et affiche le besoin en grammes ; vérifier qu'il suffit, car son poids n'est pas déduit de la recette.
- Gingembre en grammes : une racine est estimée à **65 g**, au milieu de la fourchette indicative **50 à 80 g** donnée par l'utilisateur. Le nombre de racines est arrondi vers le haut et le besoin exact en grammes reste visible.

Ces libellés ne modifient pas les conversions nutritionnelles. Un format d'achat saisi manuellement sur la ligne prend priorité sur ces suggestions.

Dans **Détails et réglages** de l'article, **Unité d’achat personnalisée** permet de choisir le nom au singulier et au pluriel, puis la quantité couverte par une unité achetée. Par exemple, « sachet / sachets » couvrant 500 g transforme un besoin de 600 g en **2 sachets** ; le besoin initial reste affiché. On peut enregistrer une estimation pour chaque aliment du foyer, puis revenir à la suggestion par défaut. Pour un bouquet de basilic demandé en grammes, renseigner soi-même son poids approximatif : aucun poids de bouquet n'est supposé automatiquement.

Lorsque plusieurs recettes demandent le même aliment dans des unités différentes, la liste les regroupe si le catalogue connaît leur conversion. Si cette conversion manque, les lignes restent séparées et un avertissement indique laquelle manque. Ces réglages agissent uniquement sur la présentation et les exports de courses ; ils ne changent ni la recette ni sa nutrition. Un ancien format de paquet enregistré sur la ligne reste prioritaire jusqu'à ce qu'il soit effacé.

## Home Assistant

L'application peut envoyer les articles non cochés dans une liste `todo` distincte par magasin. Dans Home Assistant, créer une liste via **Local to-do** pour chaque magasin et relever son identifiant, par exemple `todo.grand_frais`. Dans Lapinou Dish, ouvrir **Home Assistant** sur la ligne du magasin, saisir cet identifiant et enregistrer. Le bouton **Envoyer à Home Assistant** apparaît alors dans sa liste de courses.

Le processus applicatif doit recevoir `HOME_ASSISTANT_URL` (URL de base accessible depuis l'application) et `HOME_ASSISTANT_TOKEN` (jeton d'accès longue durée) par variables d'environnement. Garder le jeton côté serveur, hors Git et hors navigateur. Le bouton d'export signale l'absence de configuration. L'export lit d'abord les articles ouverts avec `todo.get_items`, puis utilise `todo.add_item` pour les lignes absentes ; une répétition avec les mêmes intitulés n'ajoute pas de doublon. Il ne supprime ni ne coche d'éléments existants. Si la quantité change, le nouvel intitulé est ajouté et l'ancien reste à gérer dans Home Assistant.

L'API officielle des listes Alexa a été arrêtée le 1er juillet 2024. Lapinou Dish ne promet donc pas d'envoi direct vers des listes Alexa : utiliser **Copier** ou **Télécharger** pour partager la liste par magasin.

## Technique

- La migration `20261014_physical_stores.sql` rend l'URL facultative et ajoute la cible Home Assistant par magasin, en préservant les liens existants.
- La migration `20261014_purchase_units.sql` conserve les unités d'achat personnalisées par foyer et aliment.
- Les affectations restent protégées par foyer et la suppression d'un magasin conserve les aliments et leurs besoins.
- L'export est une route authentifiée, limitée à la période demandée et aux articles du magasin du foyer ; le jeton Home Assistant n'est jamais envoyé au client.
- Tests PGlite, tests des unités d'achat et de l'API Home Assistant simulée ; parcours Chrome local ordinateur et mobile sur données fictives.
