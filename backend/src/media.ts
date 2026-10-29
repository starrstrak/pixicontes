// Illustrations, synthèse vocale, transcription, dictionnaire : tout est mis en cache localement.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AUDIO_DIR, IMAGE_DIR } from './config.js';
import { db, getSettings, now, bump, counter } from './db.js';
import { ApiError, KID_MSG, assertBudget, chatJSON, costImage, costStt, costTts, estimateSeconds, oaFetch, recordUsage } from './openai.js';
import { charactersInScene } from './memory.js';
import { getStory, setChapterImage } from './stories.js';
import { LANGS } from './engine.js';
import { moderate, scrubPII } from './moderation.js';
import { TONES, VOICE_PROFILES } from './defaults.js';

// ================= Illustrations =================
export function buildImagePrompt(story: NonNullable<ReturnType<typeof getStory>>, chapterId: string): string {
  const b = story.book;
  const ch = b.chapters.find((c) => c.id === chapterId)!;
  const chars = charactersInScene(b, `${ch.text} ${ch.imagePrompt}`);
  const sheets = chars.map((c) => `${c.name}: ${c.visual}`).join(' | ');
  return [
    `Scene: ${ch.imagePrompt}`,
    sheets ? `Characters (keep their look exactly the same): ${sheets}` : '',
    b.setting ? `Setting: ${b.setting}` : '',
    `Art style (fixed for the whole story): ${b.styleLock}`,
    'No text, no letters, no captions. Gentle, friendly, child-safe.',
  ].filter(Boolean).join('\n');
}

export async function generateImage(storyId: string, chapterId: string, regen: boolean): Promise<string> {
  const s = getSettings();
  const story = getStory(storyId);
  const ch = story?.book.chapters.find((c) => c.id === chapterId);
  if (!story || !ch) throw new ApiError('bad_request', 'Je ne retrouve pas ce chapitre.', 'Chapitre introuvable', 404);
  if (ch.image && !regen) return ch.image;
  if (s.image.mode === 'off' && !regen) throw new ApiError('limit', 'Pas d’image pour cette histoire.', 'Illustrations désactivées dans les réglages', 400);
  if (regen && s.image.regenPerDay > 0 && counter('image_regen') >= s.image.regenPerDay)
    throw new ApiError('limit', 'Tu as déjà demandé plusieurs autres images aujourd’hui. On en refait demain !', 'Limite quotidienne de régénération atteinte', 429);
  if (s.limits.dailyImages > 0 && counter('images') >= s.limits.dailyImages)
    throw new ApiError('limit', KID_MSG.limit, 'Limite quotidienne d’images atteinte', 429);
  assertBudget();
  const prompt = buildImagePrompt(story, chapterId);
  const model = s.models.image;
  const res = await oaFetch('/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: s.image.size, quality: s.image.quality, n: 1, output_format: 'jpeg', output_compression: 80 }),
  }, { timeoutMs: 180_000 });
  const j = (await res.json()) as { data: { b64_json?: string }[] };
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new ApiError('server', KID_MSG.server, 'Réponse image vide', 502);
  const file = `${storyId}_${chapterId}_${crypto.randomBytes(3).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(IMAGE_DIR, file), Buffer.from(b64, 'base64'));
  if (ch.image) fs.rmSync(path.join(IMAGE_DIR, ch.image), { force: true });
  recordUsage({ kind: regen ? 'image_regen' : 'image', model, images: 1, cost: costImage(model, s.image.quality, s.image.size) });
  bump('images');
  if (regen) bump('image_regen');
  setChapterImage(storyId, chapterId, file);
  return file;
}

// ================= Synthèse vocale =================
export type TtsReq = { text: string; profile?: string; tone?: string; lang?: string };
function ttsKey(model: string, voice: string, instructions: string, text: string) {
  return crypto.createHash('sha256').update([model, voice, instructions, text].join('\u0001')).digest('hex');
}
export function ttsInstructions(profileId: string, toneId: string, lang: string): { voice: string; instructions: string } {
  const p = VOICE_PROFILES.find((v) => v.id === profileId) ?? VOICE_PROFILES[0];
  const t = TONES.find((x) => x.id === toneId) ?? TONES[0];
  const L = LANGS[lang] ?? LANGS.fr;
  return { voice: p.voice, instructions: `Lis en ${L.name}, avec un accent natif naturel. ${p.instructions} ${t.instructions} Articule clairement pour un enfant de 8 ans. Jamais robotique.` };
}

/** Retourne le chemin du MP3 (cache). La vitesse est appliquée côté lecteur pour ne jamais régénérer. */
export async function synthesize(r: TtsReq): Promise<string> {
  const s = getSettings();
  const text = scrubPII(r.text).slice(0, 600);
  if (!text) throw new ApiError('bad_request', KID_MSG.bad_request, 'Texte vide', 400);
  const { voice, instructions } = ttsInstructions(r.profile ?? s.voice.defaultProfile, r.tone ?? s.voice.defaultTone, r.lang ?? 'fr');
  const model = s.models.tts;
  const useInstr = /gpt-4o/.test(model); // tts-1 / tts-1-hd ne gèrent pas les instructions de style
  const file = path.join(AUDIO_DIR, ttsKey(model, voice, useInstr ? instructions : '', text) + '.mp3');
  if (fs.existsSync(file)) return file;
  if (s.limits.dailyTtsChars > 0 && counter('tts_chars') >= s.limits.dailyTtsChars) throw new ApiError('limit', KID_MSG.limit, 'Limite quotidienne de voix atteinte', 429);
  assertBudget();
  const body: Record<string, unknown> = { model, voice, input: text, response_format: 'mp3' };
  if (useInstr) body.instructions = instructions;
  const res = await oaFetch('/audio/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, { timeoutMs: 60_000 });
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, file);
  const sec = estimateSeconds(text.length);
  recordUsage({ kind: 'tts', model, chars: text.length, seconds: sec, cost: costTts(model, sec) });
  bump('tts_chars', text.length);
  return file;
}

// ================= Transcription =================
export async function transcribe(audio: Buffer, mime: string, lang: string, seconds: number): Promise<string> {
  const s = getSettings();
  assertBudget();
  const ext = /mp4|m4a/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mime || 'audio/webm' }), `voix.${ext}`);
  form.append('model', s.models.stt);
  form.append('language', (LANGS[lang] ?? LANGS.fr).iso);
  form.append('prompt', 'Un enfant de 8 ans raconte une idée pour son histoire : personnages, lieux, actions.');
  const res = await oaFetch('/audio/transcriptions', { method: 'POST', body: form }, { timeoutMs: 60_000 });
  const j = (await res.json()) as { text?: string };
  recordUsage({ kind: 'stt', model: s.models.stt, seconds, cost: costStt(s.models.stt, seconds) });
  return (j.text ?? '').trim();
}

// ================= Dictionnaire =================
export type DictEntry = { term: string; emoji: string; meaning: string; example: string; kind: string };
const DICT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['emoji', 'meaning', 'example', 'kind'],
  properties: { emoji: { type: 'string' }, meaning: { type: 'string' }, example: { type: 'string' }, kind: { type: 'string' } },
};
export async function define(term: string, lang: string, explainLang: string, context: string): Promise<DictEntry & { cached: boolean }> {
  const t = scrubPII(term).slice(0, 80);
  if (!t) throw new ApiError('bad_request', KID_MSG.bad_request, 'Mot vide', 400);
  const key = [lang, explainLang, t.toLowerCase()].join('|');
  const hit = db.prepare('SELECT data FROM dictionary WHERE key=?').get(key) as { data: string } | undefined;
  if (hit) return { ...(JSON.parse(hit.data) as DictEntry), cached: true };
  if ((await moderate(t, 'input')).flagged) return { term: t, emoji: '🙈', meaning: 'Ce mot n’est pas pour les histoires de Pixi. Essaie un autre mot !', example: '', kind: '', cached: false };
  const L = LANGS[lang] ?? LANGS.fr, E = LANGS[explainLang] ?? LANGS.fr;
  const sys = `Tu es un dictionnaire pour un enfant de 8 ans. Réponds en ${E.name}, avec des mots très simples et des phrases courtes. Le mot ou l'expression vient d'un texte en ${L.name}. "meaning": explication en 1 ou 2 phrases courtes (si ce n'est pas la même langue, donne aussi la traduction). "example": une courte phrase d'exemple en ${L.name} (sinon ""). "emoji": un seul emoji qui illustre. "kind": nature du mot en 1-2 mots (ex: verbe, animal, expression). Si c'est une phrase entière, explique-la simplement. Jamais de contenu inadapté.`;
  const out = await chatJSON<Omit<DictEntry, 'term'>>({
    system: sys, user: `Mot ou expression: « ${t} »${context ? `\nPhrase du texte: « ${scrubPII(context).slice(0, 200)} »` : ''}`,
    schema: DICT_SCHEMA, name: 'dictionary', kind: 'dictionary', maxTokens: 500,
  });
  const entry: DictEntry = { term: t, ...out };
  db.prepare('INSERT OR REPLACE INTO dictionary(key,data,created_at) VALUES(?,?,?)').run(key, JSON.stringify(entry), now());
  return { ...entry, cached: false };
}

export { estimateSeconds };
