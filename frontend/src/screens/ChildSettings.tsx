import { useState } from 'react';
import type { Config } from '../lib/types';
import { usePrefs, setPrefs } from '../lib/prefs';
import { playOnce, unlockAudio } from '../lib/player';
import { allProfiles, currentProfile, effectiveSpec, TONE_EMOTIONS, type VoiceSpec } from '../lib/voice';
import { useUI } from '../components/ui';
import { Icon } from '../components/Icon';
import { VoiceLab } from '../components/VoiceLab';
import { KidError } from '../lib/api';

const SAMPLE: Record<string, string> = {
  fr: 'Il était une fois un petit dragon qui voulait voler jusqu’aux étoiles. « Bonjour ! » dit-il, en souriant.',
  de: 'Es war einmal ein kleiner Drache, der zu den Sternen fliegen wollte. „Hallo!“, sagte er lächelnd.',
  en: 'Once upon a time, a little dragon wanted to fly to the stars. “Hello!” he said, smiling.',
};

export function ChildSettings({ cfg }: { cfg: Config }) {
  const p = usePrefs();
  const { toast } = useUI();
  const [busy, setBusy] = useState('');
  const [lab, setLab] = useState(false);
  const [name, setName] = useState('');
  const profiles = allProfiles(cfg, p);
  const cur = currentProfile(cfg, p);
  const spec = effectiveSpec(cfg, p);
  const gran = p.granularity || cfg.granularity;

  async function sample(s: VoiceSpec, key: string) {
    unlockAudio(); setBusy(key);
    try { await playOnce(SAMPLE[p.lang] ?? SAMPLE.fr, { spec: s, lang: p.lang, speed: p.speed, volume: p.volume }); }
    catch (e) { toast((e as KidError).kid); }
    finally { setBusy(''); }
  }
  const pickProfile = (id: string) => setPrefs({ voice: id, voiceTweak: null });
  const tone = Object.entries(TONE_EMOTIONS).find(([, e]) => e.join() === spec.emotion.join())?.[0];

  return (
    <div>
      <div className="topbar"><h1>Mes réglages</h1></div>
      <div className="card"><h2>La voix de Pixi</h2>
        <p className="muted" style={{ margin: '4px 0 10px' }}>{profiles.length} voix à essayer. Touche une voix pour la choisir, ▶ pour l’écouter.</p>
        <div className="grid" style={{ margin: '12px 0', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))' }}>
          {profiles.map((v) => (
            <div key={v.id} className="card-btn" style={{ minHeight: 120, padding: 10, alignItems: 'stretch' }} aria-pressed={cur.id === v.id}>
              <button onClick={() => pickProfile(v.id)} aria-pressed={cur.id === v.id} className="chip" style={{ justifyContent: 'flex-start' }}><span className="e">{v.emoji}</span>{v.label}</button>
              <small>{v.desc}</small>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button className="btn soft" style={{ minHeight: 44, padding: '0 14px' }} disabled={!!busy} onClick={() => void sample(v.spec, v.id)} aria-label={`Écouter ${v.label}`}><Icon n="play" />{busy === v.id ? '…' : 'Écouter'}</button>
                {v.id.startsWith('my_') && <button className="chip" aria-label={`Supprimer ${v.label}`} onClick={() => setPrefs({ myVoices: p.myVoices.filter((x) => x.id !== v.id), voice: cur.id === v.id ? '' : p.voice })}><Icon n="trash" size={18} /></button>}
              </div>
            </div>
          ))}
        </div>
        <h3>Comment il raconte</h3>
        <div className="chips" style={{ margin: '8px 0 14px' }}>
          {cfg.tones.map((t) => <button key={t.id} className="chip" aria-pressed={tone === t.id} onClick={() => setPrefs({ voiceTweak: { ...(p.voiceTweak ?? {}), emotion: TONE_EMOTIONS[t.id] } })}>{t.label}</button>)}
        </div>
        <div className="slider"><span>Lent</span><input type="range" min="0.7" max="1.3" step="0.05" value={p.speed} onChange={(e) => setPrefs({ speed: +e.target.value })} aria-label="Vitesse" /><span>Vite · {p.speed.toFixed(2)}×</span></div>
        <div className="slider"><span>Bas</span><input type="range" min="0.2" max="1" step="0.05" value={p.volume} onChange={(e) => setPrefs({ volume: +e.target.value })} aria-label="Volume" /><span>Fort</span></div>
        <h3 style={{ marginTop: 14 }}>Fluidité de la lecture</h3>
        <p className="muted" style={{ margin: '4px 0 8px', fontSize: '.85rem' }}>Plus le morceau lu d’un coup est long, plus la voix est naturelle (mais le surlignage est un peu moins précis).</p>
        <div className="chips">{([['phrase', 'Phrase par phrase'], ['groupe', 'Par petits groupes'], ['chapitre', 'Tout le chapitre']] as const).map(([g, l]) => <button key={g} className="chip" aria-pressed={gran === g} onClick={() => setPrefs({ granularity: g })}>{l}</button>)}</div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => setLab(!lab)} aria-expanded={lab}><Icon n="gear" />{lab ? 'Fermer l’atelier' : 'Atelier de voix'}</button>
          {p.voiceTweak && <button className="chip" onClick={() => setPrefs({ voiceTweak: null })}>Remettre la voix d’origine</button>}
        </div>
        {lab && (
          <div className="card" style={{ marginTop: 14, background: 'var(--bg)', boxShadow: 'none', border: '1px solid var(--line)' }}>
            <h3 style={{ marginBottom: 10 }}>Atelier : {cur.label}</h3>
            <VoiceLab spec={spec} lab={cfg.voiceLab} lang={p.lang} busy={busy === 'lab'} freeText={false}
              onChange={(s) => setPrefs({ voiceTweak: s })} onSample={() => void sample(spec, 'lab')} />
            <div className="field" style={{ marginTop: 14 }}><label>Garder cette voix sous le nom…</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input type="text" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Ma voix de dragon" aria-label="Nom de ma voix" />
                <button className="btn mint" disabled={!name.trim()} onClick={() => { const id = `my_${Date.now().toString(36)}`; setPrefs({ myVoices: [...p.myVoices, { id, label: name.trim(), emoji: '⭐', desc: 'Ma voix', spec }], voice: id, voiceTweak: null }); setName(''); toast('Voix enregistrée !'); }}>Garder</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="card" style={{ marginTop: 14 }}><h2>Lire ou écouter</h2>
        <div className="chips" style={{ marginTop: 8 }}>{([['read', 'Lire'], ['both', 'Lire et écouter'], ['listen', 'Écouter']] as const).map(([m, l]) => <button key={m} className="chip" aria-pressed={p.mode === m} onClick={() => setPrefs({ mode: m })}>{l}</button>)}</div>
        <label className="switch"><span>Lire tout seul chaque nouveau chapitre</span><input type="checkbox" checked={p.autoRead} onChange={(e) => setPrefs({ autoRead: e.target.checked })} /></label>
        {p.lang !== 'fr' && <label className="switch"><span>Aide en français sous le texte</span><input type="checkbox" checked={p.softTr} onChange={(e) => setPrefs({ softTr: e.target.checked })} /></label>}
      </div>
      <div className="card" style={{ marginTop: 14 }}><h2>Mon écran</h2>
        <h3 style={{ marginTop: 8 }}>Taille des lettres</h3>
        <div className="slider"><span style={{ fontSize: '.8rem' }}>A</span><input type="range" min="0.9" max="1.5" step="0.05" value={p.fontScale} onChange={(e) => setPrefs({ fontScale: +e.target.value })} aria-label="Taille du texte" /><span style={{ fontSize: '1.5rem' }}>A</span></div>
        <h3>Les lettres</h3>
        <div className="chips" style={{ margin: '8px 0' }}>{([['normal', 'Normales'], ['clear', 'Très claires'], ['dys', 'Dyslexie']] as const).map(([f, l]) => <button key={f} className="chip" aria-pressed={p.font === f} onClick={() => setPrefs({ font: f })}>{l}</button>)}</div>
        <h3>Jour ou nuit</h3>
        <div className="chips" style={{ margin: '8px 0' }}>{([['auto', 'Auto'], ['day', 'Jour'], ['night', 'Nuit']] as const).map(([f, l]) => <button key={f} className="chip" aria-pressed={p.theme === f} onClick={() => setPrefs({ theme: f })}>{l}</button>)}</div>
        <label className="switch"><span>Couleurs bien contrastées</span><input type="checkbox" checked={p.contrast} onChange={(e) => setPrefs({ contrast: e.target.checked })} /></label>
        <label className="switch"><span>Petits sons</span><input type="checkbox" checked={p.sounds} onChange={(e) => setPrefs({ sounds: e.target.checked })} /></label>
      </div>
      <div className="card" style={{ marginTop: 14 }}><h2>Langues</h2>
        <h3 style={{ marginTop: 8 }}>Expliquer les mots en</h3>
        <div className="chips" style={{ margin: '8px 0' }}>{cfg.languages.map((l) => <button key={l.id} className="chip" aria-pressed={p.explainLang === l.id} onClick={() => setPrefs({ explainLang: l.id })}><span className="e">{l.flag}</span>{l.name}</button>)}</div>
      </div>
    </div>
  );
}
