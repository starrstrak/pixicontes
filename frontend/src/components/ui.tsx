import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Mascot, type Mood } from './Mascot';
import { Icon } from './Icon';
import { useDictation } from '../lib/useDictation';
import type { Config } from '../lib/types';

type UI = { toast: (m: string) => void; busy: (label: string | null, emoji?: string) => void };
const Ctx = createContext<UI>({ toast: () => {}, busy: () => {} });
export const useUI = () => useContext(Ctx);

const WAIT = ['Pixi cherche ses lunettes magiques…', 'Pixi mélange des étoiles et de la poussière de rêve…', 'Pixi réveille les personnages…', 'Pixi trempe sa plume dans l’arc-en-ciel…', 'Pixi écrase un moustique de la lune…'];
export function UIProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ label: string; emoji: string } | null>(null);
  const [tick, setTick] = useState(0);
  const toast = useCallback((m: string) => { setMsg(m); window.setTimeout(() => setMsg((c) => (c === m ? null : c)), 4500); }, []);
  const busy = useCallback((label: string | null, emoji = '🪄') => setLoading(label ? { label, emoji } : null), []);
  useEffect(() => { if (!loading) return; const t = setInterval(() => setTick((x) => x + 1), 2600); return () => clearInterval(t); }, [loading]);
  return (
    <Ctx.Provider value={{ toast, busy }}>
      {children}
      {loading && (
        <div className="loader" role="status" aria-live="polite">
          <Mascot mood="think" size={130} />
          <div className="emoji">{loading.emoji}</div>
          <h2>{loading.label}</h2>
          <p className="muted">{WAIT[tick % WAIT.length]}</p>
        </div>
      )}
      {msg && <div className="toast" role="alert">{msg}</div>}
    </Ctx.Provider>
  );
}

export function Modal({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function Steps({ n, of }: { n: number; of: number }) {
  return <div className="steps" aria-label={`Étape ${n} sur ${of}`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</div>;
}

export function Say({ mood = 'idle', children }: { mood?: Mood; children: ReactNode }) {
  return <div className="mascot-wrap"><Mascot mood={mood} size={84} /><div className="speech">{children}</div></div>;
}

/** Champ texte avec bouton micro (« option voix »). */
export function VoiceField({ value, onChange, placeholder, lang, cfg, multiline, label }: { value: string; onChange: (v: string) => void; placeholder?: string; lang: string; cfg: Config; multiline?: boolean; label?: string }) {
  const { toast } = useUI();
  const d = useDictation(lang, cfg, (t) => onChange(value ? `${value} ${t}` : t), toast);
  const props = { value, placeholder, onChange: (e: { target: { value: string } }) => onChange(e.target.value), 'aria-label': label ?? placeholder, className: 'selectable' };
  return (
    <div className="row" style={{ flexWrap: 'nowrap' }}>
      {multiline ? <textarea {...props} /> : <input type="text" {...props} />}
      <button className={`btn round ${d.listening ? 'danger' : 'orange'}`} onClick={d.toggle} disabled={d.busy} aria-label={d.listening ? 'Arrêter' : 'Parler'}><Icon n="mic" /></button>
    </div>
  );
}
