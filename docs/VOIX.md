# Voix : choix et réglages

## Ce qui est disponible
- **13 voix de base OpenAI** : marin, cedar, coral, sage, ballad, verse, nova, shimmer, fable, alloy, ash, echo, onyx. Marin et cedar sont les plus récentes et les plus naturelles selon OpenAI ; ballad et verse ne sont pas disponibles avec `tts-1` (remplacées par coral). Les descriptions affichées dans l'app sont indicatives : écoutez l'échantillon.
- **16 profils prêts à l'emploi** (Maman du soir, Livre audio premium, Grand-père conteur, Mamie douce, Fée mystérieuse, Vieux pirate, Berceuse, Prof de langue, Conteuse romande…), modifiables, dupliquables et extensibles dans l'espace parent. L'enfant peut aussi enregistrer « Mes voix ».
- **Atelier de voix** (enfant et parent) : tonalité (5 niveaux), timbre (10, jusqu'à 4 combinés), émotions (16, jusqu'à 4), modulation/expressivité (5), variation d'intonation et de rythme (5), rythme (5), diction (3), pauses (3), respirations audibles, âge perçu (4), accent par langue (français de France / suisse romand / belge / québécois / du Sud ; hochdeutsch / suisse / autrichien ; anglais britannique / américain / irlandais / australien), consigne libre.
- **Fluidité de lecture** (granularité) : *phrase par phrase* (démarrage rapide, surlignage précis), *petits groupes* de 1 à 3 phrases (recommandé), *chapitre entier* (intonation la plus liée, démarrage plus lent). Le coût ne change pas.
- Vitesse 0,7×–1,3× et volume côté lecteur (aucune régénération).

## Comment ça marche, et ses limites
`gpt-4o-mini-tts` n'a **pas de curseur numérique** de hauteur ou de timbre. Chaque réglage est traduit en consigne d'interprétation en anglais (« slightly husky, resonant timbre », « long dramatic pauses »…) qui accompagne le texte (`backend/src/voices.ts`, fonction `buildInstructions`). Le modèle suit ces consignes de façon approximative : l'effet d'un curseur est réel mais pas millimétré, et peut varier d'une voix à l'autre. Les ajustements fins marchent mieux avec gpt-4o-mini-tts qu'avec tts-1 (qui ignore les consignes).

La consigne fait partie de la clé du cache : changer un réglage régénère l'audio (quelques centimes l'histoire) ; ne rien changer ne coûte rien.

## Autres fournisseurs
Le cahier des charges interdit toute dépendance payante autre qu'OpenAI, donc ElevenLabs, Azure ou Google ne sont pas intégrés. Piste gratuite et locale si vous voulez plus tard sortir d'OpenAI pour la voix : **Piper** (open source, tourne sur le PC, voix françaises correctes mais moins expressives). Non implémenté ; dites-le-moi si cela vous intéresse.
