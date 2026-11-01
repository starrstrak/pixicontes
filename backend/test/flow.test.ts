// Test de bout en bout du moteur avec un faux serveur OpenAI (aucun appel réseau réel).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pixi-'));
process.env.OPENAI_API_KEY = 'sk-test-0000000000000000000000';

let n = 0;
const calls: { url: string; body: any }[] = [];
let flagOnce = false;
let badOutputOnce = false;

function chapterJson(text: string) {
  return {
    title: 'Léo et le dragon', chapter_text: text, chapter_summary: `Résumé: ${text.slice(0, 20)}`, translation_fr: '',
    memory_update: { setting: 'une forêt', characters: [{ name: 'Léo', appearance: '', personality: '', powers: '', flaws: '', relations: '', visual: 'boy with red cap' }, { name: 'Zog', appearance: 'petit dragon', personality: 'timide', powers: 'crache des bulles', flaws: '', relations: 'ami de Léo', visual: 'small green dragon' }], places: [{ name: 'Forêt', description: 'verte' }], objects: [], events: ['Léo rencontre Zog'] },
    choices: [{ icon: '🐉', label: 'Suivre Zog', label_fr: '' }, { icon: '🌳', label: 'Grimper', label_fr: '' }, { icon: '🍪', label: 'Goûter', label_fr: '' }],
    image_prompt: 'Leo and a small dragon in a forest',
  };
}

beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string, init: any) => {
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ url, body });
    if (url.endsWith('/moderations')) {
      const r = flagOnce;
      flagOnce = false;
      return new Response(JSON.stringify({ results: [{ flagged: r, categories: {}, category_scores: r ? { sexual: 0.9 } : { sexual: 0 } }] }));
    }
    if (url.endsWith('/chat/completions')) {
      n++;
      const text = badOutputOnce ? 'texte problématique' : `Chapitre ${n}. Léo marche dans la forêt. Zog sourit.`;
      if (badOutputOnce) { badOutputOnce = false; flagOnce = true; }
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(chapterJson(text)) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1000, completion_tokens: 300 } }));
    }
    if (url.endsWith('/images/generations')) return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('fakejpeg').toString('base64') }] }));
    if (url.endsWith('/audio/speech')) return new Response(Buffer.from('fakemp3'));
    return new Response('{}', { status: 404 });
  });
});

describe('parcours principal', () => {
  it('crée une histoire, enchaîne les chapitres, annule/refait, modifie, supprime', async () => {
    const S = await import('../src/stories');
    const story = await S.createStory({ genreId: 'aventure', genreName: 'Aventure', genrePrompt: 'x', lang: 'fr', style: 'cartoon', heroes: [{ name: 'Léo', appearance: 'cheveux bruns', powers: 'vole' }] });
    expect(story.title).toBe('Léo et le dragon');
    expect(story.book.chapters).toHaveLength(1);
    expect(story.book.chapters[0].choices).toHaveLength(3);
    const hero = story.book.characters.find((c) => c.name === 'Léo')!;
    expect(hero.isHero).toBe(true);
    expect(hero.visual).toBe('boy with red cap'); // fiche visuelle remplie par l'IA et figée
    expect(story.book.characters.find((c) => c.name === 'Zog')).toBeTruthy();
    expect(story.book.styleLock).toContain('watercolor'.length ? 'cartoon' : '');

    let s = await S.applyAction(story.id, { type: 'choice', text: 'Suivre Zog' });
    expect(s.book.chapters).toHaveLength(2);
    expect(s.canUndo).toBe(true);
    s = await S.applyAction(story.id, { type: 'twist' });
    expect(s.book.chapters).toHaveLength(3);

    // le prompt envoyé contient le livre, les résumés et l'action
    const lastChat = calls.filter((c) => c.url.endsWith('/chat/completions')).at(-1)!.body;
    const user = lastChat.messages[1].content as string;
    expect(user).toContain('LIVRE DE L');
    expect(user).toContain('SURPRISE');
    expect(user).toContain('Zog');
    expect(lastChat.response_format.json_schema.strict).toBe(true);
    expect(lastChat.reasoning_effort).toBe('minimal');

    s = S.undo(story.id)!;
    expect(s.book.chapters).toHaveLength(2);
    expect(s.canRedo).toBe(true);
    s = S.redo(story.id)!;
    expect(s.book.chapters).toHaveLength(3);

    s = await S.applyAction(story.id, { type: 'edit', chapterId: s.book.chapters[0].id, instruction: 'le dragon est bleu' });
    expect(s.book.chapters).toHaveLength(3);
    expect(s.book.notes.join()).toContain('le dragon est bleu');

    s = await S.applyAction(story.id, { type: 'character', character: { name: 'Mia', powers: 'invisible' } });
    expect(s.book.characters.some((c) => c.name === 'Mia')).toBe(true);
    expect(s.book.chapters).toHaveLength(4);

    s = S.deleteChapter(story.id, s.book.chapters[1].id)!;
    expect(s.book.chapters).toHaveLength(3);
    expect(S.listStories()).toHaveLength(1);
    S.deleteStory(story.id);
    expect(S.listStories()).toHaveLength(0);
  });

  it('détourne un texte inapproprié sans jamais le transmettre à l’IA', async () => {
    const S = await import('../src/stories');
    const story = await S.createStory({ genreId: 'aventure', genreName: 'Aventure', genrePrompt: 'x', lang: 'fr', style: 'cartoon', heroes: [{ name: 'Léo' }] });
    await S.applyAction(story.id, { type: 'choice', text: 'il faut égorger tout le monde' });
    const user = calls.filter((c) => c.url.endsWith('/chat/completions')).at(-1)!.body.messages[1].content as string;
    expect(user).toContain('DÉTOURNEMENT');
    expect(user).not.toContain('égorger');
    const { db } = await import('../src/db');
    expect((db.prepare('SELECT COUNT(*) c FROM moderation_log').get() as { c: number }).c).toBeGreaterThan(0);
  });

  it('régénère un chapitre dont la sortie est jugée inadaptée', async () => {
    const S = await import('../src/stories');
    const story = await S.createStory({ genreId: 'aventure', genreName: 'Aventure', genrePrompt: 'x', lang: 'fr', style: 'cartoon', heroes: [{ name: 'Léo' }] });
    badOutputOnce = true;
    const before = calls.filter((c) => c.url.endsWith('/chat/completions')).length;
    const s = await S.applyAction(story.id, { type: 'choice', text: 'on mange' });
    expect(calls.filter((c) => c.url.endsWith('/chat/completions')).length - before).toBe(2);
    expect(s.book.chapters.at(-1)!.text).not.toContain('problématique');
  });

  it('génère image et voix, avec cache audio et limite de régénération', async () => {
    const S = await import('../src/stories');
    const M = await import('../src/media');
    const { saveSettings } = await import('../src/db');
    const story = await S.createStory({ genreId: 'aventure', genreName: 'Aventure', genrePrompt: 'x', lang: 'fr', style: 'papier', heroes: [{ name: 'Léo' }] });
    const cid = story.book.chapters[0].id;
    const f = await M.generateImage(story.id, cid, false);
    expect(fs.existsSync(path.join(process.env.DATA_DIR!, 'images', f))).toBe(true);
    const imgCall = calls.filter((c) => c.url.endsWith('/images/generations')).at(-1)!.body;
    expect(imgCall.model).toBe('gpt-image-1-mini');
    expect(imgCall.quality).toBe('low');
    expect(imgCall.prompt).toContain('boy with red cap'); // fiche visuelle réinjectée
    expect(imgCall.prompt).toContain('cut-paper'); // style figé
    expect(S.getStory(story.id)!.cover).toBe(f);
    // pas de nouvel appel si l'image existe
    const n0 = calls.length;
    await M.generateImage(story.id, cid, false);
    expect(calls.length).toBe(n0);
    // régénération limitée
    saveSettings({ image: { regenPerDay: 1 } });
    await M.generateImage(story.id, cid, true);
    await expect(M.generateImage(story.id, cid, true)).rejects.toMatchObject({ code: 'limit' });

    // audio : 2e appel identique = cache
    const a1 = await M.synthesize({ text: 'Il était une fois un petit dragon.', profile: 'douce', tone: 'calme' });
    const c1 = calls.filter((c) => c.url.endsWith('/audio/speech')).length;
    const a2 = await M.synthesize({ text: 'Il était une fois un petit dragon.', profile: 'douce', tone: 'calme' });
    expect(a1).toBe(a2);
    expect(calls.filter((c) => c.url.endsWith('/audio/speech')).length).toBe(c1);
    await M.synthesize({ text: 'Il était une fois un petit dragon.', profile: 'conteur', tone: 'calme' });
    expect(calls.filter((c) => c.url.endsWith('/audio/speech')).length).toBe(c1 + 1);
    const speech = calls.filter((c) => c.url.endsWith('/audio/speech')).at(-1)!.body;
    expect(speech.model).toBe('gpt-4o-mini-tts');
    expect(speech.instructions).toContain('French');
  });

  it('bloque toute génération au plafond mensuel', async () => {
    const S = await import('../src/stories');
    const { saveSettings } = await import('../src/db');
    saveSettings({ limits: { monthlyBudgetUsd: 0.0001 } });
    await expect(S.createStory({ genreId: 'aventure', genreName: 'A', genrePrompt: 'x', lang: 'fr', style: 'cartoon', heroes: [{ name: 'Léo' }] })).rejects.toMatchObject({ code: 'budget' });
    saveSettings({ limits: { monthlyBudgetUsd: 5 } });
  });

  it('met en cache le dictionnaire', async () => {
    const M = await import('../src/media');
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push({ url, body: null });
      if (url.endsWith('/moderations')) return new Response(JSON.stringify({ results: [{ flagged: false, categories: {}, category_scores: {} }] }));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ emoji: '🐉', meaning: 'Un grand animal imaginaire.', example: 'Le dragon dort.', kind: 'nom' }) }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 50 } }));
    });
    const a = await M.define('dragon', 'fr', 'fr', '');
    const b = await M.define('Dragon', 'fr', 'fr', '');
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(true);
  });
});
