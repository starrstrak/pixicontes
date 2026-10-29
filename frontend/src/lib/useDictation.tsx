import { useRef, useState } from 'react';
import { Recorder, browserRecognize } from './recorder';
import { KidError } from './api';
import { sfx } from './sound';
import { unlockAudio } from './player';

/** Dictée vocale : toucher pour parler, retoucher pour arrêter (ou arrêt auto au silence). Renvoie le texte transcrit à corriger. */
export function useDictation(lang: string, cfg: { hasKey: boolean; sttBrowserFallback: boolean }, onText: (t: string) => void, onMsg: (m: string) => void) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const rec = useRef<Recorder | null>(null);

  async function stop() {
    const r = rec.current; if (!r) return;
    rec.current = null; setListening(false); setBusy(true);
    try {
      const res = await r.stop(lang);
      if (res.silent || !res.text) onMsg('Je n’ai rien entendu… On réessaie ? Parle un peu plus fort !');
      else { sfx('ok'); onText(res.text); }
    } catch (e) {
      const ke = e as KidError;
      if (cfg.sttBrowserFallback && (ke.code === 'network' || ke.code === 'no_key' || ke.code === 'quota')) {
        const p = browserRecognize(lang);
        if (p) { setListening(true); const t = await p; setListening(false); if (t) onText(t); else onMsg('Je n’ai rien entendu… On réessaie ?'); setBusy(false); return; }
      }
      onMsg(ke.kid ?? 'Oups, on réessaie ?');
    } finally { setBusy(false); }
  }
  async function start() {
    unlockAudio(); sfx('tap');
    if (!cfg.hasKey && cfg.sttBrowserFallback) {
      const p = browserRecognize(lang);
      if (p) { setListening(true); const t = await p; setListening(false); if (t) onText(t); else onMsg('Je n’ai rien entendu… On réessaie ?'); return; }
    }
    const r = new Recorder(); rec.current = r;
    try { await r.start(setLevel, () => void stop()); setListening(true); }
    catch (e) { rec.current = null; onMsg((e as KidError).kid); }
  }
  return { listening, busy, level, toggle: () => (listening ? void stop() : void start()) };
}
