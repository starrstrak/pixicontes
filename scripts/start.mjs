// Lancement en une commande : installe, construit si besoin, démarre le serveur local.
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 5)) {
  console.error(`❌ Node.js 22.5 ou plus récent est nécessaire (vous avez ${process.versions.node}). Voir README, étape 1.`);
  process.exit(1);
}
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
for (const d of ['backend', 'frontend']) {
  if (!fs.existsSync(path.join(root, d, 'node_modules'))) { console.log(`📦 Installation (${d})…`); run(npm, ['install', '--no-audit', '--no-fund'], path.join(root, d)); }
}
const dist = path.join(root, 'frontend', 'dist', 'index.html');
const newest = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((m, e) => Math.max(m, e.isDirectory() ? newest(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).mtimeMs), 0);
if (!fs.existsSync(dist) || fs.statSync(dist).mtimeMs < newest(path.join(root, 'frontend', 'src'))) { console.log('🛠️  Construction de l’application…'); run(npm, ['run', 'build'], path.join(root, 'frontend')); }
const tsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const srv = spawn(process.execPath, [tsx, 'src/server.ts'], { cwd: path.join(root, 'backend'), stdio: 'inherit', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
srv.on('exit', (c) => process.exit(c ?? 0));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => srv.kill(s));
