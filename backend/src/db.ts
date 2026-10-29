// SQLite local (module natif node:sqlite, aucune dépendance native à compiler).
import { DatabaseSync } from 'node:sqlite';
import { DB_FILE } from './config.js';
import { DEFAULT_SETTINGS, GENRES, type Settings } from './defaults.js';

export const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS genres (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#ffd166',
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, builtin INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, genre_id TEXT, lang TEXT NOT NULL DEFAULT 'fr',
  style TEXT NOT NULL DEFAULT 'aquarelle', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  data TEXT NOT NULL, cover TEXT);
CREATE TABLE IF NOT EXISTS story_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, story_id TEXT NOT NULL, kind TEXT NOT NULL,
  data TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_hist ON story_history(story_id, kind, id);
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, month TEXT NOT NULL,
  kind TEXT NOT NULL, model TEXT, tokens_in INTEGER DEFAULT 0, tokens_out INTEGER DEFAULT 0,
  images INTEGER DEFAULT 0, audio_seconds REAL DEFAULT 0, chars INTEGER DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_usage_day ON usage(day);
CREATE TABLE IF NOT EXISTS moderation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, source TEXT NOT NULL,
  category TEXT NOT NULL, excerpt TEXT NOT NULL, action TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dictionary (key TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS counters (day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, kind));
CREATE TABLE IF NOT EXISTS usage_time (day TEXT PRIMARY KEY, seconds INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, level TEXT NOT NULL, msg TEXT NOT NULL);
`);

// Seed genres (une seule fois ; l'admin peut ensuite les modifier / en ajouter).
if ((db.prepare('SELECT COUNT(*) c FROM genres').get() as { c: number }).c === 0) {
  const ins = db.prepare('INSERT INTO genres (id,name,icon,description,prompt,color,active,sort,builtin) VALUES (?,?,?,?,?,?,1,?,1)');
  GENRES.forEach((g, i) => ins.run(g.id, g.name, g.icon, g.description, g.prompt, g.color, i));
}

export const now = () => Date.now();
export const dayStr = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export const monthStr = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);

// ---- Réglages ----
function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
export function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : over) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out as T;
}
export function getRaw(key: string): unknown {
  const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined;
  return r ? JSON.parse(r.value) : undefined;
}
export function setRaw(key: string, value: unknown) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
}
export function delRaw(key: string) {
  db.prepare('DELETE FROM settings WHERE key=?').run(key);
}
export function getSettings(): Settings {
  return deepMerge(DEFAULT_SETTINGS, getRaw('settings'));
}
export function saveSettings(patch: unknown): Settings {
  const merged = deepMerge(getSettings(), patch);
  setRaw('settings', merged);
  return merged;
}

export function logEvent(level: 'info' | 'warn' | 'error', msg: string) {
  db.prepare('INSERT INTO events(ts,level,msg) VALUES(?,?,?)').run(now(), level, msg.slice(0, 500));
  db.prepare('DELETE FROM events WHERE id < (SELECT MAX(id) FROM events) - 500').run();
}

export function bump(kind: string, by = 1, day = dayStr()): number {
  db.prepare('INSERT INTO counters(day,kind,n) VALUES(?,?,?) ON CONFLICT(day,kind) DO UPDATE SET n=n+excluded.n').run(day, kind, by);
  return counter(kind, day);
}
export function counter(kind: string, day = dayStr()): number {
  const r = db.prepare('SELECT n FROM counters WHERE day=? AND kind=?').get(day, kind) as { n: number } | undefined;
  return r?.n ?? 0;
}
