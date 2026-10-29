# Architecture

```
Tablette Android / navigateur (PWA React)
        │  HTTPS local (réseau domestique)
        ▼
Serveur local Node.js (Fastify, TypeScript) ── SQLite + data/images + data/cache/audio
        │  HTTPS sortant, clé OpenAI côté serveur uniquement
        ▼
API OpenAI : texte JSON strict · TTS · transcription · images · modération (gratuite)
```

## Dossiers
| Dossier | Contenu |
|---|---|
| `backend/src` | `server.ts` (routes), `engine.ts` (prompts, schéma JSON, génération), `memory.ts` (livre de l'histoire, fonctions pures), `stories.ts` (persistance, annuler/refaire), `media.ts` (images, voix, transcription, dictionnaire), `moderation.ts`, `openai.ts` (client, retries, coûts, plafond), `secrets.ts` (clé chiffrée, PIN), `db.ts`, `defaults.ts` (genres, voix, tarifs, réglages) |
| `backend/test` | Tests Vitest : mémoire, modération (cas limites), parcours complet avec faux OpenAI |
| `frontend/src` | `screens/` (NewStory, Library, Characters, ChildSettings, Reader, Admin), `components/`, `lib/` (api, lecteur audio, micro, préférences, sons) |
| `e2e` | Faux serveur OpenAI + test Playwright du parcours parent et enfant |
| `scripts` | `start.mjs`, `dev.mjs`, `backup.mjs`, `https-setup.sh` |
| `docs` | Ce dossier |

## Modèle de données (SQLite)
`settings` (JSON, clé chiffrée, PIN hashé) · `genres` · `stories` (le livre complet en JSON) · `story_history` (instantanés annuler/refaire) · `characters` (bibliothèque) · `usage` (coûts) · `counters` (limites du jour) · `usage_time` (temps d'écran) · `dictionary` (cache) · `moderation_log` · `events` (erreurs).

## Flux d'un chapitre
1. L'enfant choisit/écrit/dicte → texte nettoyé (`scrubPII`) → filtre local + modération OpenAI. Refusé ⇒ l'IA reçoit seulement « détourne avec douceur ».
2. Prompt = consigne système (langue, niveau, longueur, sécurité) + **livre compact** + résumés des anciens chapitres + 2 derniers chapitres + action.
3. Réponse JSON strict validée → sortie modérée (1 régénération possible) → fusion de la mémoire → sauvegarde (avec instantané d'annulation).
4. Le client affiche le texte, lance la voix (phrase par phrase) et demande l'image séparément.

## API (résumé)
Public : `GET /api/config`, `GET/POST /api/stories`, `POST /api/stories/:id/continue` (choix, surprise, personnage, modification de chapitre), `undo`, `redo`, `PUT …/characters/:id`, `DELETE …/chapters/:id`, `POST …/chapters/:id/image`, `GET …/pdf`, `GET/POST/DELETE /api/characters`, `POST /api/tts`, `/api/stt`, `/api/dictionary`, `/api/ping`.
Parent (en-tête `x-admin-token` après PIN) : `/api/admin/*` (réglages, clé, test de clé, usage, genres, journal, sauvegarde/restauration, caches).

## Jalons livrables
| Jalon | Contenu | État |
|---|---|---|
| 1. MVP | Histoire texte + 3 choix, mémoire, sauvegarde, bibliothèque, annuler/refaire | ✅ |
| 2. Voix | Dictée, lecture phrase par phrase, surlignage, 6 voix, cache | ✅ |
| 3. Illustrations | Fiches de style, 4 styles, placeholder, régénération limitée | ✅ |
| 4. Admin | PIN, clé, modèles, limites, coûts, gestion, sauvegarde | ✅ |
| 5. Langues & dictionnaire | FR/DE/EN niveau A1, traduction douce, dictionnaire en cache | ✅ |
| 6. Finitions | Accessibilité, PWA, PDF, tests, docs | ✅ (voir « Reste à valider » dans le README) |

## PWA, hors-ligne et APK
Le service worker précache l'application ; les histoires (`/api/stories*`) et les images sont servies depuis le cache quand le serveur est injoignable. L'IA (nouveaux chapitres, voix) nécessite évidemment le serveur. L'emballage APK optionnel est décrit dans `docs/APK-CAPACITOR.md`.
