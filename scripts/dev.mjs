// Mode développement : API (rechargement auto) + Vite (http://localhost:5173).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const p = [spawn(npm, ['run', 'dev'], { cwd: path.join(root, 'backend'), stdio: 'inherit', shell: process.platform === 'win32' }), spawn(npm, ['run', 'dev'], { cwd: path.join(root, 'frontend'), stdio: 'inherit', shell: process.platform === 'win32' })];
process.on('SIGINT', () => { p.forEach((x) => x.kill()); process.exit(0); });
