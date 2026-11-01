// Atelier de voix : base (13 voix) + tonalité, timbre, émotions, modulation, variation, rythme, diction, pauses, souffle, âge, accent.
// Utilisé par l'enfant (réglages) et par le parent (catalogue).
import { useState } from 'react';
import type { VoiceLabData, VoiceSpec } from '../lib/voice';
import { Icon } from './Icon';

const LV = {
  pitch: ['Très grave', 'Grave', 'Naturelle', 'Aiguë', 'Très aiguë'],
  expressiveness: ['Sobre', 'Légère', 'Naturelle', 'Conteuse', 'Théâtrale'],
  variation: ['Uniforme', 'Subtile', 'Naturelle', 'Vivante', 'Très variée'],
  pace: ['Très lent', 'Lent', 'Normal', 'Vif', 'Rapide'],
  diction: ['Détendue', 'Claire', 'Très articulée'],
  pauses: ['Courtes', 'Naturelles', 'Longues, dramatiques'],
};
function Scale({ label, hint, value, min, labels, onChange }: { label: string; hint?: string; value: number; min: number; labels: string[]; onChange: (v: number) => void }) {
  return (
    <div className="field" style={{ marginBottom: 10 }}>
      <label>{label} <span className="muted" style={{ fontWeight: 700 }}>· {labels[value - min]}</span></label>
      <input type="range" min={min} max={min + labels.length - 1} step={1} value={value} onChange={(e) => onChange(+e.target.value)} aria-label={label} style={{ accentColor: 'var(--primary)', minHeight: 40 }} />
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}
function Multi({ options, value, max, onChange }: { options: { id: string; label: string }[]; value: string[]; max: number; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.id);
        return <button key={o.id} className="chip" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.id) : value.length >= max ? [...value.slice(1), o.id] : [...value, o.id])}>{o.label}</button>;
      })}
    </div>
  );
}

export function VoiceLab({ spec, onChange, lab, lang, onSample, busy, freeText = true }: { spec: VoiceSpec; onChange: (s: VoiceSpec) => void; lab: VoiceLabData; lang: string; onSample: () => void; busy?: boolean; freeText?: boolean }) {
  const set = <K extends keyof VoiceSpec>(k: K, v: VoiceSpec[K]) => onChange({ ...spec, [k]: v });
  const [open, setOpen] = useState(true);
  const accents = lab.accents[lang] ?? lab.accents.fr;
  return (
    <div>
      <div className="field"><label>Voix de base <span className="muted" style={{ fontWeight: 700 }}>· {lab.bases.find((b) => b.id === spec.voice)?.desc}</span></label>
        <div className="chips">{lab.bases.map((b) => <button key={b.id} className="chip" aria-pressed={spec.voice === b.id} onClick={() => set('voice', b.id)}>{b.label}</button>)}</div></div>
      <button className="btn orange" style={{ marginBottom: 12 }} disabled={busy} onClick={onSample}><Icon n="play" />{busy ? 'Un instant…' : 'Écouter cet échantillon'}</button>
      <button className="chip" style={{ marginLeft: 8 }} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Masquer' : 'Afficher'} les réglages fins</button>
      {open && (<>
        <Scale label="Tonalité (hauteur)" value={spec.pitch} min={-2} labels={LV.pitch} onChange={(v) => set('pitch', v)} />
        <div className="field"><label>Timbre <small className="muted">(jusqu’à 4)</small></label><Multi options={lab.timbres} value={spec.timbre} max={4} onChange={(v) => set('timbre', v)} /></div>
        <div className="field"><label>Émotions <small className="muted">(jusqu’à 4)</small></label><Multi options={lab.emotions} value={spec.emotion} max={4} onChange={(v) => set('emotion', v)} /></div>
        <Scale label="Modulation (expressivité)" value={spec.expressiveness} min={0} labels={LV.expressiveness} onChange={(v) => set('expressiveness', v)} />
        <Scale label="Variation (intonation et rythme)" value={spec.variation} min={0} labels={LV.variation} onChange={(v) => set('variation', v)} />
        <Scale label="Rythme" hint="Pour changer la vitesse sans retoucher la voix, utilisez le curseur de vitesse." value={spec.pace} min={-2} labels={LV.pace} onChange={(v) => set('pace', v)} />
        <Scale label="Diction" value={spec.diction} min={0} labels={LV.diction} onChange={(v) => set('diction', v)} />
        <Scale label="Pauses" value={spec.pauses} min={0} labels={LV.pauses} onChange={(v) => set('pauses', v)} />
        <label className="switch"><span>Petites respirations audibles (plus humain)</span><input type="checkbox" checked={spec.breath} onChange={(e) => set('breath', e.target.checked)} /></label>
        <div className="field"><label>Âge perçu</label><div className="chips">{lab.ages.map((a) => <button key={a.id} className="chip" aria-pressed={spec.age === a.id} onClick={() => set('age', a.id)}>{a.label}</button>)}</div></div>
        <div className="field"><label>Accent</label><div className="chips">{accents.map((a) => <button key={a.id} className="chip" aria-pressed={spec.accent === a.id} onClick={() => set('accent', a.id)}>{a.label}</button>)}</div></div>
        {freeText && <div className="field"><label>Consigne libre <small className="muted">(en anglais ou en français, 200 car. max)</small></label>
          <input type="text" maxLength={200} value={spec.extra} onChange={(e) => set('extra', e.target.value)} placeholder="Ex : comme un vieux marin qui raconte une blague" /></div>}
      </>)}
    </div>
  );
}
