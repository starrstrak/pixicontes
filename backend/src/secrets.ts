// Clé OpenAI et PIN : jamais en clair sur disque, jamais renvoyés au navigateur.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';
import { getRaw, setRaw, delRaw } from './db.js';

// Clé maître locale (fichier data/.master.key, droits 600, ignoré par git).
const MASTER = path.join(DATA_DIR, '.master.key');
function masterKey(): Buffer {
  if (!fs.existsSync(MASTER)) fs.writeFileSync(MASTER, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(MASTER, 'utf8').trim(), 'hex');
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
export function decrypt(blob: string): string {
  const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', masterKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

export function setApiKey(key: string) {
  setRaw('openai_key_enc', encrypt(key.trim()));
}
export function clearApiKey() {
  delRaw('openai_key_enc');
}
/** Clé serveur : base chiffrée en priorité, sinon variable d'environnement. */
export function getApiKey(): string | null {
  const enc = getRaw('openai_key_enc') as string | undefined;
  if (enc) {
    try {
      return decrypt(enc);
    } catch {
      return null;
    }
  }
  return process.env.OPENAI_API_KEY?.trim() || null;
}
export function keyHint(): string | null {
  const k = getApiKey();
  return k ? `…${k.slice(-4)}` : null;
}

// ---- PIN ----
export function hashPin(pin: string, salt = crypto.randomBytes(16).toString('hex')): string {
  return `${salt}:${crypto.scryptSync(pin, salt, 32).toString('hex')}`;
}
export function verifyPinHash(pin: string, stored: string): boolean {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex');
  const b = crypto.scryptSync(pin, salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const hasPin = () => !!getRaw('pin_hash');
export function setPin(pin: string) {
  setRaw('pin_hash', hashPin(pin));
}

type Lock = { fails: number; until: number; level: number };
const lock = (): Lock => (getRaw('pin_lock') as Lock) ?? { fails: 0, until: 0, level: 0 };

/** Vérifie le PIN avec verrouillage progressif (5 échecs → 1 min, puis 5, 15, 60 min...). */
export function checkPin(pin: string): { ok: boolean; lockedMs: number } {
  const l = lock();
  if (l.until > Date.now()) return { ok: false, lockedMs: l.until - Date.now() };
  const stored = getRaw('pin_hash') as string | undefined;
  if (stored && verifyPinHash(pin, stored)) {
    setRaw('pin_lock', { fails: 0, until: 0, level: 0 });
    return { ok: true, lockedMs: 0 };
  }
  l.fails += 1;
  if (l.fails >= 5) {
    const mins = [1, 5, 15, 60][Math.min(l.level, 3)];
    l.until = Date.now() + mins * 60_000;
    l.level += 1;
    l.fails = 0;
  }
  setRaw('pin_lock', l);
  return { ok: false, lockedMs: Math.max(0, l.until - Date.now()) };
}

// ---- Sessions admin (mémoire, 30 min glissantes) ----
const sessions = new Map<string, number>();
export function newAdminSession(): string {
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, Date.now() + 30 * 60_000);
  return t;
}
export function isAdminToken(t: string | undefined): boolean {
  if (!t) return false;
  const exp = sessions.get(t);
  if (!exp || exp < Date.now()) {
    sessions.delete(t);
    return false;
  }
  sessions.set(t, Date.now() + 30 * 60_000);
  return true;
}
export function endAdminSession(t: string) {
  sessions.delete(t);
}
