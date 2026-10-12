# Cahier produit Lapinou Dish

## Objectif

Aider un foyer à décider quoi manger, en quelle quantité pour chaque personne, quoi acheter et quoi fabriquer à l'avance. Le logiciel affiche les apports calculés à partir des aliments réellement utilisés et sépare les prévisions de ce qui a été mangé.

Ce produit aide à organiser les repas. Il ne diagnostique pas, ne prescrit pas et ne transforme pas une estimation en conseil médical.

## Personnes et objectifs

- Une personne du foyer est un profil alimentaire; elle n'a pas besoin d'un compte pour être planifiée. Les comptes servent à se connecter, les profils servent à planifier et suivre les personnes.
- Le profil conserve les données nécessaires aux estimations : date de naissance si renseignée, taille, niveau d'activité et historique daté de leurs changements.
- Le poids est saisi par l'utilisateur, avec une date pour chaque relevé. L'interface facilite un relevé hebdomadaire et affiche l'historique sans inventer ni extrapoler de mesures.
- Les besoins quotidiens estimés (dont le maintien énergétique) restent distincts des objectifs choisis ou validés. La méthode, les données d'entrée, l'origine, la date d'effet et l'état de validation sont visibles et historisés.
- Aucun objectif de perte de poids n'est calculé ou proposé automatiquement à un mineur; aucune estimation ne s'applique sans validation de l'utilisateur.
- Les préférences, exclusions et allergies sont des informations distinctes des comptes et permissions.
- Les profils de développement et de test sont synthétiques. Les informations de santé réelles restent hors Git, des images Docker, des journaux et des fixtures.

## Catalogue alimentaire

- Une seule liste globale à l'instance; Ciqual est une source d'import initiale, pas une deuxième base consultée à l'exécution.
- Chaque aliment a un identifiant stable, un nom canonique, des alias, des valeurs nutritionnelles pour 100 g, leur provenance et les champs inconnus explicitement vides.
- Les fiches sont corrigibles; les produits de marque sont ajoutables depuis leur étiquette. Les aliments proches ou doublons sont fusionnables avec historique des références.
- Les équivalences d'unités dépendent de l'aliment: g et ml ne sont pas interchangeables sans densité; une pièce ou une cuillère peut avoir un poids seulement si une équivalence documentée existe.
- Les recettes et recherches utilisent le même identifiant alimentaire et affichent le nom canonique. Aucun champ de nom libre parallèle ne sert au calcul.

## Recettes et composition

- La ligne structurée de recette est: aliment, quantité, unité d'usage, état (cru/sec/cuit si pertinent), composant optionnel et variante optionnelle.
- L'import texte/URL crée un brouillon à examiner. Il ne crée pas silencieusement un aliment ni une correspondance.
- Les calculs nutritionnels proviennent exclusivement des lignes liées au catalogue. Les valeurs importées peuvent être conservées comme référence non vérifiée, jamais comme calcul validé.
- Une recette définit un ou plusieurs rendements explicites: muffin individuel, g de pâte fraîche, nombre de portions ou lot familial. Les variantes, comme avec/sans whey, sont distinctes.
- Un repas combine une ou plusieurs recettes et composants (protéine, féculent, légumes, sauce, dessert, etc.). Un petit déjeuner peut donc être 2 muffins + 100 g de skyr.
- Pour un plat composé, les quantités de chaque composant sont personnalisables indépendamment par personne. Un plat mélangé permet une attribution par poids, pièce ou fraction de rendement.
- Le total préparé, les quantités attribuées et les restes sont visibles et doivent s'équilibrer.

## Planification, consommation et objectifs

- Calendrier hebdomadaire sur écran ordinateur: 7 jours lisibles, créneaux visibles, navigation compacte et résumés par personne. Pas de colonne étroite avec défilement intérieur imbriqué ni de page interminable.
- Ajouter/modifier un repas se fait dans un panneau latéral ou une fenêtre compacte, en gardant la semaine visible.
- Chaque repas indique qui sera présent; le foyer entier n'est jamais supposé automatiquement.
- Le plan affiche par personne les portions et apports nutritionnels prévus, avec indicateurs de complétude et provenance.
- Un geste simple confirme le repas prévu comme consommé ou ajuste chaque item; une collation additionnelle peut être ajoutée rapidement.
- Les totaux réellement consommés sont distincts des objectifs et du plan. Un journal historique conserve un instantané nutritionnel afin qu'une modification ultérieure de recette ne réécrive pas le passé.
- Les propositions de portions sont optionnelles, explicables, modifiables et limitées aux données connues. Elles ne s'appliquent jamais sans validation.

## Production en lots et stocks

- Modes dédiés: usine à petits déjeuners, usine à pâtes fraîches, batch de repas.
- L'utilisateur choisit les recettes/variantes et le rendement visé (ex. 24 muffins ou 1,5 kg de pâte); l'application agrège les besoins d'ingrédients et tient compte du stock confirmé.
- Une session garde cible, quantités réellement produites, date, stockage, emplacement, étiquettes, et consignes de refroidissement/congélation/réchauffage saisies ou validées par l'utilisateur.
- Une production ajoute des lots de stock. Planifier un repas ne consomme pas le stock; seul un acte explicite d'utilisation le décrémente.
- Le stock à utiliser/décongeler prochainement et les écarts de rendement sont visibles.
- La whey est une option explicite d'une recette quand elle est adaptée; elle est traitée comme un ingrédient provenant de l'étiquette, sans promesse de brûle-graisse.

## Courses

- Les besoins de menus et de sessions de production peuvent alimenter une liste de courses, après révision explicite.
- Les mêmes aliments du catalogue sont consolidés; quantité exacte nécessaire et quantité d'achat arrondie au paquet sont distinctes.
- Le stock placard et congélateur confirmé est déduit. Courses de fond (quinzaine) et produits frais de complément peuvent être séparés.
- Une substitution/variante reste visible; aucune liste n'est modifiée en ouvrant simplement un calcul.

## Interface

- Ordinateur en premier, responsive ensuite.
- La page d'accueil répond rapidement à: quoi aujourd'hui, quoi décongeler, quels objectifs restent, prochaine session de production, courses à faire.
- Le calendrier est la vue principale: semaine entière visible à une largeur desktop courante, navigation par semaine, résumés nutritionnels simples et accès direct aux détails.
- Les recettes ont une fiche synthétique et un éditeur structuré. Chaque aliment n'est affiché qu'une fois comme nom canonique; la quantité et l'unité sont dans la même ligne.
- Recherche avant listes longues; filtres utiles et filtres persistants.
- Pas de scroll dans scroll dans les vues de planification. L'information secondaire se replie; les totaux et actions principales restent visibles.

## Jalons de validation

1. **Fondation:** catalogue global, profil synthétique, recette avec lignes alimentaires structurées, calcul nutritionnel vérifiable.
2. **Repas familial:** recette composée, personnes présentes, quantités indépendantes par composant, calendrier semaine desktop sans scroll vertical global.
3. **Journal:** prévu/réel distinct, correction en un geste, historique nutritionnel immuable.
4. **Production:** rendement unitaire, usine petit déjeuner et pâtes, sessions, inventaire congelé.
5. **Courses:** consolidation depuis menu et production avec déduction du stock et arrondi de paquets.

Chaque jalon aura des scénarios d'acceptation exécutables et une validation navigateur avant publication.
