// Types et aides pour les voix (miroir de backend/src/voices.ts).
import type { Config } from './types';
import type { Prefs } from './prefs';

export type VoiceSpec = {
  voice: string; pitch: number; timbre: string[]; emotion: string[]; expressiveness: number; variation: number;
  pace: number; diction: number; pauses: number; breath: boolean; age: string; accent: string; extra: string;
};
export type VoiceProfile = { id: string; label: string; emoji: string; desc: string; spec: VoiceSpec };
export type VoiceLabData = {
  bases: { id: string; label: string; desc: string }[];
  timbres: { id: string; label: string }[]; emotions: { id: string; label: string }[]; ages: { id: string; label: string }[];
  accents: Record<string, { id: string; label: string }[]>;
};
export const BLANK_SPEC: VoiceSpec = { voice: 'coral', pitch: 0, timbre: [], emotion: [], expressiveness: 2, variation: 2, pace: 0, diction: 1, pauses: 1, breath: false, age: '', accent: '', extra: '' };

/** Catalogue visible par l'enfant : profils du parent + « Mes voix » créées sur la tablette. */
export const allProfiles = (cfg: Config, p: Prefs): VoiceProfile[] => [...(cfg.voices as VoiceProfile[]), ...p.myVoices];
export function currentProfile(cfg: Config, p: Prefs): VoiceProfile {
  const all = allProfiles(cfg, p);
  return all.find((v) => v.id === (p.voice || cfg.defaults.voice)) ?? all[0];
}
/** Voix effective = profil choisi + ajustements de l'atelier + ambiance rapide. */
export function effectiveSpec(cfg: Config, p: Prefs): VoiceSpec {
  const base = currentProfile(cfg, p).spec;
  const t = p.voiceTweak ? { ...base, ...p.voiceTweak } : base;
  return t;
}
export const TONE_EMOTIONS: Record<string, string[]> = { calme: ['calme'], enjoue: ['joyeux', 'excite'], mysterieux: ['mysterieux'], aventureux: ['courageux', 'fier'] };
