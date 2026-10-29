// Valeurs par défaut des réglages, genres, styles, voix et tarifs.
// Les tarifs sont des ESTIMATIONS (USD) modifiables dans l'admin : à vérifier sur la page officielle OpenAI.

export type VoiceProfile = { id: string; label: string; emoji: string; voice: string; instructions: string };

export const VOICE_PROFILES: VoiceProfile[] = [
  { id: 'douce', label: 'Douce', emoji: '🌙', voice: 'sage', instructions: 'Voix douce, chaleureuse et rassurante, comme un parent qui lit une histoire du soir.' },
  { id: 'joyeuse', label: 'Joyeuse', emoji: '🌞', voice: 'coral', instructions: 'Voix joyeuse, souriante et pleine d’énergie, pour un enfant de 8 ans.' },
  { id: 'conteur', label: 'Conteur grave', emoji: '🧙', voice: 'onyx', instructions: 'Voix grave de vieux conteur, posée, avec du mystère mais jamais effrayante.' },
  { id: 'jeune', label: 'Jeune', emoji: '🧒', voice: 'nova', instructions: 'Voix jeune et dynamique, naturelle, comme un grand frère ou une grande sœur.' },
  { id: 'mysterieuse', label: 'Mystérieuse', emoji: '🔮', voice: 'ballad', instructions: 'Voix mystérieuse et captivante, chuchotée par moments, sans faire peur.' },
  { id: 'rigolote', label: 'Rigolote', emoji: '🤡', voice: 'ash', instructions: 'Voix rigolote et expressive, avec de l’humour dans le ton.' },
];

export const TONES: { id: string; label: string; emoji: string; instructions: string }[] = [
  { id: 'calme', label: 'Calme', emoji: '😌', instructions: 'Ton calme et apaisé, rythme tranquille.' },
  { id: 'enjoue', label: 'Enjoué', emoji: '😄', instructions: 'Ton enjoué, vif et plein d’enthousiasme.' },
  { id: 'mysterieux', label: 'Mystérieux', emoji: '🕯️', instructions: 'Ton mystérieux, pauses courtes avant les moments clés.' },
  { id: 'aventureux', label: 'Aventureux', emoji: '⚔️', instructions: 'Ton aventureux et dynamique, comme une grande épopée.' },
];

export const STYLES: { id: string; label: string; emoji: string; prompt: string }[] = [
  { id: 'aquarelle', label: 'Aquarelle douce', emoji: '🎨', prompt: 'soft watercolor children’s book illustration, gentle washes, pastel but vivid colors, paper texture' },
  { id: 'cartoon', label: 'Dessin animé', emoji: '🖍️', prompt: 'colorful modern cartoon children’s illustration, bold clean outlines, bright harmonious colors' },
  { id: 'papier', label: 'Papier découpé', emoji: '✂️', prompt: 'cut-paper collage children’s illustration, layered paper shapes, soft shadows, warm colors' },
  { id: '3d', label: '3D mignonne', emoji: '🧸', prompt: 'cute soft 3D rendered children’s animation style, rounded shapes, soft lighting, pastel vivid colors' },
];

export const STYLE_BASE =
  'Modern children’s book illustration, round and soft shapes, vivid but harmonious colors, soft warm lighting, friendly and safe mood, no text, no letters, no words, nothing scary or realistic-gory.';

export type GenreSeed = { id: string; name: string; icon: string; description: string; prompt: string; color: string };
export const GENRES: GenreSeed[] = [
  { id: 'aventure', name: 'Aventure', icon: '🧭', color: '#ff9f43', description: 'Explorer, découvrir, oser !', prompt: 'Une grande aventure pleine de découvertes, de cartes au trésor et de courage.' },
  { id: 'magie', name: 'Magie et fées', icon: '🧚', color: '#c78bff', description: 'Baguettes, potions et poussière d’étoiles.', prompt: 'Un monde de magie douce avec des fées, des sorts rigolos et des potions.' },
  { id: 'animaux', name: 'Animaux', icon: '🦊', color: '#7bd88f', description: 'Des amis à poils, plumes ou écailles.', prompt: 'Des animaux qui parlent et vivent une belle aventure dans la nature.' },
  { id: 'espace', name: 'Espace', icon: '🚀', color: '#5b8cff', description: 'Fusées, planètes et extraterrestres gentils.', prompt: 'Un voyage dans l’espace avec des planètes colorées et des amis venus des étoiles.' },
  { id: 'pirates', name: 'Pirates', icon: '🏴‍☠️', color: '#e8a24a', description: 'Bateaux, perroquets et trésors.', prompt: 'Des pirates rigolos en mer, avec un bateau, un perroquet et un trésor à trouver.' },
  { id: 'dinosaures', name: 'Dinosaures', icon: '🦖', color: '#6cc24a', description: 'Les géants d’autrefois.', prompt: 'Un monde préhistorique avec des dinosaures gentils, des volcans et des oeufs mystérieux.' },
  { id: 'mystere', name: 'Mystère et enquête', icon: '🔍', color: '#8a7bd8', description: 'Indices, loupe et énigmes.', prompt: 'Une enquête amusante avec des indices à trouver et un mystère doux à résoudre.' },
  { id: 'superheros', name: 'Super-héros', icon: '🦸', color: '#ff5c5c', description: 'Super-pouvoirs et capes.', prompt: 'Des super-héros avec des pouvoirs rigolos qui aident leur ville.' },
  { id: 'ecole', name: 'École', icon: '🎒', color: '#f6c445', description: 'Copains, classe et récré.', prompt: 'Une histoire d’école avec des copains, une maîtresse sympa et une surprise.' },
  { id: 'drole', name: 'Histoires drôles', icon: '🤪', color: '#ff7ac8', description: 'Pour rire aux éclats.', prompt: 'Une histoire très drôle pleine de situations absurdes et de blagues douces.' },
  { id: 'contes', name: 'Contes revisités', icon: '📖', color: '#e0795a', description: 'Les contes classiques, mais autrement.', prompt: 'Un conte classique revisité avec une surprise inattendue et beaucoup d’humour.' },
  { id: 'mer', name: 'Sous la mer', icon: '🐙', color: '#38c6d9', description: 'Poissons, coraux et sirènes.', prompt: 'Un royaume sous la mer avec des poissons, des coraux, des sirènes et un trésor.' },
  { id: 'robots', name: 'Robots', icon: '🤖', color: '#8aa0b8', description: 'Machines, boutons et inventions.', prompt: 'Des robots gentils et rigolos, des inventions et une panne à réparer.' },
  { id: 'chevaliers', name: 'Chevaliers et dragons', icon: '🐉', color: '#e45f5f', description: 'Châteaux, épées et dragons.', prompt: 'Un château, un chevalier courageux et un dragon qui n’est pas si méchant.' },
  { id: 'temps', name: 'Voyage dans le temps', icon: '⏳', color: '#a78bfa', description: 'Hier, demain, il y a longtemps…', prompt: 'Un voyage dans le temps avec une machine étrange et des époques surprenantes.' },
  { id: 'libre', name: 'Idée libre', icon: '💡', color: '#ffd166', description: 'Raconte ton idée !', prompt: 'Histoire basée sur l’idée de l’enfant.' },
];

export type Pricing = {
  text: Record<string, { in: number; out: number }>; // USD par million de tokens
  tts: Record<string, { perMinute: number }>;
  stt: Record<string, { perMinute: number }>;
  image: Record<string, Record<string, Record<string, number>>>; // modèle > qualité > taille > USD/image
};
export const PRICING: Pricing = {
  text: {
    'gpt-5-nano': { in: 0.05, out: 0.4 },
    'gpt-5-mini': { in: 0.25, out: 2.0 },
    'gpt-4.1-nano': { in: 0.1, out: 0.4 },
    'gpt-4o-mini': { in: 0.15, out: 0.6 },
    'gpt-4.1-mini': { in: 0.4, out: 1.6 },
  },
  tts: { 'gpt-4o-mini-tts': { perMinute: 0.015 }, 'tts-1': { perMinute: 0.015 }, 'tts-1-hd': { perMinute: 0.03 } },
  stt: { 'gpt-4o-mini-transcribe': { perMinute: 0.003 }, 'gpt-4o-transcribe': { perMinute: 0.006 }, 'whisper-1': { perMinute: 0.006 } },
  image: {
    'gpt-image-1-mini': {
      low: { '1024x1024': 0.005, '1024x1536': 0.006, '1536x1024': 0.006 },
      medium: { '1024x1024': 0.011, '1024x1536': 0.015, '1536x1024': 0.015 },
      high: { '1024x1024': 0.036, '1024x1536': 0.052, '1536x1024': 0.052 },
    },
    'gpt-image-1': {
      low: { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
      medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
      high: { '1024x1024': 0.167, '1024x1536': 0.25, '1536x1024': 0.25 },
    },
  },
};

export const DEFAULT_SETTINGS = {
  models: {
    text: 'gpt-5-nano',
    tts: 'gpt-4o-mini-tts',
    stt: 'gpt-4o-mini-transcribe',
    image: 'gpt-image-1-mini',
    moderation: 'omni-moderation-latest',
  },
  story: { minWords: 80, maxWords: 150, maxOutputTokens: 1800 },
  image: { mode: 'chapter' as 'chapter' | 'major' | 'off', quality: 'low', size: '1024x1024', regenPerDay: 3 },
  voice: {
    defaultProfile: 'douce',
    dialogueProfile: 'joyeuse',
    perCharacter: false,
    defaultSpeed: 1,
    defaultTone: 'calme',
    allowBrowserTts: false,
  },
  stt: { browserFallback: true },
  languages: { enabled: ['fr', 'de', 'en'], level: 'A1', softTranslation: true },
  genresActive: null as string[] | null, // null = tous
  limits: { dailyMinutes: 0, monthlyBudgetUsd: 5, dailyChapters: 40, dailyImages: 20, dailyTtsChars: 20000 },
  theme: 'auto' as 'day' | 'night' | 'auto',
  chfPerUsd: 0.8,
  pricing: PRICING,
};
export type Settings = typeof DEFAULT_SETTINGS;
