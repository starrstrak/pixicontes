// Voix : 13 voix de base OpenAI × réglages fins (tonalité, timbre, émotions, modulation, variation, rythme, diction, pauses, souffle, âge, accent).
// gpt-4o-mini-tts n'a pas de curseur numérique de hauteur/timbre : tout passe par des consignes d'interprétation en langage naturel,
// construites ici de façon déterministe (donc cachables). Voir docs/VOIX.md.
import { z } from 'zod';

export type BaseVoice = { id: string; label: string; desc: string; tts1: boolean };
/** Descriptions indicatives (ressenti à l'écoute) : à vérifier avec l'échantillon. `tts1` = disponible aussi avec tts-1 / tts-1-hd. */
export const BASE_VOICES: BaseVoice[] = [
  { id: 'marin', label: 'Marin', desc: 'Très naturelle, chaleureuse, la plus « humaine » (nouvelle voix)', tts1: false },
  { id: 'cedar', label: 'Cedar', desc: 'Très naturelle, posée et riche (nouvelle voix)', tts1: false },
  { id: 'coral', label: 'Coral', desc: 'Chaleureuse, souriante, amicale', tts1: true },
  { id: 'sage', label: 'Sage', desc: 'Calme, douce, rassurante', tts1: true },
  { id: 'ballad', label: 'Ballad', desc: 'Mélodieuse, tendre, un peu chantante', tts1: false },
  { id: 'verse', label: 'Verse', desc: 'Polyvalente, très expressive', tts1: false },
  { id: 'nova', label: 'Nova', desc: 'Jeune, énergique, claire', tts1: true },
  { id: 'shimmer', label: 'Shimmer', desc: 'Claire, lumineuse, légère', tts1: true },
  { id: 'fable', label: 'Fable', desc: 'Conteuse, expressive, un peu théâtrale', tts1: true },
  { id: 'alloy', label: 'Alloy', desc: 'Neutre, équilibrée, polyvalente', tts1: true },
  { id: 'ash', label: 'Ash', desc: 'Posée, légèrement rauque, décontractée', tts1: true },
  { id: 'echo', label: 'Echo', desc: 'Nette, masculine, directe', tts1: true },
  { id: 'onyx', label: 'Onyx', desc: 'Grave, profonde, autoritaire', tts1: true },
];
const VOICE_IDS = BASE_VOICES.map((v) => v.id) as [string, ...string[]];

export const TIMBRES: [string, string, string][] = [
  ['chaud', 'Chaud', 'warm'], ['velours', 'Velouté', 'velvety and smooth'], ['clair', 'Clair', 'bright and clear'], ['rond', 'Rond', 'round and full-bodied'],
  ['aerien', 'Aérien', 'airy and light, slightly breathy'], ['rauque', 'Légèrement rauque', 'slightly husky, with a touch of gravel'], ['miel', 'Miel', 'honeyed and sweet'],
  ['resonant', 'Résonant', 'deep and resonant'], ['net', 'Net', 'crisp and precise'], ['nasille', 'Nasillard (rigolo)', 'comically nasal and cartoonish'],
];
export const EMOTIONS: [string, string, string][] = [
  ['calme', 'Calme', 'calm and soothing'], ['joyeux', 'Joyeux', 'joyful and smiling'], ['tendre', 'Tendre', 'tender and affectionate'], ['curieux', 'Curieux', 'curious and inquisitive'],
  ['mysterieux', 'Mystérieux', 'mysterious and intriguing, never frightening'], ['excite', 'Excité', 'excited and enthusiastic'], ['emerveille', 'Émerveillé', 'full of wonder and amazement'],
  ['rassurant', 'Rassurant', 'reassuring and safe'], ['malicieux', 'Malicieux', 'playful and mischievous'], ['solennel', 'Solennel', 'solemn and dignified'],
  ['fier', 'Fier / héroïque', 'proud and heroic'], ['melancolique', 'Mélancolique doux', 'gently wistful'], ['endormi', 'Berceuse', 'sleepy, lulling, bedtime-soft'],
  ['suspense', 'Suspense doux', 'gentle suspense, hushed anticipation'], ['comique', 'Comique', 'comical and silly'], ['courageux', 'Courageux', 'brave and determined'],
];
export const AGES: [string, string, string][] = [
  ['', 'Au choix de la voix', ''], ['enfant', 'Enfant', 'sounding like a friendly child around 8-10 years old'], ['jeune', 'Jeune', 'sounding like a young adult in their twenties'],
  ['adulte', 'Adulte', 'sounding like a warm adult in their thirties or forties'], ['ancien', 'Personne âgée', 'sounding like a wise elderly storyteller'],
];
export const ACCENTS: Record<string, [string, string, string][]> = {
  fr: [['', 'Français standard', 'neutral standard French from France'], ['suisse', 'Suisse romand', 'a gentle Swiss French (Romandie) accent, unhurried'], ['belge', 'Belge', 'a soft Belgian French accent'], ['quebec', 'Québécois', 'a Quebec French accent'], ['sud', 'Du Sud', 'a sunny southern French accent']],
  de: [['', 'Hochdeutsch', 'clear standard German (Hochdeutsch)'], ['suisse', 'Suisse (hochdeutsch)', 'Swiss-accented standard German, gentle'], ['at', 'Autrichien', 'an Austrian German accent']],
  en: [['', 'Britannique', 'a clear British English accent'], ['us', 'Américain', 'a friendly American English accent'], ['ie', 'Irlandais', 'a soft Irish accent'], ['au', 'Australien', 'a friendly Australian accent']],
};
const LEVELS = {
  pitch: ['very deep, low-pitched', 'slightly lower-pitched', 'natural pitch', 'slightly higher-pitched', 'bright, high-pitched'],
  expr: ['even, understated delivery', 'lightly expressive', 'naturally expressive, like a person reading to a child', 'very expressive, a true storyteller', 'highly theatrical, with character acting and distinct voices'],
  variation: ['steady and uniform intonation', 'subtle variations in pitch and rhythm', 'natural variations in pitch and rhythm', 'lively variations in pitch and rhythm', 'wide dynamic variations in pitch, rhythm and volume'],
  pace: ['very slow and soothing', 'slow and relaxed', 'moderate, natural pace', 'brisk', 'fast and lively'],
  diction: ['relaxed, conversational articulation', 'natural, clear articulation', 'very precise articulation, helpful for a child learning words'],
  pauses: ['short pauses', 'natural pauses at commas and sentence ends', 'longer, dramatic pauses before key moments'],
};
const LANG_NAME: Record<string, string> = { fr: 'French', de: 'German', en: 'English' };

export const specSchema = z.object({
  voice: z.enum(VOICE_IDS).default('coral'),
  pitch: z.number().int().min(-2).max(2).default(0), // -2 très grave … +2 très aigu
  timbre: z.array(z.string().max(20)).max(4).default([]),
  emotion: z.array(z.string().max(20)).max(4).default([]),
  expressiveness: z.number().int().min(0).max(4).default(2), // monotone … théâtral
  variation: z.number().int().min(0).max(4).default(2), // uniforme … très variée
  pace: z.number().int().min(-2).max(2).default(0), // très lent … rapide
  diction: z.number().int().min(0).max(2).default(1),
  pauses: z.number().int().min(0).max(2).default(1),
  breath: z.boolean().default(false),
  age: z.string().max(10).default(''),
  accent: z.string().max(10).default(''),
  extra: z.string().max(200).default(''), // consigne libre
});
export type VoiceSpec = z.infer<typeof specSchema>;
export const defaultSpec = (p: Partial<VoiceSpec> = {}): VoiceSpec => specSchema.parse(p);

const pick = (table: [string, string, string][], keys: string[]) => keys.map((k) => table.find((t) => t[0] === k)?.[2]).filter(Boolean) as string[];

/** Construit la consigne d'interprétation (anglais : mieux suivi par le modèle) + langue du texte. */
export function buildInstructions(s: VoiceSpec, lang = 'fr'): string {
  const L = LANG_NAME[lang] ?? 'French';
  const accent = (ACCENTS[lang] ?? ACCENTS.fr).find((a) => a[0] === s.accent)?.[2] ?? (ACCENTS[lang] ?? ACCENTS.fr)[0][2];
  const timbres = pick(TIMBRES, s.timbre), emotions = pick(EMOTIONS, s.emotion);
  const age = AGES.find((a) => a[0] === s.age)?.[2];
  const lines = [
    `Voice: ${[age, timbres.length ? `${timbres.join(', ')} timbre` : ''].filter(Boolean).join(', ') || 'natural human voice'}; ${LEVELS.pitch[s.pitch + 2]}.`,
    `Language and accent: read in ${L} with ${accent}.`,
    emotions.length ? `Emotion: ${emotions.join(', ')}.` : '',
    `Delivery: ${LEVELS.expr[s.expressiveness]}; ${LEVELS.variation[s.variation]}.`,
    `Pacing: ${LEVELS.pace[s.pace + 2]}; ${LEVELS.pauses[s.pauses]}.`,
    `Pronunciation: ${LEVELS.diction[s.diction]}.`,
    s.breath ? 'Include soft, subtle breaths between phrases, like a real person reading aloud.' : '',
    s.extra.trim() ? `Extra direction: ${s.extra.trim()}` : '',
    'Always sound like a real human storyteller reading a bedtime story to an 8-year-old: natural intonation, smooth transitions between sentences, no robotic or flat text-to-speech cadence. Never scary.',
  ];
  return lines.filter(Boolean).join('\n');
}

export type VoiceProfile = { id: string; label: string; emoji: string; desc: string; spec: VoiceSpec };
const P = (id: string, label: string, emoji: string, desc: string, spec: Partial<VoiceSpec>): VoiceProfile => ({ id, label, emoji, desc, spec: defaultSpec(spec) });
/** Catalogue de départ : 16 profils prêts à l'emploi (modifiables ou extensibles dans l'admin). */
export const DEFAULT_PROFILES: VoiceProfile[] = [
  P('douce', 'Maman du soir', '🌙', 'Douce et rassurante, pour l’histoire du soir', { voice: 'sage', timbre: ['chaud', 'velours'], emotion: ['tendre', 'rassurant'], expressiveness: 3, variation: 2, pace: -1, pauses: 2, breath: true, age: 'adulte' }),
  P('livre', 'Livre audio premium', '🎧', 'Le plus naturel : comme un vrai livre audio', { voice: 'marin', timbre: ['chaud', 'rond'], emotion: ['emerveille'], expressiveness: 3, variation: 3, pace: 0, pauses: 1, breath: true, age: 'adulte' }),
  P('joyeuse', 'Grande sœur joyeuse', '🌞', 'Souriante et pleine d’énergie', { voice: 'coral', timbre: ['clair'], emotion: ['joyeux', 'excite'], expressiveness: 3, variation: 3, pace: 1, age: 'jeune' }),
  P('conteur', 'Grand-père conteur', '🧙', 'Voix grave de vieux conteur, mystérieuse sans faire peur', { voice: 'onyx', pitch: -2, timbre: ['resonant', 'rauque'], emotion: ['solennel', 'emerveille'], expressiveness: 3, variation: 2, pace: -1, pauses: 2, breath: true, age: 'ancien' }),
  P('mamie', 'Mamie douce', '🧶', 'Âgée, tendre, pleine de souvenirs', { voice: 'ballad', pitch: -1, timbre: ['chaud', 'miel'], emotion: ['tendre', 'calme'], expressiveness: 3, pace: -1, pauses: 2, breath: true, age: 'ancien' }),
  P('jeune', 'Copain de 10 ans', '🧒', 'Naturel, dynamique, comme un camarade', { voice: 'nova', pitch: 1, timbre: ['clair'], emotion: ['curieux', 'joyeux'], expressiveness: 3, variation: 3, pace: 1, age: 'enfant' }),
  P('aventurier', 'Grand frère aventurier', '🧭', 'Net et héroïque', { voice: 'echo', timbre: ['net'], emotion: ['courageux', 'fier'], expressiveness: 3, variation: 3, pace: 1, age: 'jeune' }),
  P('mysterieuse', 'Fée mystérieuse', '🔮', 'Aérienne, chuchotée par moments', { voice: 'ballad', pitch: 1, timbre: ['aerien'], emotion: ['mysterieux', 'emerveille'], expressiveness: 3, variation: 3, pace: -1, pauses: 2, breath: true, age: 'jeune' }),
  P('rigolote', 'Papa rigolo', '🤡', 'Expressif, plein d’humour', { voice: 'ash', timbre: ['rond'], emotion: ['malicieux', 'comique'], expressiveness: 4, variation: 4, pace: 0, age: 'adulte' }),
  P('pirate', 'Vieux pirate', '🏴‍☠️', 'Rauque et théâtral, pour les histoires de pirates', { voice: 'fable', pitch: -1, timbre: ['rauque'], emotion: ['comique', 'courageux'], expressiveness: 4, variation: 4, age: 'adulte', extra: 'A jolly, gruff pirate flavour, but still clearly intelligible.' }),
  P('narrateur', 'Narrateur calme', '📖', 'Neutre et très clair', { voice: 'alloy', timbre: ['net'], emotion: ['calme'], expressiveness: 2, variation: 2, diction: 2, age: 'adulte' }),
  P('cedre', 'Conteur de la forêt', '🌲', 'Posé, riche, naturel', { voice: 'cedar', timbre: ['chaud', 'resonant'], emotion: ['calme', 'emerveille'], expressiveness: 3, variation: 3, pace: -1, pauses: 2, breath: true, age: 'adulte' }),
  P('berceuse', 'Berceuse', '😴', 'Très lent et doux, pour s’endormir', { voice: 'sage', pitch: -1, timbre: ['aerien', 'velours'], emotion: ['endormi', 'tendre'], expressiveness: 2, variation: 1, pace: -2, pauses: 2, breath: true, age: 'adulte' }),
  P('suspense', 'Suspense doux', '🕯️', 'Pour les enquêtes, sans faire peur', { voice: 'verse', pitch: -1, timbre: ['velours'], emotion: ['suspense', 'curieux'], expressiveness: 4, variation: 3, pace: -1, pauses: 2, breath: true }),
  P('langue', 'Prof de langue', '🗣️', 'Diction très claire et lente pour apprendre', { voice: 'alloy', timbre: ['net', 'chaud'], emotion: ['rassurant'], expressiveness: 2, variation: 2, pace: -1, diction: 2, pauses: 2, age: 'adulte' }),
  P('suisse', 'Conteuse romande', '🏔️', 'Accent suisse romand, tranquille', { voice: 'coral', timbre: ['chaud'], emotion: ['tendre', 'joyeux'], expressiveness: 3, pace: -1, accent: 'suisse', age: 'adulte' }),
];

export const TONE_EMOTIONS: Record<string, string[]> = { calme: ['calme'], enjoue: ['joyeux', 'excite'], mysterieux: ['mysterieux'], aventureux: ['courageux', 'fier'] };

/** Voix valable pour le modèle choisi : tts-1 ne propose que 9 voix. */
export function voiceFor(spec: VoiceSpec, model: string): string {
  const v = BASE_VOICES.find((b) => b.id === spec.voice) ?? BASE_VOICES[2];
  return /^tts-1/.test(model) && !v.tts1 ? 'coral' : v.id;
}
