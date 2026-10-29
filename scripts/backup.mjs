// Sauvegarde complète du dossier data/ (base, images, audio) dans backups/pixicontes-AAAA-MM-JJ.tar.gz
// La clé API chiffrée et la clé maître sont EXCLUES (à ne jamais copier ailleurs).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, 'backups'), { recursive: true });
const out = path.join('backups', `pixicontes-${new Date().toISOString().slice(0, 10)}.tar.gz`);
const r = spawnSync('tar', ['--exclude=data/.master.key', '--exclude=data/cache', '-czf', out, 'data'], { cwd: root, stdio: 'inherit' });
console.log(r.status === 0 ? `✅ Sauvegarde : ${out}\n(La clé API n’est pas incluse : on la ressaisit dans l’admin après une restauration.)` : '❌ Échec (la commande tar est-elle disponible ?)');
