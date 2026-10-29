import { useState } from 'react';
import type { Config } from '../lib/types';
import { usePrefs, setPrefs } from '../lib/prefs';
import { playOnce, unlockAudio } from '../lib/player';
import { useUI } from '../components/ui';
import { Icon } from '../components/Icon';
import { KidError } from '../lib/api';

const SAMPLE: Record<string, string> = { fr: 'Il était une fois un petit dragon qui voulait voler jusqu’aux étoiles.', de: 'Es war einmal ein kleiner Drache, der zu den Sternen fliegen wollte.', en: 'Once upon a time, a little dragon wanted to fly to the stars.' };

export function ChildSettings({ cfg }: { cfg: Config }) {
  const p = usePrefs();
  const { toast } = useUI();
  const [busy, setBusy] = useState('');
  const voice = p.voice || cfg.defaults.voice, tone = p.tone || cfg.defaults.tone;
  async function sample(v: string) {
    unlockAudio(); setBusy(v);
    try { await playOnce(SAMPLE[p.lang] ?? SAMPLE.fr, { profile: v, dialogueProfile: null, tone, lang: p.lang, speed: p.speed, volume: p.volume, browserTts: false }); }
    catch (e) { toast((e as KidError).kid); }
    finally { setBusy(''); }
  }
  return (
    <div>
      <div className="topbar"><h1>Mes réglages</h1></div>
      <div className="card"><h2>🔊 La voix de Pixi</h2>
        <div className="grid" style={{ margin: '12px 0' }}>
          {cfg.voices.map((v) => (
            <div key={v.id} className="card-btn" style={{ minHeight: 120 }}>
              <button onClick={() => setPrefs({ voice: v.id })} aria-pressed={voice === v.id} className="chip"><span style={{ fontSize: '1.6rem' }}>{v.emoji}</span>{v.label}</button>
              <button className="btn soft" disabled={!!busy} onClick={() => void sample(v.id)}><Icon n="play" />{busy === v.id ? '…' : 'Écouter'}</button>
            </div>
          ))}
        </div>
        <h3>Comment il raconte</h3>
        <div className="chips" style={{ margin: '8px 0 14px' }}>{cfg.tones.map((t) => <button key={t.id} className="chip" aria-pressed={tone === t.id} onClick={() => setPrefs({ tone: t.id })}>{t.emoji} {t.label}</button>)}</div>
        <div className="slider"><span>🐢</span><input type="range" min="0.7" max="1.3" step="0.05" value={p.speed} onChange={(e) => setPrefs({ speed: +e.target.value })} aria-label="Vitesse" /><span>🐇 {p.speed.toFixed(2)}x</span></div>
        <div className="slider"><span>🔈</span><input type="range" min="0.2" max="1" step="0.05" value={p.volume} onChange={(e) => setPrefs({ volume: +e.target.value })} aria-label="Volume" /><span>🔊</span></div>
      </div>
      <div className="card" style={{ marginTop: 14 }}><h2>👀 Lire ou écouter</h2>
        <div className="chips" style={{ marginTop: 8 }}>{([['read', '👀 Lire'], ['both', '📖 Lire et écouter'], ['listen', '👂 Écouter']] as const).map(([m, l]) => <button key={m} className="chip" aria-pressed={p.mode === m} onClick={() => setPrefs({ mode: m })}>{l}</button>)}</div>
        <label className="switch"><span>Lire tout seul chaque nouveau chapitre</span><input type="checkbox" checked={p.autoRead} onChange={(e) => setPrefs({ autoRead: e.target.checked })} /></label>
        {p.lang !== 'fr' && <label className="switch"><span>Aide en français sous le texte</span><input type="checkbox" checked={p.softTr} onChange={(e) => setPrefs({ softTr: e.target.checked })} /></label>}
      </div>
      <div className="card" style={{ marginTop: 14 }}><h2>🎨 Mon écran</h2>
        <h3 style={{ marginTop: 8 }}>Taille des lettres</h3>
        <div className="slider"><span style={{ fontSize: '.8rem' }}>A</span><input type="range" min="0.9" max="1.5" step="0.05" value={p.fontScale} onChange={(e) => setPrefs({ fontScale: +e.target.value })} aria-label="Taille du texte" /><span style={{ fontSize: '1.5rem' }}>A</span></div>
        <h3>Les lettres</h3>
        <div className="chips" style={{ margin: '8px 0' }}>{([['normal', 'Normales'], ['clear', 'Très claires'], ['dys', 'Dyslexie']] as const).map(([f, l]) => <button key={f} className="chip" aria-pressed={p.font === f} onClick={() => setPrefs({ font: f })}>{l}</button>)}</div>
        <h3>Jour ou nuit</h3>
        <div className="chips" style={{ margin: '8px 0' }}>{([['auto', '🌗 Auto'], ['day', '☀️ Jour'], ['night', '🌙 Nuit']] as const).map(([f, l]) => <button key={f} className="chip" aria-pressed={p.theme === f} onClick={() => setPrefs({ theme: f })}>{l}</button>)}</div>
        <label className="switch"><span>Couleurs bien contrastées</span><input type="checkbox" checked={p.contrast} onChange={(e) => setPrefs({ contrast: e.target.checked })} /></label>
        <label className="switch"><span>Petits sons</span><input type="checkbox" checked={p.sounds} onChange={(e) => setPrefs({ sounds: e.target.checked })} /></label>
      </div>
      <div className="card" style={{ marginTop: 14 }}><h2>🌍 Langues</h2>
        <h3 style={{ marginTop: 8 }}>Expliquer les mots en</h3>
        <div className="chips" style={{ margin: '8px 0' }}>{cfg.languages.map((l) => <button key={l.id} className="chip" aria-pressed={p.explainLang === l.id} onClick={() => setPrefs({ explainLang: l.id })}>{l.flag} {l.name}</button>)}</div>
      </div>
    </div>
  );
}
