import { useEffect, useState } from 'react';
import { api, KidError } from '../lib/api';
import { Modal, VoiceField, useUI } from './ui';
import { Icon } from './Icon';
import { playOnce } from '../lib/player';
import { getPrefs } from '../lib/prefs';
import { effectiveSpec } from '../lib/voice';
import type { Config } from '../lib/types';

type Entry = { term: string; emoji: string; meaning: string; example: string; kind: string };
export function DictionaryModal({ term, context, lang, cfg, onClose }: { term: string; context?: string; lang: string; cfg: Config; onClose: () => void }) {
  const { toast } = useUI();
  const [q, setQ] = useState(term);
  const [e, setE] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const p = getPrefs();
  async function look(t: string) {
    if (!t.trim()) return;
    setLoading(true);
    try { setE(await api.post<Entry>('/api/dictionary', { term: t, lang, explainLang: p.explainLang, context })); }
    catch (err) { toast((err as KidError).kid); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (term) void look(term); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const say = (t: string, l: string) => playOnce(t, { spec: { ...effectiveSpec(cfg, p), pace: -1, diction: 2 }, lang: l, speed: Math.min(p.speed, 1), volume: p.volume }).catch((er) => toast((er as KidError).kid));
  return (
    <Modal onClose={onClose} label="Dictionnaire">
      <div className="topbar"><h2>Dictionnaire</h2><button className="btn soft round" onClick={onClose} aria-label="Fermer"><Icon n="close" /></button></div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <div style={{ flex: 1 }}><VoiceField value={q} onChange={setQ} placeholder="Un mot ou une phrase" lang={p.explainLang} cfg={cfg} /></div>
        <button className="btn round" onClick={() => void look(q)} aria-label="Chercher"><Icon n="search" /></button>
      </div>
      {loading && <p className="muted" style={{ marginTop: 14 }}>Pixi cherche dans son gros livre…</p>}
      {e && !loading && (
        <div className="card selectable" style={{ marginTop: 14 }}>
          <div style={{ fontSize: '3.4rem' }}>{e.emoji}</div>
          <h2>{e.term} {e.kind && <span className="pill">{e.kind}</span>}</h2>
          <p style={{ margin: '10px 0', fontSize: '1.15rem' }}>{e.meaning}</p>
          {e.example && <p className="muted">Exemple : {e.example}</p>}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn orange" onClick={() => void say(e.term, lang)}><Icon n="ear" />Écouter</button>
            <button className="btn soft" onClick={() => void say(e.meaning, p.explainLang)}><Icon n="ear" />Écouter l’explication</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
