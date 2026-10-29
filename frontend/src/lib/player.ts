// Lecteur audio de l'histoire : phrase par phrase, préchargement de la suivante, surlignage synchronisé.
import { api } from './api';

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused';
export type PlayerOpts = { profile: string; dialogueProfile: string | null; tone: string; lang: string; speed: number; volume: number; browserTts: boolean };
type Seg = { text: string; profile: string };

const cache = new Map<string, Promise<string>>(); // clé -> blob URL (en mémoire ; le serveur garde le MP3 sur disque)
function fetchAudio(s: Seg, o: PlayerOpts): Promise<string> {
  const key = [s.profile, o.tone, o.lang, s.text].join('|');
  let p = cache.get(key);
  if (!p) {
    p = api.blob('/api/tts', { text: s.text, profile: s.profile, tone: o.tone, lang: o.lang }).then((b) => URL.createObjectURL(b));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    if (cache.size > 120) { const k = cache.keys().next().value as string; void cache.get(k)?.then((u) => URL.revokeObjectURL(u)); cache.delete(k); }
  }
  return p;
}

let unlocked = false;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
/** À appeler sur le premier geste de l'enfant : débloque la lecture automatique sur tablette. */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  const a = new Audio(SILENT);
  void a.play().catch(() => { unlocked = false; });
}

export class StoryPlayer {
  private audio = new Audio();
  private segs: Seg[] = [];
  private idx = 0;
  private token = 0;
  state: PlayerState = 'idle';
  constructor(private o: () => PlayerOpts, private cb: { onState: (s: PlayerState) => void; onSentence: (i: number) => void; onProgress: (i: number, frac: number) => void; onEnd: () => void; onError: (m: string) => void }) {
    this.audio.preservesPitch = true;
    this.audio.ontimeupdate = () => { if (this.audio.duration) this.cb.onProgress(this.idx, this.audio.currentTime / this.audio.duration); };
    this.audio.onended = () => this.next(true);
  }
  private set(s: PlayerState) { this.state = s; this.cb.onState(s); }
  load(sentences: string[]) {
    this.stop();
    const o = this.o();
    this.segs = sentences.map((t) => ({ text: t, profile: o.dialogueProfile && /^\s*(«|—|"|“)/.test(t) ? o.dialogueProfile : o.profile }));
  }
  get count() { return this.segs.length; }
  get index() { return this.idx; }
  async playFrom(i: number) {
    const my = ++this.token;
    this.idx = Math.max(0, Math.min(i, this.segs.length - 1));
    if (!this.segs.length) return;
    this.audio.pause();
    this.cb.onSentence(this.idx);
    this.set('loading');
    const o = this.o();
    const seg = this.segs[this.idx];
    try {
      const url = await fetchAudio(seg, o);
      if (my !== this.token) return;
      this.audio.src = url;
      this.audio.playbackRate = o.speed;
      this.audio.volume = o.volume;
      await this.audio.play();
      this.set('playing');
      for (const n of [1, 2]) { const nx = this.segs[this.idx + n]; if (nx) void fetchAudio(nx, o).catch(() => {}); }
    } catch (e) {
      if (my !== this.token) return;
      if (o.browserTts && 'speechSynthesis' in window) return this.browserSpeak(seg.text, my);
      this.set('idle');
      this.cb.onError((e as Error).message);
    }
  }
  private browserSpeak(text: string, my: number) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.o().lang; u.rate = this.o().speed; u.volume = this.o().volume;
    u.onend = () => { if (my === this.token) this.next(true); };
    speechSynthesis.cancel(); speechSynthesis.speak(u); this.set('playing');
  }
  private next(auto: boolean) {
    if (this.idx + 1 >= this.segs.length) { this.set('idle'); if (auto) this.cb.onEnd(); return; }
    void this.playFrom(this.idx + 1);
  }
  skip(d: number) { void this.playFrom(this.idx + d); }
  pause() { this.audio.pause(); if ('speechSynthesis' in window) speechSynthesis.pause(); if (this.state === 'playing') this.set('paused'); }
  resume() { if (this.state === 'paused') { void this.audio.play(); if ('speechSynthesis' in window) speechSynthesis.resume(); this.set('playing'); } else void this.playFrom(this.idx); }
  setSpeed(s: number) { this.audio.playbackRate = s; }
  setVolume(v: number) { this.audio.volume = v; }
  stop() { this.token++; this.audio.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); this.set('idle'); }
}

/** Joue un texte isolé (échantillon de voix, prononciation d'un mot). */
export async function playOnce(text: string, o: PlayerOpts) {
  const a = new Audio(await fetchAudio({ text, profile: o.profile }, o));
  a.playbackRate = o.speed; a.volume = o.volume;
  await a.play();
}
