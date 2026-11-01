// Lecteur audio de l'histoire : segments (phrase / groupe de phrases / chapitre), préchargement, surlignage synchronisé.
import { api } from './api';
import type { VoiceSpec } from './voice';

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused';
export type Granularity = 'phrase' | 'groupe' | 'chapitre';
export type PlayerOpts = { spec: VoiceSpec; dialogueSpec: VoiceSpec | null; lang: string; speed: number; volume: number; browserTts: boolean; granularity: Granularity };
type Seg = { text: string; spec: VoiceSpec; first: number; last: number; weights: number[]; total: number };

const cache = new Map<string, Promise<string>>(); // clé -> blob URL (le serveur garde aussi le MP3 sur disque)
function fetchAudio(text: string, spec: VoiceSpec, lang: string): Promise<string> {
  const key = JSON.stringify([spec, lang, text]);
  let p = cache.get(key);
  if (!p) {
    p = api.blob('/api/tts', { text, spec, lang }).then((b) => URL.createObjectURL(b));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    if (cache.size > 80) { const k = cache.keys().next().value as string; void cache.get(k)?.then((u) => URL.revokeObjectURL(u)); cache.delete(k); }
  }
  return p;
}

let unlocked = false;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
/** À appeler sur le premier geste de l'enfant : débloque la lecture automatique sur tablette. */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  void new Audio(SILENT).play().catch(() => { unlocked = false; });
}

const isDialogue = (t: string) => /^\s*(«|—|"|“)/.test(t);
/** Regroupe les phrases : « phrase » = 1 par segment ; « groupe » ≈ 220 car. max ; « chapitre » ≈ tout (≤ 1700 car.). Un changement de voix coupe toujours. */
export function buildSegments(sentences: string[], o: PlayerOpts): Seg[] {
  const maxChars = o.granularity === 'phrase' ? 0 : o.granularity === 'groupe' ? 220 : 1700;
  const maxCount = o.granularity === 'groupe' ? 3 : 99;
  const segs: Seg[] = [];
  let cur: { idx: number[]; spec: VoiceSpec; len: number } | null = null;
  const flush = () => {
    if (!cur) return;
    const ws = cur.idx.map((i) => sentences[i].length);
    segs.push({ text: cur.idx.map((i) => sentences[i]).join(' '), spec: cur.spec, first: cur.idx[0], last: cur.idx.at(-1)!, weights: ws, total: ws.reduce((a, b) => a + b, 0) });
    cur = null;
  };
  sentences.forEach((t, i) => {
    const spec = o.dialogueSpec && isDialogue(t) ? o.dialogueSpec : o.spec;
    if (cur && (cur.spec !== spec || cur.idx.length >= maxCount || cur.len + t.length > maxChars)) flush();
    if (!cur) cur = { idx: [], spec, len: 0 };
    cur.idx.push(i); cur.len += t.length + 1;
  });
  flush();
  return segs;
}

export class StoryPlayer {
  private audio = new Audio();
  private segs: Seg[] = [];
  private sent: string[] = [];
  private si = 0; // index du segment courant
  private sIdx = 0; // index de la phrase courante
  private token = 0;
  state: PlayerState = 'idle';
  constructor(private o: () => PlayerOpts, private cb: { onState: (s: PlayerState) => void; onSentence: (i: number) => void; onProgress: (i: number, frac: number) => void; onEnd: () => void; onError: (m: string) => void }) {
    this.audio.preservesPitch = true;
    this.audio.ontimeupdate = () => this.tick();
    this.audio.onended = () => this.nextSeg(true);
  }
  private tick() {
    const seg = this.segs[this.si];
    if (!seg || !this.audio.duration) return;
    let pos = (this.audio.currentTime / this.audio.duration) * seg.total;
    for (let k = 0; k < seg.weights.length; k++) {
      if (pos <= seg.weights[k] || k === seg.weights.length - 1) {
        const idx = seg.first + k;
        if (idx !== this.sIdx) { this.sIdx = idx; this.cb.onSentence(idx); }
        this.cb.onProgress(idx, Math.min(1, pos / seg.weights[k]));
        return;
      }
      pos -= seg.weights[k];
    }
  }
  private set(s: PlayerState) { this.state = s; this.cb.onState(s); }
  load(sentences: string[]) { this.stop(); this.sent = sentences; this.segs = buildSegments(sentences, this.o()); }
  get count() { return this.sent.length; }
  get index() { return this.sIdx; }
  async playFrom(sentence: number) {
    const my = ++this.token;
    if (!this.segs.length) return;
    this.sIdx = Math.max(0, Math.min(sentence, this.sent.length - 1));
    this.si = Math.max(0, this.segs.findIndex((s) => this.sIdx >= s.first && this.sIdx <= s.last));
    const seg = this.segs[this.si];
    this.audio.pause();
    this.cb.onSentence(this.sIdx);
    this.set('loading');
    const o = this.o();
    try {
      const url = await fetchAudio(seg.text, seg.spec, o.lang);
      if (my !== this.token) return;
      this.audio.src = url; this.audio.playbackRate = o.speed; this.audio.volume = o.volume;
      const offset = seg.weights.slice(0, this.sIdx - seg.first).reduce((a, b) => a + b, 0) / seg.total;
      if (offset > 0) await new Promise<void>((r) => { this.audio.onloadedmetadata = () => { this.audio.currentTime = offset * this.audio.duration; r(); }; });
      await this.audio.play();
      this.set('playing');
      for (const n of [1, 2]) { const nx = this.segs[this.si + n]; if (nx) void fetchAudio(nx.text, nx.spec, o.lang).catch(() => {}); }
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
    u.onend = () => { if (my === this.token) this.nextSeg(true); };
    speechSynthesis.cancel(); speechSynthesis.speak(u); this.set('playing');
  }
  private nextSeg(auto: boolean) {
    const nx = this.segs[this.si + 1];
    if (!nx) { this.set('idle'); if (auto) this.cb.onEnd(); return; }
    void this.playFrom(nx.first);
  }
  skip(d: number) { void this.playFrom(this.sIdx + d); }
  pause() { this.audio.pause(); if ('speechSynthesis' in window) speechSynthesis.pause(); if (this.state === 'playing') this.set('paused'); }
  resume() { if (this.state === 'paused') { void this.audio.play(); if ('speechSynthesis' in window) speechSynthesis.resume(); this.set('playing'); } else void this.playFrom(this.sIdx); }
  setSpeed(s: number) { this.audio.playbackRate = s; }
  setVolume(v: number) { this.audio.volume = v; }
  stop() { this.token++; this.audio.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); this.set('idle'); }
}

/** Joue un texte isolé (échantillon de voix, prononciation d'un mot). */
export async function playOnce(text: string, o: Pick<PlayerOpts, 'spec' | 'lang' | 'speed' | 'volume'>) {
  const a = new Audio(await fetchAudio(text, o.spec, o.lang));
  a.playbackRate = o.speed; a.volume = o.volume;
  await a.play();
}
