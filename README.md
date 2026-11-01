<p align="center"><img src="frontend/public/brand/logo-full.png" alt="PixiContes" width="360"></p>

# PixiContes

Application familiale de création d'histoires pour un enfant de 8 ans. L'enfant choisit un genre, l'IA écrit le début, puis **l'enfant devient l'auteur** : il crée ses personnages, choisit ou invente la suite, change un détail, demande une surprise. Tout se fait au toucher, à la voix ou au clavier, en français (allemand et anglais en option, niveau A1), sur tablette Android ou navigateur.

**Local d'abord** : le serveur tourne sur votre PC ou mini-serveur ; histoires, personnages, images, audios et réglages restent dans le dossier `data/`. Seules les générations passent par l'API OpenAI avec **votre** clé, saisie dans l'espace parent et gardée côté serveur (chiffrée, jamais envoyée au navigateur ni au dépôt). Aucune télémétrie, aucun compte, aucune pub.

## Installation en moins de 10 minutes (sans être développeur)

1. **Installer Node.js** (version 22.5 ou plus récente, « LTS ») depuis <https://nodejs.org>. Validez toutes les options par défaut.
2. **Récupérer le projet** : sur GitHub, bouton vert *Code → Download ZIP*, décompressez-le ; ou `git clone` si vous connaissez.
3. **Ouvrir un terminal dans le dossier** (Windows : clic droit dans le dossier → *Ouvrir dans le terminal* ; Mac : clic droit → *Nouveau terminal au dossier*) puis taper :
   ```bash
   npm run start
   ```
   La première fois, l'installation et la construction prennent 1 à 3 minutes. Quand vous voyez « 🐉 PixiContes est prêt », ouvrez <http://localhost:8080>.
   *(Alternative Docker : `docker compose up -d`.)*
4. **Espace parent** : **appui long (≈ 1 seconde et demie) sur le logo** en haut de l'écran. À la première fois, choisissez un code PIN (4 à 8 chiffres) : gardez-le pour vous.
5. **Clé API** : dans *Clé & modèles*, collez votre clé OpenAI (`sk-…`, à créer sur <https://platform.openai.com/api-keys> avec un crédit de quelques dollars), **Enregistrer la clé**, puis **Tester la clé**. Réglez aussi le **plafond mensuel** (5 $ par défaut) dans *Limites*.
6. **Voilà** : quittez l'espace parent (cadenas), et l'enfant peut créer sa première histoire.

Arrêt : `Ctrl + C` dans le terminal. Les données sont conservées. Sauvegarde complète : `npm run backup` (ou *Gestion* dans l'espace parent).

## Utilisation sur la tablette Android (PWA)

1. PC et tablette sur le **même wifi**. Notez l'adresse IP du PC (Windows : `ipconfig`, Mac/Linux : `ifconfig`), p. ex. `192.168.1.50`. Réservez-la dans votre box.
2. **Le micro exige HTTPS** : suivez [docs/HTTPS-TABLETTE.md](docs/HTTPS-TABLETTE.md) (mkcert, 5 minutes). Sans HTTPS tout marche sauf le micro (l'enfant peut taper son texte).
3. Sur la tablette, Chrome → `https://192.168.1.50:8080` → menu ⋮ → **Installer l'application**. PixiContes s'ouvre en plein écran, et les histoires déjà créées restent lisibles hors-ligne.
4. Option **APK** : [docs/APK-CAPACITOR.md](docs/APK-CAPACITOR.md).

Le PC doit être allumé pour écrire de nouveaux chapitres, entendre la voix ou voir de nouvelles images.

## Ce que fait l'application

- **Genres** : aventure, magie et fées, animaux, espace, pirates, dinosaures, mystère, super-héros, école, histoires drôles, contes revisités, sous la mer, robots, chevaliers et dragons, voyage dans le temps, **idée libre**. Extensibles dans l'admin.
- **Co-création** : à chaque chapitre, 3 propositions (icône + texte court) ou une idée libre ; 🎁 surprise ; ajout/modification de personnage à tout moment ; « changer un détail » d'un chapitre ; annuler/refaire ; supprimer un chapitre. La mémoire de l'histoire (personnages, pouvoirs, défauts, lieux, objets, événements) est envoyée à chaque tour ; les anciens chapitres sont résumés.
- **Voix et texte** : dictée avec transcription corrigeable avant envoi ; lecture à voix haute avec surlignage, 6 voix, 4 styles, vitesse 0,7×–1,3×, volume, précédent/suivant ; lire seulement / écouter seulement / les deux ; cache audio.
- **Illustrations** : une par chapitre (réglable), 4 styles (aquarelle, dessin animé, papier découpé, 3D mignonne), personnages cohérents grâce aux fiches visuelles figées, « une autre image » limité par jour.
- **Langues** : FR / DE / EN (A1), traduction douce en français, dictionnaire au toucher (mot ou phrase, appui long) ou « c'est quoi … ? », explication simple + exemple + emoji + prononciation, mis en cache.
- **Parent** : PIN, clé API, modèles (texte, voix, transcription, image, modération), voix, illustrations, longueur des chapitres, langues et niveau, genres, durée quotidienne, plafond de dépense, limites du jour, coûts par jour (CHF/USD), journal des contenus filtrés, export/suppression des histoires, sauvegarde/restauration, caches. PDF illustré de chaque histoire.
- **Sécurité** : modération (filtre local + OpenAI) de ce que dit l'enfant **et** de ce que écrit l'IA, détournement doux, aucun chat libre, aucun lien, aucune donnée personnelle envoyée.

## Développement

```bash
npm run install:all   # dépendances
npm run dev           # API (8080) + Vite (http://localhost:5173)
npm test              # tests unitaires et parcours avec faux OpenAI (32 tests)
npm run typecheck
npm run e2e           # parcours navigateur complet (Playwright) avec faux OpenAI
```

Documentation : [Architecture](docs/ARCHITECTURE.md) · [Décisions](docs/DECISIONS.md) · [Coûts](docs/COUTS.md) · [Design](docs/DESIGN.md) · [HTTPS tablette](docs/HTTPS-TABLETTE.md) · [APK](docs/APK-CAPACITOR.md)

## ⚠️ Reste à valider par vous

- **Test réel avec votre clé** : tout a été testé avec un faux serveur OpenAI (aucun accès réseau ni clé pendant le développement). Les noms de modèles et paramètres (`gpt-5-nano`, `gpt-4o-mini-tts`, `gpt-4o-mini-transcribe`, `gpt-image-1-mini`) sont réglables ; si l'un est refusé, l'admin affiche le message précis d'OpenAI (onglet *Gestion → journal*).
- **Tarifs** : non vérifiés sur la page officielle (inaccessible) ; à corriger dans *Coûts → Tarifs*.
- **Qualité des voix** et du niveau de langue (A1) : à écouter/lire avec votre enfant ; on ajuste les consignes dans `backend/src/engine.ts` et `defaults.ts`.
- **Micro sur tablette** : dépend de votre certificat HTTPS.
- Le serveur n'a pas d'authentification pour l'enfant (il est destiné à un réseau domestique) : ne l'exposez pas sur Internet.
