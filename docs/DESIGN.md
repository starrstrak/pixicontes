# Design system et écrans

**Principes** : chaleureux, ludique, très lisible. Une icône + un mot par action, zones tactiles ≥ 56 px, 4 espaces seulement (Nouvelle histoire, Mes histoires, Mes personnages, Réglages), aucune navigation profonde.

| Élément | Valeur |
|---|---|
| Direction | Sobre, graphique, moderne, façon Spotify / Audible : étagères horizontales, grandes pochettes, lecteur « en cours de lecture ». Inspirée de la référence lavande / rose poudré (formes organiques, boutons charbon en pilule, titres serif) |
| Couleurs jour | fond `#f3f2fa`, cartes blanches, encre `#22233a`, lavande `#a3a3e8`, action `#6a6ad0`, rose poudré `#eab3a8`, charbon `#2a2b3d` (boutons) |
| Mode nuit | fond `#13142a`, cartes `#1f2040`, encre `#eeeefb`, boutons clairs |
| Typographie | Titres Merriweather (serif), texte Nunito ; options Atkinson Hyperlegible et OpenDyslexic ; taille réglable 90 %–150 % |
| Formes | rayons 18–34 px, ombres très douces, blobs organiques en arrière-plan des bandeaux et des tuiles de genre |
| Icônes | jeu d'icônes trait 2.2 px cohérent, un pictogramme dessiné par genre ; emojis limités aux choix visuels du héros et aux propositions de l'IA |
| Mascotte | Pixi : blob lavande à cornes, aplats, yeux blancs, joues rose poudré ; états repos, joie, réflexion, sommeil |
| Navigation | barre flottante en pilule (portrait) / rail latéral (paysage), 4 espaces, état actif en pastille |
| Lecteur | pochette d'illustration, chapitres numérotés, propositions en « pistes » façon playlist, barre sombre en bas avec précédent / lecture / suivant / vitesse et progression |
| Mouvement | slide-up du lecteur, propositions qui apparaissent en cascade, micro qui pulse, onde sonore, placeholder d'image qui ondule ; désactivé si `prefers-reduced-motion` |
| Accessibilité | contraste élevé en option, libellés ARIA, focus visible, zones tactiles ≥ 56 px, paysage et portrait |

Les composants sont définis dans `frontend/src/styles.css`. Écrans clés (captures réelles de l'application, avec un faux serveur d'IA, donc image de chapitre vide) :

| | |
|---|---|
| ![Accueil](screens/accueil.png) Choix du genre (paysage) | ![Héros](screens/creation-heros.png) Création du héros |
| ![Lecteur](screens/lecteur.png) Lecteur et co-création | ![Réglages](screens/reglages-portrait.png) Réglages enfant (portrait) |
| ![Admin](screens/admin.png) Espace parent | ![Bibliothèque](screens/bibliotheque.png) Mes histoires |

> Note de méthode : la consigne demandait une maquette avant l'implémentation. Ici, le design system (tokens + composants) a été écrit en premier, puis les écrans ont été construits directement dessus ; ces captures en tiennent lieu de maquette finale. Dites-moi si vous voulez des retouches visuelles.
