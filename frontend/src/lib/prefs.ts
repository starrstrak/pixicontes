import { useSyncExternalStore } from 'react';
import type { VoiceProfile, VoiceSpec } from './voice';

export type Prefs = {
  mode: 'read' | 'listen' | 'both'; voice: string; tone: string; speed: number; volume: number;
  fontScale: number; font: 'normal' | 'clear' | 'dys'; contrast: boolean; theme: 'auto' | 'day' | 'night'; sounds: boolean;
  lang: string; softTr: boolean; explainLang: string; autoRead: boolean;
  voiceTweak: Partial<VoiceSpec> | null; myVoices: VoiceProfile[]; granularity: '' | 'phrase' | 'groupe' | 'chapitre';
};
export const DEFAULT_PREFS: Prefs = {
  mode: 'both', voice: '', tone: '', speed: 1, volume: 1, fontScale: 1, font: 'normal', contrast: false, theme: 'auto', sounds: true,
  lang: 'fr', softTr: true, explainLang: 'fr', autoRead: true,
  voiceTweak: null, myVoices: [], granularity: '',
};
const KEY = 'pixi_prefs';
let state: Prefs = (() => { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULT_PREFS; } })();
const subs = new Set<() => void>();
export const getPrefs = () => state;
export function setPrefs(p: Partial<Prefs>) {
  state = { ...state, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* mode privé */ }
  subs.forEach((f) => f());
}
export const usePrefs = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getPrefs);

/** Applique thème, police, contraste, taille de texte sur <html>. */
export function applyPrefs(p: Prefs, serverTheme: 'day' | 'night' | 'auto') {
  const r = document.documentElement;
  const t = p.theme !== 'auto' ? p.theme : serverTheme;
  const night = t === 'night' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  r.dataset.theme = night ? 'night' : 'day';
  r.dataset.font = p.font === 'normal' ? '' : p.font;
  r.dataset.contrast = p.contrast ? 'high' : '';
  r.style.setProperty('--fs', String(p.fontScale));
}
