// Chemins et variables d'environnement. Aucune clé API ici.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');

// Charge un éventuel .env (ignoré par git) sans dépendance externe.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(ROOT, 'data'));
export const IMAGE_DIR = path.join(DATA_DIR, 'images');
export const AUDIO_DIR = path.join(DATA_DIR, 'cache', 'audio');
export const DB_FILE = process.env.DB_FILE ?? path.join(DATA_DIR, 'pixicontes.sqlite');
export const FRONT_DIST = path.join(ROOT, 'frontend', 'dist');
export const PORT = Number(process.env.PORT ?? 8080);
export const HTTPS_KEY = process.env.HTTPS_KEY;
export const HTTPS_CERT = process.env.HTTPS_CERT;

for (const d of [DATA_DIR, IMAGE_DIR, AUDIO_DIR]) fs.mkdirSync(d, { recursive: true });
