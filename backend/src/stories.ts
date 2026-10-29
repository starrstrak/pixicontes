// Persistance des histoires, historique annuler/refaire, orchestration des actions de l'enfant.
import fs from 'node:fs';
import path from 'node:path';
import { db, now, getSettings, bump, counter } from './db.js';
import { ApiError, KID_MSG } from './openai.js';
import { type Book, type Character, emptyBook, newCharacter, removeChapter, addNote, uid } from './memory.js';
import { type Action, generateChapter, safeChildText, LANGS } from './engine.js';
import { IMAGE_DIR } from './config.js';
import { STYLES, STYLE_BASE } from './defaults.js';

type Row = { id: string; title: string; genre_id: string | null; lang: string; style: string; created_at: number; updated_at: number; data: string; cover: string | null };
export type Story = { id: string; title: string; genreId: string | null; lang: string; style: string; createdAt: number; updatedAt: number; cover: string | null; book: Book; canUndo: boolean; canRedo: boolean };

const toStory = (r: Row): Story => {
  const n = (k: string) => (db.prepare('SELECT COUNT(*) c FROM story_history WHERE story_id=? AND kind=?').get(r.id, k) as { c: number }).c > 0;
  return { id: r.id, title: r.title, genreId: r.genre_id, lang: r.lang, style: r.style, createdAt: r.created_at, updatedAt: r.updated_at, cover: r.cover, book: JSON.parse(r.data), canUndo: n('undo'), canRedo: n('redo') };
};
export function getStory(id: string): Story | null {
  const r = db.prepare('SELECT * FROM stories WHERE id=?').get(id) as Row | undefined;
  return r ? toStory(r) : null;
}
export function listStories() {
  const rows = db.prepare('SELECT id,title,genre_id,lang,style,created_at,updated_at,cover,data FROM stories ORDER BY updated_at DESC').all() as Row[];
  return rows.map((r) => {
    const b = JSON.parse(r.data) as Book;
    return { id: r.id, title: r.title, genreId: r.genre_id, lang: r.lang, style: r.style, updatedAt: r.updated_at, cover: r.cover, chapters: b.chapters.length, heroes: b.characters.filter((c) => c.isHero).map((c) => c.name) };
  });
}
function save(s: { id: string; title?: string; book: Book; cover?: string | null }) {
  const cover = s.cover !== undefined ? s.cover : (s.book.chapters.find((c) => c.image)?.image ?? null);
  db.prepare('UPDATE stories SET data=?, updated_at=?, cover=?, title=COALESCE(?,title) WHERE id=?').run(JSON.stringify(s.book), now(), cover, s.title ?? null, s.id);
}

// ---- Historique : snapshot avant chaque modification ----
const MAX_HIST = 30;
function pushUndo(id: string, book: Book) {
  db.prepare("DELETE FROM story_history WHERE story_id=? AND kind='redo'").run(id);
  db.prepare("INSERT INTO story_history(story_id,kind,data,created_at) VALUES(?,'undo',?,?)").run(id, JSON.stringify(book), now());
  db.prepare("DELETE FROM story_history WHERE story_id=? AND kind='undo' AND id NOT IN (SELECT id FROM story_history WHERE story_id=? AND kind='undo' ORDER BY id DESC LIMIT ?)").run(id, id, MAX_HIST);
}
function step(id: string, from: 'undo' | 'redo', to: 'undo' | 'redo'): Story | null {
  const s = getStory(id);
  const row = db.prepare('SELECT id,data FROM story_history WHERE story_id=? AND kind=? ORDER BY id DESC LIMIT 1').get(id, from) as { id: number; data: string } | undefined;
  if (!s || !row) return s;
  db.prepare('DELETE FROM story_history WHERE id=?').run(row.id);
  db.prepare('INSERT INTO story_history(story_id,kind,data,created_at) VALUES(?,?,?,?)').run(id, to, JSON.stringify(s.book), now());
  save({ id, book: JSON.parse(row.data) });
  return getStory(id);
}
export const undo = (id: string) => step(id, 'undo', 'redo');
export const redo = (id: string) => step(id, 'redo', 'undo');

// ---- Limites quotidiennes ----
function guardChapterLimit() {
  const lim = getSettings().limits.dailyChapters;
  if (lim > 0 && counter('chapters') >= lim) throw new ApiError('limit', KID_MSG.limit, `Limite quotidienne de chapitres atteinte (${lim}).`, 429);
}

export type HeroInput = Partial<Character> & { name: string };

const sanitizeChar = async (c: HeroInput): Promise<Character> => {
  // Chaque champ libre de la fiche passe par le même filtre que le texte de l'enfant.
  const f = async (v?: string) => (v ? (await safeChildText(v)).text.replace('[DÉTOURNEMENT]', '').trim() : '');
  const name = (await f(c.name)).slice(0, 30) || 'Mystère';
  return newCharacter({
    id: c.id || uid(), name, appearance: await f(c.appearance), personality: await f(c.personality), powers: await f(c.powers),
    flaws: await f(c.flaws), relations: await f(c.relations), visual: c.visual ?? '', isHero: !!c.isHero, voice: c.voice,
  });
};

export async function createStory(i: { genreId: string; genreName: string; genrePrompt: string; freeIdea?: string; lang: string; style: string; heroes: HeroInput[] }): Promise<Story> {
  guardChapterLimit();
  if (!LANGS[i.lang] || !getSettings().languages.enabled.includes(i.lang)) i.lang = 'fr';
  const style = STYLES.find((s) => s.id === i.style) ?? STYLES[0];
  const book = emptyBook();
  book.styleLock = `${style.prompt}. ${STYLE_BASE}`;
  const idea = i.freeIdea ? (await safeChildText(i.freeIdea)).text : '';
  book.premise = [i.genreName, idea].filter(Boolean).join(' – ');
  book.characters = [];
  for (const h of i.heroes.slice(0, 3)) book.characters.push(await sanitizeChar({ ...h, isHero: true }));
  if (!book.characters.length) book.characters.push(newCharacter({ name: 'Mystère', isHero: true }));
  const { book: nb, title } = await generateChapter(book, i.lang, { type: 'start', genreName: i.genreName, genrePrompt: i.genrePrompt, freeIdea: idea }, '').catch(blockedToKid);
  bump('chapters');
  const id = uid() + uid();
  db.prepare('INSERT INTO stories(id,title,genre_id,lang,style,created_at,updated_at,data,cover) VALUES(?,?,?,?,?,?,?,?,NULL)').run(id, title || 'Mon histoire', i.genreId, i.lang, style.id, now(), now(), JSON.stringify(nb));
  return getStory(id)!;
}

function blockedToKid(e: unknown): never {
  if ((e as { blocked?: boolean }).blocked) throw new ApiError('blocked', KID_MSG.blocked, 'Sortie IA bloquée par la modération deux fois de suite.', 422);
  throw e;
}

export type ChildAction = { type: 'choice'; text: string } | { type: 'twist' } | { type: 'character'; character: HeroInput } | { type: 'edit'; chapterId: string; instruction: string };

export async function applyAction(id: string, a: ChildAction): Promise<Story> {
  const s = getStory(id);
  if (!s) throw new ApiError('bad_request', 'Je ne retrouve pas cette histoire.', 'Histoire introuvable', 404);
  guardChapterLimit();
  let book = s.book;
  let action: Action;
  let childText = '';
  if (a.type === 'choice') {
    const t = await safeChildText(a.text);
    childText = t.diverted ? t.text : t.text;
    action = { type: 'choice', text: childText };
  } else if (a.type === 'twist') action = { type: 'twist' };
  else if (a.type === 'character') {
    const c = await sanitizeChar(a.character);
    book = structuredClone(book);
    book.characters = [...book.characters.filter((x) => x.name.toLowerCase() !== c.name.toLowerCase()), c].slice(-12);
    action = { type: 'character', name: c.name };
  } else {
    const idx = book.chapters.findIndex((c) => c.id === a.chapterId);
    if (idx < 0) throw new ApiError('bad_request', 'Je ne retrouve pas ce chapitre.', 'Chapitre introuvable', 404);
    const t = await safeChildText(a.instruction);
    childText = t.text;
    action = { type: 'edit', chapterIndex: idx, instruction: childText };
  }
  const res = await generateChapter(book, s.lang, action, childText).catch(blockedToKid);
  pushUndo(id, s.book);
  bump('chapters');
  save({ id, book: res.book });
  return getStory(id)!;
}

/** Modifier une fiche personnage sans écrire de chapitre : la suite s'adapte via le LIVRE. */
export async function updateCharacter(id: string, charId: string, patch: HeroInput): Promise<Story> {
  const s = getStory(id);
  if (!s) throw new ApiError('bad_request', 'Histoire introuvable.', 'Histoire introuvable', 404);
  const c = await sanitizeChar({ ...patch, id: charId });
  let book = structuredClone(s.book);
  const i = book.characters.findIndex((x) => x.id === charId);
  if (i < 0) throw new ApiError('bad_request', 'Personnage introuvable.', 'Personnage introuvable', 404);
  const old = book.characters[i];
  book.characters[i] = { ...old, ...Object.fromEntries(Object.entries(c).filter(([k, v]) => v !== '' && k !== 'visual' && k !== 'isHero')), id: old.id, isHero: old.isHero, visual: old.visual };
  book = addNote(book, `${old.name} a changé (fiche mise à jour).`);
  pushUndo(id, s.book);
  save({ id, book });
  return getStory(id)!;
}

export function deleteChapter(id: string, chapterId: string): Story | null {
  const s = getStory(id);
  if (!s || s.book.chapters.length <= 1) return s; // on garde toujours au moins un chapitre
  pushUndo(id, s.book);
  save({ id, book: removeChapter(s.book, chapterId) });
  return getStory(id);
}

export function setChapterImage(id: string, chapterId: string, file: string) {
  const s = getStory(id);
  if (!s) return;
  const c = s.book.chapters.find((x) => x.id === chapterId);
  if (!c) return;
  c.image = file;
  save({ id, book: s.book });
}

export function deleteStory(id: string) {
  const s = getStory(id);
  if (!s) return;
  for (const c of s.book.chapters) if (c.image) fs.rmSync(path.join(IMAGE_DIR, c.image), { force: true });
  db.prepare('DELETE FROM stories WHERE id=?').run(id);
  db.prepare('DELETE FROM story_history WHERE story_id=?').run(id);
}
export function renameStory(id: string, title: string) {
  db.prepare('UPDATE stories SET title=?, updated_at=? WHERE id=?').run(title.slice(0, 80), now(), id);
}
