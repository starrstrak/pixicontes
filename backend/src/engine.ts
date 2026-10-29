// Moteur narratif : prompts, schéma JSON, génération d'un chapitre, mise à jour de la mémoire.
import { getSettings } from './db.js';
import { chatJSON } from './openai.js';
import { moderate, scrubPII, logModeration } from './moderation.js';
import {
  type Book, type Chapter, type Choice, type MemoryUpdate, applyMemoryUpdate, compactMemory, narrativeContext, uid,
} from './memory.js';

export const LANGS: Record<string, { name: string; flag: string; iso: string }> = {
  fr: { name: 'français', flag: '🇫🇷', iso: 'fr' },
  de: { name: 'allemand', flag: '🇩🇪', iso: 'de' },
  en: { name: 'anglais', flag: '🇬🇧', iso: 'en' },
};

const str = { type: 'string' };
const strArr = { type: 'array', items: str };
const place = { type: 'object', additionalProperties: false, required: ['name', 'description'], properties: { name: str, description: str } };

/** Schéma strict : toutes les clés requises (contrainte du mode strict OpenAI). */
export const CHAPTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'chapter_text', 'chapter_summary', 'translation_fr', 'memory_update', 'choices', 'image_prompt'],
  properties: {
    title: str,
    chapter_text: str,
    chapter_summary: str,
    translation_fr: str,
    memory_update: {
      type: 'object',
      additionalProperties: false,
      required: ['setting', 'characters', 'places', 'objects', 'events'],
      properties: {
        setting: str,
        characters: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'appearance', 'personality', 'powers', 'flaws', 'relations', 'visual'],
            properties: { name: str, appearance: str, personality: str, powers: str, flaws: str, relations: str, visual: str },
          },
        },
        places: { type: 'array', items: place },
        objects: { type: 'array', items: place },
        events: strArr,
      },
    },
    choices: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['icon', 'label', 'label_fr'], properties: { icon: str, label: str, label_fr: str } },
    },
    image_prompt: str,
  },
} as const;

export type ChapterOut = {
  title: string;
  chapter_text: string;
  chapter_summary: string;
  translation_fr: string;
  memory_update: {
    setting: string;
    characters: { name: string; appearance: string; personality: string; powers: string; flaws: string; relations: string; visual: string }[];
    places: { name: string; description: string }[];
    objects: { name: string; description: string }[];
    events: string[];
  };
  choices: { icon: string; label: string; label_fr: string }[];
  image_prompt: string;
};

export function systemPrompt(lang: string): string {
  const s = getSettings();
  const L = LANGS[lang] ?? LANGS.fr;
  const { minWords, maxWords } = s.story;
  const langRules =
    lang === 'fr'
      ? 'Langue: français simple pour un enfant de 8 ans.'
      : `Langue de l'histoire: ${L.name}. Niveau ${s.languages.level} (enfant de 8 ans qui apprend): phrases de 4 à 8 mots, présent surtout, mots de base répétés, pas d'expressions compliquées. ${
          s.languages.softTranslation ? 'Remplis translation_fr avec une courte aide en français (1 phrase par phrase, simple).' : 'translation_fr = chaîne vide.'
        }`;
  return `Tu es Pixi, un petit dragon conteur qui écrit avec un enfant de 8 ans. L'enfant est l'auteur : tu écris la suite de SON histoire.
${langRules}
STYLE: phrases courtes, mots simples, humour doux, ton chaleureux, rythme vivant, dialogues entre guillemets « ». Aucune morale pesante, aucune leçon. Chapitre de ${minWords} à ${maxWords} mots (strict). Termine sur un moment qui donne envie de continuer.
SÉCURITÉ ABSOLUE: histoire adaptée à 8 ans. Pas de violence graphique, pas de peur excessive, rien de sexuel, pas de haine, pas de drogue ni d'alcool, pas de gros mots. Les combats restent rigolos ou symboliques.
Si l'enfant propose quelque chose d'inadapté ou si l'action est marquée [DÉTOURNEMENT], ne gronde pas, ne mentionne pas de règle : transforme l'idée avec douceur et créativité en une version gentille et amusante.
Tu ne parles QUE de l'histoire. Ne demande jamais d'informations personnelles, ne mets aucun lien, aucune publicité, ne parle pas de toi hors de l'histoire.
COHÉRENCE: respecte strictement le LIVRE (personnages, pouvoirs, défauts, objets, lieux). Utilise les pouvoirs ET les défauts des personnages. Si une modification de l'enfant contredit le passé, ajuste le récit avec élégance (explication magique, rêve, surprise) sans jamais refuser.
MÉMOIRE (memory_update): ne renvoie QUE les nouveautés ou changements (nouveaux personnages, lieux, objets, événements clés en 1 courte phrase, nouveau décor). Pour chaque personnage nouveau ou sans fiche visuelle, remplis "visual" en anglais (cheveux/poil/couleurs, vêtements, traits distinctifs, ~25 mots) : il sera figé pour les illustrations. Laisse "" les champs inchangés.
PROPOSITIONS: exactement 3 actions très différentes, label de 2 à 5 mots, icon = un seul emoji. label_fr = traduction française courte si la langue n'est pas le français, sinon "".
image_prompt: décris la scène principale en ANGLAIS (1 à 2 phrases, personnages cités par leur nom, décor, action, ambiance), sans texte dans l'image, rien d'effrayant.
title: titre court et joli de l'histoire (3 à 6 mots), le même tout au long de l'histoire.`;
}

export type Action =
  | { type: 'start'; genreName: string; genrePrompt: string; freeIdea?: string }
  | { type: 'choice'; text: string }
  | { type: 'twist' }
  | { type: 'character'; name: string }
  | { type: 'edit'; chapterIndex: number; instruction: string };

/** Nettoie, modère et prépare le texte de l'enfant. Retourne [DÉTOURNEMENT] si inadapté (le texte n'est jamais transmis). */
export async function safeChildText(raw: string): Promise<{ text: string; diverted: boolean }> {
  const clean = scrubPII(raw);
  if (!clean) return { text: '', diverted: false };
  const m = await moderate(clean, 'input');
  if (m.flagged) return { text: '[DÉTOURNEMENT] L’enfant a eu une idée qui ne convient pas. Invente une suite gentille et amusante.', diverted: true };
  return { text: clean, diverted: false };
}

function actionText(a: Action, ch: { text: string }): string {
  switch (a.type) {
    case 'start':
      return `DÉBUT DE L'HISTOIRE. Genre: ${a.genreName}. ${a.genrePrompt}${a.freeIdea ? ` Idée de l'enfant: ${a.freeIdea}` : ''} Écris le chapitre 1 : présente le héros et le décor, puis lance une première petite aventure.`;
    case 'choice':
      return `L'enfant choisit: « ${ch.text} ». Écris le chapitre suivant en intégrant exactement cette idée.`;
    case 'twist':
      return 'SURPRISE ! L’enfant demande un rebondissement inattendu, drôle ou magique (jamais effrayant). Écris le chapitre suivant avec ce rebondissement.';
    case 'character':
      return `Un nouveau personnage rejoint l'histoire: ${a.name} (voir sa fiche dans le LIVRE). Écris le chapitre suivant où il/elle arrive de façon naturelle et amusante.`;
    case 'edit':
      return `L'enfant veut changer un détail du chapitre ${a.chapterIndex + 1}: « ${ch.text} ». RÉÉCRIS ce chapitre ${a.chapterIndex + 1} en intégrant ce changement (garde le reste, même longueur). Les propositions doivent rester cohérentes avec la suite déjà écrite.`;
  }
}

export function buildUserPrompt(book: Book, a: Action, childText: string, upToIndex?: number): string {
  const ctxBook: Book = upToIndex === undefined ? book : { ...book, chapters: book.chapters.slice(0, upToIndex) };
  const { older, recent } = narrativeContext(ctxBook);
  const after = upToIndex !== undefined ? book.chapters.slice(upToIndex + 1).map((c) => c.summary).filter(Boolean).join(' / ') : '';
  const original = upToIndex !== undefined ? `\nCHAPITRE À RÉÉCRIRE (version actuelle): ${book.chapters[upToIndex]?.text}` : '';
  const afterTxt = after ? `\nSUITE DÉJÀ ÉCRITE (à garder cohérente): ${after}` : '';
  return `LIVRE DE L'HISTOIRE\n${compactMemory(book)}\n\n${older ? `RÉSUMÉ DES CHAPITRES PRÉCÉDENTS\n${older}\n\n` : ''}${recent ? `DERNIERS CHAPITRES\n${recent}\n` : ''}${original}${afterTxt}\n\nACTION\n${actionText(a, { text: childText })}`;
}

/** Génère un chapitre et renvoie le nouveau livre + le chapitre (pas de sauvegarde ici). */
export async function generateChapter(book: Book, lang: string, a: Action, childText = ''): Promise<{ book: Book; chapter: Chapter; title: string }> {
  const sys = systemPrompt(lang);
  const editIndex = a.type === 'edit' ? a.chapterIndex : undefined;
  let out: ChapterOut | null = null;
  for (let attempt = 0; attempt < 2 && !out; attempt++) {
    const extra = attempt === 1 ? '\n[RAPPEL: contenu 100% doux et adapté à 8 ans.]' : '';
    const cand = await chatJSON<ChapterOut>({
      system: sys,
      user: buildUserPrompt(book, a, childText, editIndex) + extra,
      schema: CHAPTER_SCHEMA as unknown as Record<string, unknown>,
      name: 'chapter',
      kind: 'chapter',
    });
    const m = await moderate(cand.chapter_text, 'output');
    if (m.flagged) logModeration('output', m.category ?? 'inconnu', cand.chapter_text, attempt === 0 ? 'régénéré' : 'remplacé');
    else out = cand;
  }
  if (!out) throw Object.assign(new Error('blocked'), { blocked: true });

  const choices: Choice[] = (out.choices ?? []).slice(0, 3).map((c) => ({ icon: c.icon || '✨', label: c.label, labelFr: c.label_fr || '' }));
  const chapter: Chapter = {
    id: a.type === 'edit' ? book.chapters[a.chapterIndex].id : uid(),
    text: out.chapter_text.trim(),
    translation: out.translation_fr?.trim() ?? '',
    summary: out.chapter_summary.trim(),
    imagePrompt: out.image_prompt.trim(),
    image: null,
    choices,
    chosen: a.type === 'edit' ? book.chapters[a.chapterIndex].chosen : childText || (a.type === 'twist' ? '🎁 Surprise !' : ''),
    kind: a.type === 'start' ? 'start' : a.type === 'twist' ? 'twist' : a.type === 'character' ? 'character' : a.type === 'edit' ? 'edit' : 'choice',
  };
  let nb = applyMemoryUpdate(book, out.memory_update as MemoryUpdate);
  if (a.type === 'edit') {
    nb.chapters[a.chapterIndex] = chapter;
    nb.notes = [...nb.notes, `Chapitre ${a.chapterIndex + 1}: ${childText}`].slice(-8);
  } else nb.chapters.push(chapter);
  return { book: nb, chapter, title: out.title };
}
