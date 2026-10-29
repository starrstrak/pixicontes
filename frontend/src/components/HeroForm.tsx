// Création d'un personnage : étapes visuelles (nom → apparence → caractère → pouvoir → défaut), choix en images + option voix.
import { useState } from 'react';
import type { Config, HeroDraft } from '../lib/types';
import { Steps, VoiceField, Say } from './ui';
import { Icon } from './Icon';
import { sfx } from '../lib/sound';

type O = [string, string]; // [emoji, texte]
const HAIR: O[] = [['🟤', 'cheveux bruns'], ['🟡', 'cheveux blonds'], ['🟠', 'cheveux roux'], ['⚫', 'cheveux noirs'], ['🔵', 'cheveux bleus'], ['🌈', 'cheveux arc-en-ciel']];
const STYLE: O[] = [['〰️', 'bouclés'], ['📏', 'lisses'], ['🎀', 'attachés'], ['🦁', 'en pagaille']];
const CLOTH: O[] = [['💛', 'pull jaune'], ['💙', 'manteau bleu'], ['💚', 'salopette verte'], ['❤️', 'cape rouge'], ['💜', 'robe violette'], ['🧡', 't-shirt orange']];
const EXTRA: O[] = [['👓', 'des lunettes'], ['🎩', 'un chapeau'], ['🎒', 'un sac à dos'], ['⭐', 'une étoile sur la joue'], ['🧣', 'une écharpe']];
const TRAITS: O[] = [['😄', 'joyeux'], ['🦸', 'courageux'], ['🤔', 'curieux'], ['😇', 'gentil'], ['🤡', 'rigolo'], ['🤫', 'timide'], ['🧠', 'malin'], ['💪', 'têtu']];
const POWERS: O[] = [['🪽', 'voler'], ['👻', 'devenir invisible'], ['🔥', 'faire du feu'], ['🗣️', 'parler aux animaux'], ['⚡', 'courir très vite'], ['🧊', 'faire de la glace'], ['🪄', 'faire de la magie'], ['⏱️', 'arrêter le temps']];
const FLAWS: O[] = [['🍰', 'très gourmand'], ['😴', 'toujours endormi'], ['🙈', 'a peur du noir'], ['🌀', 'très distrait'], ['🤥', 'raconte des blagues pas vraies'], ['🥴', 'maladroit']];

function Pick({ opts, value, onPick, multi }: { opts: O[]; value: string[]; onPick: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="chips">
      {opts.map(([e, t]) => {
        const on = value.includes(t);
        return <button key={t} className="chip" aria-pressed={on} onClick={() => { sfx('tap'); onPick(multi ? (on ? value.filter((x) => x !== t) : [...value, t]) : on ? [] : [t]); }}><span style={{ fontSize: '1.5rem' }}>{e}</span>{t}</button>;
      })}
    </div>
  );
}

export function HeroForm({ cfg, lang, initial, onDone, onCancel, title = 'Ton héros' }: { cfg: Config; lang: string; initial?: HeroDraft; onDone: (h: HeroDraft) => void; onCancel?: () => void; title?: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? '');
  const [hair, setHair] = useState<string[]>([]); const [hstyle, setHstyle] = useState<string[]>([]);
  const [cloth, setCloth] = useState<string[]>([]); const [extra, setExtra] = useState<string[]>([]);
  const [freeLook, setFreeLook] = useState(initial?.appearance ?? '');
  const [traits, setTraits] = useState<string[]>([]); const [freeTrait, setFreeTrait] = useState(initial?.personality ?? '');
  const [powers, setPowers] = useState<string[]>([]); const [freePower, setFreePower] = useState(initial?.powers ?? '');
  const [flaws, setFlaws] = useState<string[]>([]); const [freeFlaw, setFreeFlaw] = useState(initial?.flaws ?? '');
  const N = 5;
  const look = [[...hair, ...hstyle].join(' '), ...cloth, extra.length ? 'avec ' + extra.join(' et ') : '', freeLook].filter(Boolean).join(', ');
  const join = (a: string[], f: string) => [...a, f].filter(Boolean).join(', ');
  const can = step === 0 ? name.trim().length > 0 : true;
  const finish = () => onDone({ id: initial?.id, name: name.trim(), appearance: look, personality: join(traits, freeTrait), powers: join(powers, freePower), flaws: join(flaws, freeFlaw) });

  const msgs = ['Comment s’appelle ton personnage ?', 'À quoi ressemble-t-il ? Choisis ou raconte !', 'Comment est son caractère ?', 'Quel est son super-pouvoir ?', 'Et son petit défaut rigolo ? Tout le monde en a !'];
  return (
    <div>
      <div className="topbar"><h2>{title}</h2>{onCancel && <button className="btn soft round" onClick={onCancel} aria-label="Fermer"><Icon n="close" /></button>}</div>
      <Steps n={step + 1} of={N} />
      <Say mood="think">{msgs[step]}</Say>
      <div style={{ height: 12 }} />
      {step === 0 && <VoiceField value={name} onChange={setName} placeholder="Son prénom (ex : Léo)" lang={lang} cfg={cfg} label="Prénom" />}
      {step === 1 && (<>
        <h3>Cheveux</h3><Pick opts={HAIR} value={hair} onPick={setHair} /><div style={{ height: 8 }} />
        <Pick opts={STYLE} value={hstyle} onPick={setHstyle} />
        <h3 style={{ marginTop: 12 }}>Habits</h3><Pick opts={CLOTH} value={cloth} onPick={setCloth} />
        <h3 style={{ marginTop: 12 }}>Un petit plus ?</h3><Pick opts={EXTRA} value={extra} onPick={setExtra} multi />
        <div className="field" style={{ marginTop: 12 }}><label>Ou décris-le avec tes mots</label><VoiceField value={freeLook} onChange={setFreeLook} placeholder="Ex : il a une grande cicatrice en forme d’éclair" lang={lang} cfg={cfg} /></div>
      </>)}
      {step === 2 && (<><Pick opts={TRAITS} value={traits} onPick={setTraits} multi /><div className="field" style={{ marginTop: 12 }}><label>Autre chose ?</label><VoiceField value={freeTrait} onChange={setFreeTrait} placeholder="Ex : il adore les chaussettes" lang={lang} cfg={cfg} /></div></>)}
      {step === 3 && (<><Pick opts={POWERS} value={powers} onPick={setPowers} /><div className="field" style={{ marginTop: 12 }}><label>Invente un pouvoir</label><VoiceField value={freePower} onChange={setFreePower} placeholder="Ex : transformer les nuages en barbe à papa" lang={lang} cfg={cfg} /></div></>)}
      {step === 4 && (<><Pick opts={FLAWS} value={flaws} onPick={setFlaws} /><div className="field" style={{ marginTop: 12 }}><label>Invente un défaut</label><VoiceField value={freeFlaw} onChange={setFreeFlaw} placeholder="Ex : il éternue quand il est content" lang={lang} cfg={cfg} /></div></>)}
      <div className="row" style={{ marginTop: 18, justifyContent: 'space-between' }}>
        <button className="btn soft" onClick={() => (step ? setStep(step - 1) : onCancel?.())} disabled={!step && !onCancel}><Icon n="back" />Retour</button>
        {step < N - 1 ? <button className="btn" disabled={!can} onClick={() => { sfx('ok'); setStep(step + 1); }}>{step >= 2 ? 'Suivant (ou passer)' : 'Suivant'}</button>
          : <button className="btn mint big" disabled={!can} onClick={() => { sfx('magic'); finish(); }}><Icon n="check" />C’est mon héros !</button>}
      </div>
    </div>
  );
}
