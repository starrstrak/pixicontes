// "Livre de l'histoire" : mémoire structurée envoyée à l'IA à chaque tour. Fonctions pures (testées).
import crypto from 'node:crypto';

export type Character = {
  id: string;
  name: string;
  appearance: string;
  personality: string;
  powers: string;
  flaws: string;
  relations: string;
  visual: string; // fiche de style visuelle figée (anglais), réinjectée dans chaque prompt d'image
  isHero: boolean;
  voice?: string; // profil de voix (option « voix par personnage »)
};
export type Choice = { icon: string; label: string; labelFr: string };
export type Chapter = {
  id: string;
  text: string;
  translation: string; // aide en français (traduction douce)
  summary: string;
  imagePrompt: string;
  image: string | null; // nom de fichier dans data/images
  choices: Choice[];
  chosen: string; // action choisie par l'enfant pour arriver au chapitre suivant
  kind: 'start' | 'choice' | 'twist' | 'character' | 'edit';
};
export type Place = { name: string; description: string };
export type Book = {
  premise: string;
  tone: string;
  setting: string;
  styleLock: string; // style visuel figé au départ (anglais)
  characters: Character[];
  places: Place[];
  objects: Place[];
  events: string[];
  notes: string[]; // changements demandés par l'enfant à respecter (retcons)
  chapters: Chapter[];
};

export const uid = () => crypto.randomBytes(6).toString('hex');

export const emptyBook = (): Book => ({ premise: '', tone: 'chaleureux et drôle', setting: '', styleLock: '', characters: [], places: [], objects: [], events: [], notes: [], chapters: [] });

export function newCharacter(p: Partial<Character> & { name: string }): Character {
  return { id: uid(), appearance: '', personality: '', powers: '', flaws: '', relations: '', visual: '', isHero: false, ...p };
}

export type MemoryUpdate = {
  setting?: string;
  characters?: Partial<Character>[];
  places?: Place[];
  objects?: Place[];
  events?: string[];
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const LIMITS = { characters: 12, places: 12, objects: 15, events: 14, notes: 8 };

/** Fusionne une mise à jour proposée par l'IA : ajoute/complète, n'écrase jamais la fiche visuelle déjà figée. */
export function applyMemoryUpdate(book: Book, up: MemoryUpdate): Book {
  const b: Book = structuredClone(book);
  if (up.setting?.trim()) b.setting = up.setting.trim();
  for (const c of up.characters ?? []) {
    if (!c.name?.trim()) continue;
    const ex = b.characters.find((x) => same(x.name, c.name!));
    if (ex) {
      for (const k of ['appearance', 'personality', 'powers', 'flaws', 'relations'] as const) {
        const v = (c[k] ?? '').trim();
        if (v) ex[k] = v;
      }
      if (!ex.visual && c.visual?.trim()) ex.visual = c.visual.trim();
    } else if (b.characters.length < LIMITS.characters) {
      b.characters.push(newCharacter({ ...c, name: c.name.trim(), isHero: false }));
    }
  }
  const mergeList = (list: Place[], inc: Place[] | undefined, max: number) => {
    for (const p of inc ?? []) {
      if (!p.name?.trim()) continue;
      const ex = list.find((x) => same(x.name, p.name));
      if (ex) ex.description = p.description?.trim() || ex.description;
      else if (list.length < max) list.push({ name: p.name.trim(), description: (p.description ?? '').trim() });
    }
  };
  mergeList(b.places, up.places, LIMITS.places);
  mergeList(b.objects, up.objects, LIMITS.objects);
  for (const e of up.events ?? []) if (e.trim()) b.events.push(e.trim());
  b.events = b.events.slice(-LIMITS.events);
  return b;
}

export function addNote(book: Book, note: string): Book {
  const b = structuredClone(book);
  b.notes = [...b.notes, note].slice(-LIMITS.notes);
  return b;
}

const line = (label: string, v: string) => (v ? `${label}: ${v}` : '');

/** Version compacte de la mémoire pour le prompt (limite les tokens). */
export function compactMemory(b: Book): string {
  const chars = b.characters
    .map((c) => [`- ${c.name}${c.isHero ? ' (héros)' : ''}`, line('look', c.appearance), line('caractère', c.personality), line('pouvoirs', c.powers), line('défauts', c.flaws), line('relations', c.relations)].filter(Boolean).join(' | '))
    .join('\n');
  const list = (xs: Place[]) => xs.map((x) => `${x.name}${x.description ? ` (${x.description})` : ''}`).join('; ');
  return [
    line('IDÉE', b.premise),
    line('TON', b.tone),
    line('DÉCOR ACTUEL', b.setting),
    `PERSONNAGES:\n${chars || '(aucun)'}`,
    line('LIEUX', list(b.places)),
    line('OBJETS', list(b.objects)),
    line('ÉVÉNEMENTS CLÉS', b.events.join(' ; ')),
    line('CHANGEMENTS VOULUS PAR L’ENFANT (à respecter)', b.notes.join(' ; ')),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Contexte narratif : anciens chapitres résumés (1 phrase chacun), 2 derniers chapitres en texte complet. */
export function narrativeContext(b: Book, fullLast = 2): { older: string; recent: string } {
  const n = b.chapters.length;
  const split = Math.max(0, n - fullLast);
  const older = b.chapters
    .slice(Math.max(0, split - 12), split)
    .map((c, i) => `${Math.max(0, split - 12) + i + 1}. ${c.summary || c.text.slice(0, 120)}`)
    .join('\n');
  const recent = b.chapters
    .slice(split)
    .map((c, i) => `[Chapitre ${split + i + 1}] ${c.text}`)
    .join('\n\n');
  return { older, recent };
}

/** Personnages à injecter dans le prompt d'image : ceux cités dans le texte du chapitre ou le prompt d'image. */
export function charactersInScene(b: Book, text: string): Character[] {
  const t = text.toLowerCase();
  const hit = b.characters.filter((c) => c.visual && t.includes(c.name.toLowerCase()));
  return (hit.length ? hit : b.characters.filter((c) => c.isHero && c.visual)).slice(0, 4);
}

/** Retire un chapitre ; les chapitres suivants sont conservés, une note de continuité est ajoutée. */
export function removeChapter(b: Book, chapterId: string): Book {
  const nb = structuredClone(b);
  const i = nb.chapters.findIndex((c) => c.id === chapterId);
  if (i < 0) return nb;
  nb.chapters.splice(i, 1);
  return nb;
}

/** Texte découpé en phrases (pour la lecture à voix haute et le surlignage). */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?…\n]+(?:[.!?…]+["»”)]*|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const s = m[0].trim();
    if (s) out.push(s);
  }
  // Fusionne les phrases très courtes (« Oh ! ») avec la suivante pour des segments audio naturels.
  const merged: string[] = [];
  for (const s of out) {
    if (merged.length && merged[merged.length - 1].length < 14) merged[merged.length - 1] += ' ' + s;
    else merged.push(s);
  }
  return merged;
}
