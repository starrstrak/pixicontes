// Serveur local PixiContes : API + frontend statique. Aucune télémétrie.
import Fastify, { type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { AUDIO_DIR, FRONT_DIST, HTTPS_CERT, HTTPS_KEY, IMAGE_DIR, PORT } from './config.js';
import { db, dayStr, getSettings, getRaw, logEvent, monthStr, now, saveSettings, setRaw, counter } from './db.js';
import { ApiError, KID_MSG, monthCost, testKey } from './openai.js';
import { checkPin, clearApiKey, endAdminSession, getApiKey, hasPin, isAdminToken, keyHint, newAdminSession, setApiKey, setPin } from './secrets.js';
import { STYLES, TONES } from './defaults.js';
import { BASE_VOICES, TIMBRES, EMOTIONS, AGES, ACCENTS } from './voices.js';
import { LANGS } from './engine.js';
import * as S from './stories.js';
import { define, generateImage, synthesize, transcribe } from './media.js';
import { storyToPdf } from './pdf.js';
import { uid } from './memory.js';

const app = Fastify({
  logger: false, // pas de journaux de contenu : ni texte d'enfant, ni clé
  bodyLimit: 300 * 1024 * 1024,
  ...(HTTPS_KEY && HTTPS_CERT ? { https: { key: fs.readFileSync(HTTPS_KEY), cert: fs.readFileSync(HTTPS_CERT) } } : {}),
});
await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024 } });

const tokenOf = (req: FastifyRequest) => (req.headers['x-admin-token'] as string | undefined) ?? undefined;
const isAdmin = (req: FastifyRequest) => isAdminToken(tokenOf(req));
function requireAdmin(req: FastifyRequest) {
  if (!isAdmin(req)) throw new ApiError('blocked', 'Cette porte est réservée aux grands.', 'Authentification admin requise', 401);
}

app.setErrorHandler((err, req, reply) => {
  if (err instanceof ApiError) {
    return reply.code(err.status).send({ error: { code: err.code, kid: err.kid, admin: isAdmin(req) ? err.admin : undefined } });
  }
  if (err instanceof z.ZodError) return reply.code(400).send({ error: { code: 'bad_request', kid: KID_MSG.bad_request, admin: isAdmin(req) ? err.message : undefined } });
  logEvent('error', `Erreur interne: ${(err as Error).message}`);
  return reply.code(500).send({ error: { code: 'server', kid: KID_MSG.server, admin: isAdmin(req) ? (err as Error).message : undefined } });
});

// ---------- Temps d'écran ----------
function timeLeftSec(): number | null {
  const lim = getSettings().limits.dailyMinutes;
  if (!lim) return null;
  const used = (db.prepare('SELECT seconds FROM usage_time WHERE day=?').get(dayStr()) as { seconds: number } | undefined)?.seconds ?? 0;
  return Math.max(0, lim * 60 - used);
}
function guardTime(req: FastifyRequest) {
  if (timeLeftSec() === 0 && !isAdmin(req)) throw new ApiError('limit', 'Pixi dort. On se retrouve plus tard pour de nouvelles aventures !', 'Durée quotidienne maximale atteinte', 403);
}

// ---------- Public : configuration ----------
app.get('/api/config', async () => {
  const s = getSettings();
  const genres = db.prepare('SELECT id,name,icon,description,color,prompt FROM genres WHERE active=1 ORDER BY sort,name').all();
  return {
    hasKey: !!getApiKey(),
    genres: (genres as { id: string; prompt: string }[]).map((g) => ({ ...g, prompt: undefined, free: g.id === 'libre' })),
    styles: STYLES.map(({ id, label, emoji }) => ({ id, label, emoji })),
    voices: s.voice.profiles.map(({ id, label, emoji, desc, spec }) => ({ id, label, emoji, desc, spec })),
    voiceLab: { bases: BASE_VOICES, timbres: TIMBRES.map(([id, label]) => ({ id, label })), emotions: EMOTIONS.map(([id, label]) => ({ id, label })), ages: AGES.map(([id, label]) => ({ id, label })), accents: Object.fromEntries(Object.entries(ACCENTS).map(([l, a]) => [l, a.map(([id, label]) => ({ id, label }))])) },
    granularity: s.voice.granularity,
    dialogueProfile: s.voice.dialogueProfile,
    tones: TONES.map(({ id, label, emoji }) => ({ id, label, emoji })),
    languages: s.languages.enabled.filter((l) => LANGS[l]).map((l) => ({ id: l, ...LANGS[l] })),
    softTranslation: s.languages.softTranslation,
    defaults: { voice: s.voice.defaultProfile, tone: s.voice.defaultTone, speed: s.voice.defaultSpeed },
    imageMode: s.image.mode,
    allowBrowserTts: s.voice.allowBrowserTts,
    sttBrowserFallback: s.stt.browserFallback,
    perCharacterVoice: s.voice.perCharacter,
    theme: s.theme,
    timeLeftSec: timeLeftSec(),
    regenLeft: s.image.regenPerDay > 0 ? Math.max(0, s.image.regenPerDay - counter('image_regen')) : null,
  };
});
app.post('/api/ping', async (req) => {
  const { seconds } = z.object({ seconds: z.number().min(0).max(60) }).parse(req.body);
  db.prepare('INSERT INTO usage_time(day,seconds) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET seconds=seconds+excluded.seconds').run(dayStr(), Math.round(seconds));
  return { timeLeftSec: timeLeftSec() };
});

// ---------- Histoires ----------
const heroSchema = z.object({
  id: z.string().optional(), name: z.string().min(1).max(40), appearance: z.string().max(300).optional(), personality: z.string().max(300).optional(),
  powers: z.string().max(300).optional(), flaws: z.string().max(300).optional(), relations: z.string().max(300).optional(), voice: z.string().optional(),
});
app.get('/api/stories', async () => S.listStories());
app.get('/api/stories/:id', async (req) => {
  const s = S.getStory((req.params as { id: string }).id);
  if (!s) throw new ApiError('bad_request', 'Je ne retrouve pas cette histoire.', 'Introuvable', 404);
  return s;
});
app.post('/api/stories', async (req) => {
  guardTime(req);
  const b = z.object({
    genreId: z.string(), freeIdea: z.string().max(400).optional(), lang: z.string().default('fr'), style: z.string().default('aquarelle'), heroes: z.array(heroSchema).max(3),
  }).parse(req.body);
  const g = db.prepare('SELECT * FROM genres WHERE id=?').get(b.genreId) as { name: string; prompt: string } | undefined;
  if (!g) throw new ApiError('bad_request', KID_MSG.bad_request, 'Genre inconnu', 400);
  return S.createStory({ ...b, genreName: g.name, genrePrompt: g.prompt });
});
app.patch('/api/stories/:id', async (req) => {
  const { title } = z.object({ title: z.string().min(1).max(80) }).parse(req.body);
  S.renameStory((req.params as { id: string }).id, title);
  return S.getStory((req.params as { id: string }).id);
});
app.delete('/api/stories/:id', async (req) => {
  S.deleteStory((req.params as { id: string }).id);
  return { ok: true };
});
app.post('/api/stories/:id/continue', async (req) => {
  guardTime(req);
  const id = (req.params as { id: string }).id;
  const b = z.discriminatedUnion('type', [
    z.object({ type: z.literal('choice'), text: z.string().min(1).max(400) }),
    z.object({ type: z.literal('twist') }),
    z.object({ type: z.literal('character'), character: heroSchema }),
    z.object({ type: z.literal('edit'), chapterId: z.string(), instruction: z.string().min(1).max(400) }),
  ]).parse(req.body);
  return S.applyAction(id, b);
});
app.put('/api/stories/:id/characters/:cid', async (req) => {
  const p = req.params as { id: string; cid: string };
  return S.updateCharacter(p.id, p.cid, heroSchema.parse(req.body));
});
app.delete('/api/stories/:id/chapters/:cid', async (req) => {
  const p = req.params as { id: string; cid: string };
  return S.deleteChapter(p.id, p.cid);
});
app.post('/api/stories/:id/undo', async (req) => S.undo((req.params as { id: string }).id));
app.post('/api/stories/:id/redo', async (req) => S.redo((req.params as { id: string }).id));
app.post('/api/stories/:id/chapters/:cid/image', async (req) => {
  guardTime(req);
  const p = req.params as { id: string; cid: string };
  const { regen } = z.object({ regen: z.boolean().optional() }).parse(req.body ?? {});
  const file = await generateImage(p.id, p.cid, !!regen);
  return { image: file, regenLeft: getSettings().image.regenPerDay > 0 ? Math.max(0, getSettings().image.regenPerDay - counter('image_regen')) : null };
});
app.get('/api/stories/:id/pdf', async (req, reply) => {
  const s = S.getStory((req.params as { id: string }).id);
  if (!s) throw new ApiError('bad_request', 'Introuvable', 'Introuvable', 404);
  const safe = s.title.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40) || 'histoire';
  reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `attachment; filename="${safe}.pdf"`);
  return reply.send(storyToPdf(s));
});

// ---------- Bibliothèque de personnages ----------
app.get('/api/characters', async () => (db.prepare('SELECT id,data FROM characters ORDER BY created_at DESC').all() as { id: string; data: string }[]).map((r) => ({ id: r.id, ...JSON.parse(r.data) })));
app.post('/api/characters', async (req) => {
  const c = heroSchema.parse(req.body);
  const id = c.id ?? uid();
  const { id: _i, ...rest } = c;
  void _i;
  db.prepare('INSERT INTO characters(id,name,data,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data').run(id, c.name, JSON.stringify(rest), now());
  return { id, ...rest };
});
app.delete('/api/characters/:id', async (req) => {
  db.prepare('DELETE FROM characters WHERE id=?').run((req.params as { id: string }).id);
  return { ok: true };
});

// ---------- Voix / dictionnaire ----------
app.post('/api/tts', async (req, reply) => {
  guardTime(req);
  const b = z.object({ text: z.string().min(1).max(1900), spec: z.unknown().optional(), profile: z.string().optional(), tone: z.string().optional(), lang: z.string().optional() }).parse(req.body);
  const file = await synthesize(b);
  return reply.header('Content-Type', 'audio/mpeg').header('Cache-Control', 'private, max-age=31536000, immutable').send(fs.createReadStream(file));
});
app.post('/api/stt', async (req) => {
  guardTime(req);
  const parts = req.parts();
  let audio: Buffer | null = null, mime = '', lang = 'fr', seconds = 5;
  for await (const p of parts) {
    if (p.type === 'file') { audio = await p.toBuffer(); mime = p.mimetype; }
    else if (p.fieldname === 'lang') lang = String(p.value);
    else if (p.fieldname === 'seconds') seconds = Math.min(60, Number(p.value) || 5);
  }
  if (!audio || audio.length < 1500) return { text: '', silent: true };
  const text = await transcribe(audio, mime, lang, seconds);
  return { text, silent: !text };
});
app.post('/api/dictionary', async (req) => {
  guardTime(req);
  const b = z.object({ term: z.string().min(1).max(120), lang: z.string().default('fr'), explainLang: z.string().default('fr'), context: z.string().max(300).optional() }).parse(req.body);
  return define(b.term, b.lang, b.explainLang, b.context ?? '');
});

// ---------- Admin ----------
app.get('/api/admin/status', async () => ({ hasPin: hasPin() }));
app.post('/api/admin/login', async (req, reply) => {
  const { pin } = z.object({ pin: z.string().min(4).max(12) }).parse(req.body);
  if (!hasPin()) { setPin(pin); return { token: newAdminSession(), created: true }; }
  const r = checkPin(pin);
  if (!r.ok) return reply.code(r.lockedMs ? 423 : 401).send({ error: { code: 'blocked', kid: 'Porte fermée.', admin: r.lockedMs ? `Trop d’essais. Réessayez dans ${Math.ceil(r.lockedMs / 60000)} min.` : 'Code incorrect.' }, lockedMs: r.lockedMs });
  return { token: newAdminSession() };
});
app.post('/api/admin/logout', async (req) => { const t = tokenOf(req); if (t) endAdminSession(t); return { ok: true }; });
app.post('/api/admin/change-pin', async (req) => {
  requireAdmin(req);
  const { oldPin, newPin } = z.object({ oldPin: z.string(), newPin: z.string().min(4).max(12) }).parse(req.body);
  if (!checkPin(oldPin).ok) throw new ApiError('blocked', 'Non', 'Ancien code incorrect', 401);
  setPin(newPin);
  return { ok: true };
});
app.get('/api/admin/settings', async (req) => {
  requireAdmin(req);
  return { settings: getSettings(), keySet: !!getApiKey(), keyHint: keyHint(), keyFromEnv: !getRaw('openai_key_enc') && !!process.env.OPENAI_API_KEY, voiceLab: { bases: BASE_VOICES, timbres: TIMBRES.map(([id, label]) => ({ id, label })), emotions: EMOTIONS.map(([id, label]) => ({ id, label })), ages: AGES.map(([id, label]) => ({ id, label })), accents: Object.fromEntries(Object.entries(ACCENTS).map(([l, a]) => [l, a.map(([id, label]) => ({ id, label }))])) }, tones: TONES };
});
app.put('/api/admin/settings', async (req) => { requireAdmin(req); return saveSettings(req.body); });
app.put('/api/admin/key', async (req) => {
  requireAdmin(req);
  const { key } = z.object({ key: z.string().min(20).max(300).regex(/^sk-/) }).parse(req.body);
  setApiKey(key);
  return { ok: true, keyHint: keyHint() };
});
app.delete('/api/admin/key', async (req) => { requireAdmin(req); clearApiKey(); return { ok: true }; });
app.post('/api/admin/key/test', async (req) => { requireAdmin(req); return testKey(); });

app.get('/api/admin/usage', async (req) => {
  requireAdmin(req);
  const s = getSettings();
  const days = db.prepare(`SELECT day, SUM(cost_usd) cost, SUM(tokens_in) tin, SUM(tokens_out) tout, SUM(images) images, SUM(audio_seconds) audio FROM usage WHERE day >= ? GROUP BY day ORDER BY day`).all(dayStr(now() - 29 * 86400000));
  const kinds = db.prepare('SELECT kind, SUM(cost_usd) cost, SUM(tokens_in) tin, SUM(tokens_out) tout, SUM(images) images, SUM(audio_seconds) audio FROM usage WHERE month=? GROUP BY kind').all(monthStr());
  const cost = monthCost();
  const cap = s.limits.monthlyBudgetUsd;
  return { month: monthStr(), costUsd: cost, costChf: cost * s.chfPerUsd, capUsd: cap, alert: cap > 0 && cost >= cap * 0.8, blocked: cap > 0 && cost >= cap, chfPerUsd: s.chfPerUsd, days, kinds, today: { chapters: counter('chapters'), images: counter('images'), ttsChars: counter('tts_chars'), regen: counter('image_regen') } };
});
app.get('/api/admin/moderation-log', async (req) => { requireAdmin(req); return db.prepare('SELECT * FROM moderation_log ORDER BY id DESC LIMIT 200').all(); });
app.get('/api/admin/events', async (req) => { requireAdmin(req); return db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 100').all(); });

// Genres (extensibles)
const genreSchema = z.object({ id: z.string().regex(/^[a-z0-9_-]{2,30}$/).optional(), name: z.string().min(1).max(40), icon: z.string().min(1).max(8), description: z.string().max(120).default(''), prompt: z.string().max(400).default(''), color: z.string().default('#ffd166'), active: z.boolean().default(true), sort: z.number().default(100) });
app.get('/api/admin/genres', async (req) => { requireAdmin(req); return db.prepare('SELECT * FROM genres ORDER BY sort,name').all(); });
app.post('/api/admin/genres', async (req) => {
  requireAdmin(req);
  const g = genreSchema.parse(req.body);
  const id = g.id ?? `g_${uid()}`;
  db.prepare(`INSERT INTO genres(id,name,icon,description,prompt,color,active,sort,builtin) VALUES(?,?,?,?,?,?,?,?,0)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,icon=excluded.icon,description=excluded.description,prompt=excluded.prompt,color=excluded.color,active=excluded.active,sort=excluded.sort`)
    .run(id, g.name, g.icon, g.description, g.prompt, g.color, g.active ? 1 : 0, g.sort);
  return { id };
});
app.delete('/api/admin/genres/:id', async (req) => {
  requireAdmin(req);
  db.prepare('DELETE FROM genres WHERE id=? AND builtin=0').run((req.params as { id: string }).id);
  return { ok: true };
});

app.get('/api/admin/stories/:id/export', async (req, reply) => {
  requireAdmin(req);
  const s = S.getStory((req.params as { id: string }).id);
  if (!s) throw new ApiError('bad_request', 'Introuvable', 'Introuvable', 404);
  return reply.header('Content-Disposition', `attachment; filename="${s.id}.json"`).send(s);
});
app.post('/api/admin/clear-cache', async (req) => {
  requireAdmin(req);
  const { audio, dictionary } = z.object({ audio: z.boolean().optional(), dictionary: z.boolean().optional() }).parse(req.body);
  let freed = 0;
  if (audio) for (const f of fs.readdirSync(AUDIO_DIR)) { freed += fs.statSync(path.join(AUDIO_DIR, f)).size; fs.rmSync(path.join(AUDIO_DIR, f), { force: true }); }
  if (dictionary) db.exec('DELETE FROM dictionary');
  return { freedMb: +(freed / 1e6).toFixed(1) };
});
app.post('/api/admin/extend-time', async (req) => {
  requireAdmin(req);
  const { minutes } = z.object({ minutes: z.number().min(1).max(240) }).parse(req.body);
  db.prepare('INSERT INTO usage_time(day,seconds) VALUES(?,0) ON CONFLICT(day) DO UPDATE SET seconds=MAX(0,seconds-?)').run(dayStr(), minutes * 60);
  return { timeLeftSec: timeLeftSec() };
});
app.get('/api/admin/cache-size', async (req) => {
  requireAdmin(req);
  const sz = (d: string) => fs.readdirSync(d).reduce((a, f) => a + fs.statSync(path.join(d, f)).size, 0);
  return { audioMb: +(sz(AUDIO_DIR) / 1e6).toFixed(1), imagesMb: +(sz(IMAGE_DIR) / 1e6).toFixed(1) };
});

// Sauvegarde / restauration (JSON ; ajoute ?images=1 pour embarquer les images)
const TABLES = ['stories', 'characters', 'genres', 'dictionary', 'usage', 'moderation_log', 'usage_time', 'counters'];
app.get('/api/admin/backup', async (req, reply) => {
  requireAdmin(req);
  const withImages = (req.query as { images?: string }).images === '1';
  const dump: Record<string, unknown> = { version: 1, createdAt: now() };
  for (const t of TABLES) dump[t] = db.prepare(`SELECT * FROM ${t}`).all();
  const st = { ...(getRaw('settings') as object) };
  dump.settings = st; // la clé API et le PIN ne sont JAMAIS exportés
  if (withImages) dump.imageFiles = Object.fromEntries(fs.readdirSync(IMAGE_DIR).map((f) => [f, fs.readFileSync(path.join(IMAGE_DIR, f)).toString('base64')]));
  return reply.header('Content-Disposition', `attachment; filename="pixicontes-sauvegarde-${dayStr()}.json"`).send(dump);
});
app.post('/api/admin/restore', async (req) => {
  requireAdmin(req);
  const d = req.body as Record<string, unknown> & { version?: number; imageFiles?: Record<string, string> };
  if (d?.version !== 1) throw new ApiError('bad_request', KID_MSG.bad_request, 'Fichier de sauvegarde invalide', 400);
  db.exec('BEGIN');
  try {
    for (const t of TABLES) {
      const rows = (d[t] as Record<string, unknown>[] | undefined) ?? [];
      db.exec(`DELETE FROM ${t}`);
      for (const r of rows) {
        const cols = Object.keys(r);
        db.prepare(`INSERT INTO ${t}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`).run(...(cols.map((c) => r[c]) as (string | number | null)[]));
      }
    }
    if (d.settings) setRaw('settings', d.settings);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw new ApiError('bad_request', KID_MSG.bad_request, `Restauration impossible: ${(e as Error).message}`, 400);
  }
  for (const [f, b64] of Object.entries(d.imageFiles ?? {})) if (/^[\w.-]+$/.test(f)) fs.writeFileSync(path.join(IMAGE_DIR, f), Buffer.from(b64, 'base64'));
  return { ok: true };
});

// ---------- Fichiers ----------
await app.register(fastifyStatic, { root: IMAGE_DIR, prefix: '/media/images/', decorateReply: false, maxAge: '30d', immutable: true });
if (fs.existsSync(FRONT_DIST)) {
  await app.register(fastifyStatic, { root: FRONT_DIST, prefix: '/', wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: { code: 'bad_request', kid: KID_MSG.bad_request } });
    return reply.sendFile('index.html');
  });
} else {
  app.get('/', async (_r, reply) => reply.type('text/html').send('<h1>PixiContes</h1><p>Frontend non construit : lancez <code>npm run build</code> à la racine.</p>'));
}

await app.listen({ port: PORT, host: '0.0.0.0' });
const proto = HTTPS_KEY ? 'https' : 'http';
console.log(`\n🐉 PixiContes est prêt : ${proto}://localhost:${PORT}\n   Sur la tablette : ${proto}://<IP-de-ce-PC>:${PORT}\n`);
