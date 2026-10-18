# Identité Lapinou Dish — 0.2.90

Adaptation du lapin du logo fourni par l’utilisateur (`lapinouhome_litefin_icon.png`). Outil intégré **image_gen**, sans clé API ni génération depuis l’application. Le personnage est repris avec une cocotte framboise ; les mots et symboles du lecteur vidéo sont retirés. Le fichier original de l’utilisateur n’est pas modifié.

Masters : `lapinou-dish-master.png` et `lapinou-dish-maskable-master.png`. Exports PNG par réduction Lanczos : `app-192.png`, `app-512.png`, `app-maskable-512.png`, `apple-touch-icon.png` (180), `favicon-32.png`. Le master adaptatif conserve une marge de sécurité pour les découpes Android ; ne pas étirer le lapin pour remplir un cercle.

## Prompt de l’icône principale

```text
Use case: precise-object-edit / logo-brand. Create one polished square app icon for Lapinou Dish, a household cooking app. Input image 1 is the user's own logo and the rabbit identity reference: preserve that recognizable cute white rabbit's face, huge expressive glossy eyes, violet pink nose, smile, whiskers, little tuft, one upright and one floppy ear, little paws. Reuse this exact character identity, do not invent another rabbit. Replace the media-player triangle, motion stripes and every word of Litefin/Jellyfin with a clean culinary motif: rabbit peeking over one simple elegant raspberry-colored cooking pot, paws resting on its rim. No chef hat obscuring the distinctive ears. Refined soft 3D illustration, friendly and cool, not cluttered, high quality app branding. Full bleed opaque deep ink-purple background #29243e with subtle raspberry #982661 glow; white rabbit, raspberry and soft pink accents, tiny cyan/violet glints in eyes allowed to retain the reference personality. This should complement a light raspberry culinary magazine UI. Square 1024x1024 master, flat full-bleed background to the edges (NOT an image of a rounded-square icon on a surrounding canvas). Put ALL important subject details including both ears, pot and whiskers inside the central 70 percent of the square, with generous padding for circular and rounded adaptive masks; background fills entire square. No text, no letters, no watermark, no player triangle, no neon border, no gradients outside the canvas, no extra objects.
```

## Prompt du master adaptatif

Référence : l’icône principale générée ci-dessus.

```text
Edit target: supplied Lapinou Dish rabbit and raspberry cooking pot app icon. Change ONLY composition scale: zoom out so the same rabbit and pot together occupy at most the central 62 percent of the square's width and height, centered horizontally and vertically. Preserve exactly the rabbit identity, facial features, pot, colors, 3D illustration and lighting. Extend the existing deep ink-purple and raspberry softly glowing background seamlessly to fill ALL edges of the square. This is an Android maskable icon: all ears, whiskers, pot handles and bottom must be well inside the centered circle of radius 40% canvas width. Generous empty background padding on all four sides. No extra object, no text, no border, NO inner tile, NO visible rectangle or square behind the mascot, no rounded corners, no inset card. Full bleed continuous purple background with the mascot comfortably smaller in its center.
```
