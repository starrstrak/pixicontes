// Petits sons doux générés (aucun fichier audio) : notes courtes en sinusoïde.
import { getPrefs } from './prefs';
let ctx: AudioContext | null = null;
function note(freq: number, t0: number, dur: number, vol = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + t0);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
  o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.05);
}
export function sfx(kind: 'tap' | 'ok' | 'magic' | 'oops' | 'page') {
  if (!getPrefs().sounds) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const s = { tap: [[660, 0, 0.08]], ok: [[523, 0, 0.1], [784, 0.09, 0.16]], magic: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.25]], oops: [[330, 0, 0.14], [262, 0.12, 0.2]], page: [[300, 0, 0.1], [450, 0.05, 0.12]] }[kind];
    for (const [f, t, d] of s) note(f, t, d);
  } catch { /* son indisponible */ }
}
