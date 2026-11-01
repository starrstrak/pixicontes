export type Character = { id: string; name: string; appearance: string; personality: string; powers: string; flaws: string; relations: string; visual: string; isHero: boolean; voice?: string };
export type Choice = { icon: string; label: string; labelFr: string };
export type Chapter = { id: string; text: string; translation: string; summary: string; imagePrompt: string; image: string | null; choices: Choice[]; chosen: string; kind: string };
export type Book = { premise: string; setting: string; characters: Character[]; chapters: Chapter[]; notes: string[] };
export type Story = { id: string; title: string; genreId: string | null; lang: string; style: string; cover: string | null; book: Book; canUndo: boolean; canRedo: boolean };
export type StoryItem = { id: string; title: string; genreId: string | null; lang: string; style: string; updatedAt: number; cover: string | null; chapters: number; heroes: string[] };
export type Genre = { id: string; name: string; icon: string; description: string; color: string; free: boolean };
export type Opt = { id: string; label: string; emoji: string };
export type Lang = { id: string; name: string; flag: string; iso: string };
export type Config = {
  hasKey: boolean; genres: Genre[]; styles: Opt[]; voices: import('./voice').VoiceProfile[]; voiceLab: import('./voice').VoiceLabData; granularity: 'phrase' | 'groupe' | 'chapitre'; dialogueProfile: string; tones: Opt[]; languages: Lang[]; softTranslation: boolean;
  defaults: { voice: string; tone: string; speed: number }; imageMode: 'chapter' | 'major' | 'off'; allowBrowserTts: boolean; sttBrowserFallback: boolean;
  perCharacterVoice: boolean; theme: 'day' | 'night' | 'auto'; timeLeftSec: number | null; regenLeft: number | null;
};
export type HeroDraft = { id?: string; name: string; appearance?: string; personality?: string; powers?: string; flaws?: string };
