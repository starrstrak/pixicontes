import { useState } from 'react';
import type { Config, HeroDraft, Story } from '../lib/types';
import { api, KidError } from '../lib/api';
import { Steps, Say, VoiceField, useUI } from '../components/ui';
import { HeroForm } from '../components/HeroForm';
import { Icon } from '../components/Icon';
import { usePrefs, setPrefs } from '../lib/prefs';
import { sfx } from '../lib/sound';

export function NewStory({ cfg, onCreated, libraryHeroes }: { cfg: Config; onCreated: (s: Story) => void; libraryHeroes: (HeroDraft & { id: string })[] }) {
  const { busy, toast } = useUI();
  const prefs = usePrefs();
  const [step, setStep] = useState(0);
  const [genre, setGenre] = useState<string>('');
  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState('aquarelle');
  const [hero, setHero] = useState<HeroDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const g = cfg.genres.find((x) => x.id === genre);
  const lang = cfg.languages.find((l) => l.id === prefs.lang) ?? cfg.languages[0];

  async function launch(h: HeroDraft) {
    busy('Pixi écrit le début de ton histoire…', '📖');
    try {
      if (!h.id) await api.post('/api/characters', h).catch(() => {});
      sfx('page');
      const s = await api.post<Story>('/api/stories', { genreId: genre, freeIdea: idea || undefined, lang: lang.id, style, heroes: [h] });
      sfx('magic');
      onCreated(s);
    } catch (e) { sfx('oops'); toast((e as KidError).kid); }
    finally { busy(null); }
  }

  if (creating) return <HeroForm cfg={cfg} lang={lang.id} onCancel={() => setCreating(false)} onDone={(h) => { setHero(h); setCreating(false); void launch(h); }} />;

  return (
    <div>
      <div className="topbar"><h1>Nouvelle histoire</h1>
        <div className="row" aria-label="Langue de l’histoire">{cfg.languages.map((l) => <button key={l.id} className="chip" aria-pressed={l.id === lang.id} aria-label={l.name} onClick={() => setPrefs({ lang: l.id })}><span style={{ fontSize: '1.6rem' }}>{l.flag}</span></button>)}</div>
      </div>
      <Steps n={step + 1} of={3} />
      {step === 0 && (<>
        <Say mood="joy">Quelle histoire as-tu envie de vivre ?</Say>
        <div style={{ height: 14 }} />
        <div className="grid">
          {cfg.genres.map((x) => (
            <button key={x.id} className="card-btn genre" style={{ ['--gc' as string]: x.color }} aria-pressed={genre === x.id} onClick={() => { sfx('tap'); setGenre(x.id); }}>
              <span className="big-emoji">{x.icon}</span>{x.name}<small>{x.description}</small>
            </button>
          ))}
        </div>
        {g?.free && <div className="field" style={{ marginTop: 14 }}><label>Raconte-moi ton idée !</label><VoiceField multiline value={idea} onChange={setIdea} placeholder="Ex : une école où les professeurs sont des fantômes gentils" lang={lang.id} cfg={cfg} /></div>}
        <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}><button className="btn big" disabled={!genre || (g?.free && !idea.trim())} onClick={() => { sfx('ok'); setStep(1); }}>Suivant</button></div>
      </>)}
      {step === 1 && (<>
        <Say mood="think">Comment veux-tu que ce soit dessiné ?</Say>
        <div style={{ height: 14 }} />
        <div className="grid">{cfg.styles.map((s) => <button key={s.id} className="card-btn" aria-pressed={style === s.id} onClick={() => { sfx('tap'); setStyle(s.id); }}><span className="big-emoji">{s.emoji}</span>{s.label}</button>)}</div>
        <div className="row" style={{ marginTop: 18, justifyContent: 'space-between' }}>
          <button className="btn soft" onClick={() => setStep(0)}><Icon n="back" />Retour</button><button className="btn big" onClick={() => { sfx('ok'); setStep(2); }}>Suivant</button>
        </div>
      </>)}
      {step === 2 && (<>
        <Say mood="joy">Qui est le héros de ton histoire ?</Say>
        <div style={{ height: 14 }} />
        <div className="grid">
          <button className="card-btn" onClick={() => { sfx('ok'); setCreating(true); }} style={{ background: 'var(--primary)', color: '#fff' }}><span className="big-emoji">✨</span>Créer un nouveau héros</button>
          {libraryHeroes.map((h) => <button key={h.id} className="card-btn" aria-pressed={hero?.id === h.id} onClick={() => { sfx('magic'); setHero(h); void launch(h); }}><span className="big-emoji">🧒</span>{h.name}<small>{h.powers}</small></button>)}
        </div>
        <div className="row" style={{ marginTop: 18 }}><button className="btn soft" onClick={() => setStep(1)}><Icon n="back" />Retour</button></div>
      </>)}
    </div>
  );
}
