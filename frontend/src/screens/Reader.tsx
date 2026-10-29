// Lecteur / co-création : texte, illustration, voix, choix, micro, modifications, dictionnaire.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Chapter, Config, HeroDraft, Story } from '../lib/types';
import { api, KidError } from '../lib/api';
import { splitSentences, DICT_RE } from '../lib/sentences';
import { StoryPlayer, unlockAudio, type PlayerState } from '../lib/player';
import { getPrefs, setPrefs, usePrefs } from '../lib/prefs';
import { sfx } from '../lib/sound';
import { useDictation } from '../lib/useDictation';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { Modal, VoiceField, useUI } from '../components/ui';
import { HeroForm } from '../components/HeroForm';
import { DictionaryModal } from '../components/Dictionary';

const QUICK = ['Un nouveau copain arrive', 'Il se met à pleuvoir', 'Ils trouvent une porte secrète', 'Quelque chose de drôle arrive'];

export function Reader({ initial, cfg, onClose, onChanged }: { initial: Story; cfg: Config; onClose: () => void; onChanged: () => void }) {
  const { busy, toast } = useUI();
  const prefs = usePrefs();
  const [story, setStory] = useState<Story>(initial);
  const [text, setText] = useState('');
  const [sentenceIdx, setSentenceIdx] = useState(-1);
  const [frac, setFrac] = useState(0);
  const [pstate, setPstate] = useState<PlayerState>('idle');
  const [playing, setPlaying] = useState<string | null>(null); // id du chapitre lu
  const [imgBusy, setImgBusy] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | { t: 'dict'; term: string; ctx?: string } | { t: 'edit'; ch: Chapter } | { t: 'char'; edit?: string } | { t: 'chars' } | { t: 'del'; ch: Chapter }>(null);
  const [regenLeft, setRegenLeft] = useState<number | null>(cfg.regenLeft);
  const scroller = useRef<HTMLDivElement>(null);
  const requested = useRef(new Set<string>());
  const sref = useRef(story); sref.current = story;
  const playingRef = useRef<string | null>(null); playingRef.current = playing;

  const chapters = story.book.chapters;
  const last = chapters[chapters.length - 1];
  const lang = cfg.languages.find((l) => l.id === story.lang);
  const listens = prefs.mode !== 'read';
  const showText = prefs.mode !== 'listen';

  // ---- Lecteur audio ----
  const player = useMemo(() => new StoryPlayer(() => {
    const p = getPrefs();
    return { profile: p.voice || cfg.defaults.voice, dialogueProfile: cfg.perCharacterVoice ? 'joyeuse' : null, tone: p.tone || cfg.defaults.tone, lang: sref.current.lang, speed: p.speed || cfg.defaults.speed, volume: p.volume, browserTts: cfg.allowBrowserTts };
  }, {
    onState: setPstate, onSentence: setSentenceIdx, onProgress: (_i, f) => setFrac(f),
    onEnd: () => { setSentenceIdx(-1); setPlaying(null); },
    onError: (m) => toast(m),
  }), [cfg]);
  useEffect(() => () => player.stop(), [player]);
  useEffect(() => { player.setSpeed(prefs.speed); player.setVolume(prefs.volume); }, [prefs.speed, prefs.volume, player]);

  const readChapter = useCallback((ch: Chapter, from = 0) => {
    unlockAudio();
    setPlaying(ch.id);
    player.load(splitSentences(ch.text));
    void player.playFrom(from);
  }, [player]);

  // Lecture automatique du dernier chapitre quand un nouveau chapitre arrive
  const lastId = useRef(initial.book.chapters.at(-1)?.id);
  useEffect(() => {
    if (last && last.id !== lastId.current) {
      lastId.current = last.id;
      if (prefs.mode !== 'read' && prefs.autoRead) readChapter(last);
      setTimeout(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }), 150);
    }
  }, [last, prefs.mode, prefs.autoRead, readChapter]);
  useEffect(() => { if (prefs.mode === 'read') player.stop(); }, [prefs.mode, player]);
  // Première ouverture : lire le chapitre courant si le mode le demande
  useEffect(() => { if (prefs.mode !== 'read' && prefs.autoRead && last) readChapter(last); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ---- Illustrations : le texte s'affiche d'abord, l'image arrive ensuite ----
  const genImage = useCallback(async (ch: Chapter, regen = false) => {
    if (imgBusy.has(ch.id)) return;
    setImgBusy((s) => new Set(s).add(ch.id));
    try {
      const r = await api.post<{ image: string; regenLeft: number | null }>(`/api/stories/${sref.current.id}/chapters/${ch.id}/image`, { regen });
      setStory((s) => ({ ...s, cover: s.cover ?? r.image, book: { ...s.book, chapters: s.book.chapters.map((c) => (c.id === ch.id ? { ...c, image: r.image } : c)) } }));
      if (regen) { setRegenLeft(r.regenLeft); sfx('magic'); }
      onChanged();
    } catch (e) { if (regen) toast((e as KidError).kid); }
    finally { setImgBusy((s) => { const n = new Set(s); n.delete(ch.id); return n; }); }
  }, [imgBusy, toast, onChanged]);
  useEffect(() => {
    if (cfg.imageMode === 'off' || !cfg.hasKey) return;
    for (const [i, c] of chapters.entries()) {
      if (c.image || requested.current.has(c.id)) continue;
      if (cfg.imageMode === 'major' && !(i === 0 || ['twist', 'character'].includes(c.kind))) continue;
      requested.current.add(c.id);
      void genImage(c);
    }
  }, [chapters, cfg.imageMode, cfg.hasKey, genImage]);

  // ---- Actions ----
  async function act(path: string, body: unknown, label = 'Pixi écrit la suite…', emoji = '✍️'): Promise<boolean> {
    player.stop(); setPlaying(null);
    busy(label, emoji); sfx('page');
    try {
      const s = await api.post<Story>(`/api/stories/${story.id}/${path}`, body);
      setStory(s); setText(''); onChanged(); return true;
    } catch (e) { sfx('oops'); toast((e as KidError).kid); return false; }
    finally { busy(null); }
  }
  const send = (t: string) => {
    const m = DICT_RE.exec(t);
    if (m) { setText(''); setModal({ t: 'dict', term: m[1] }); return; }
    void act('continue', { type: 'choice', text: t });
  };
  const dict = useDictation(story.lang === 'fr' ? 'fr' : prefs.explainLang, cfg, (t) => setText(t), toast);
  async function swap(path: 'undo' | 'redo') {
    player.stop(); setPlaying(null);
    try { const s = await api.post<Story>(`/api/stories/${story.id}/${path}`); setStory(s); onChanged(); sfx('tap'); } catch (e) { toast((e as KidError).kid); }
  }

  // Appui long sur une phrase = dictionnaire de la phrase entière
  const press = useRef<number | undefined>(undefined);
  const startPress = (s: string) => { press.current = window.setTimeout(() => { player.pause(); setModal({ t: 'dict', term: s, ctx: s }); }, 650); };
  const endPress = () => window.clearTimeout(press.current);

  const nWords = (s: string) => s.split(/\s+/).filter(Boolean).length;
  function renderText(ch: Chapter) {
    const sents = splitSentences(ch.text);
    const active = playing === ch.id && pstate !== 'idle';
    return sents.map((s, i) => {
      const now = active && i === sentenceIdx;
      const words = s.split(/(\s+)/);
      const wi = now ? Math.min(nWords(s) - 1, Math.floor(frac * nWords(s))) : -1;
      let k = -1;
      return (
        <span key={i} className={`s ${now ? 'now' : ''}`} onPointerDown={() => startPress(s)} onPointerUp={endPress} onPointerLeave={endPress}>
          {words.map((w, j) => /^\s+$/.test(w) ? w : (k++, <span key={j} className={`w ${k === wi ? 'cur' : ''}`} onClick={() => setModal({ t: 'dict', term: w.replace(/^[«"“(]+|[.,!?;:…»"”)]+$/g, ''), ctx: s })}>{w}</span>))}{' '}
        </span>
      );
    });
  }

  const plabel = pstate === 'playing' ? 'Pause' : 'Écouter';
  return (
    <div className="reader" role="main">
      <div className="reader-top">
        <button className="btn soft round" onClick={() => { player.stop(); onClose(); }} aria-label="Retour"><Icon n="back" /></button>
        <h2>{story.title}</h2>
        <button className="btn soft round" disabled={!story.canUndo} onClick={() => void swap('undo')} aria-label="Annuler"><Icon n="undo" /></button>
        <button className="btn soft round" disabled={!story.canRedo} onClick={() => void swap('redo')} aria-label="Refaire"><Icon n="redo" /></button>
        <button className="btn soft round" onClick={() => setModal({ t: 'chars' })} aria-label="Personnages"><Icon n="users" /></button>
        <button className="btn soft round" onClick={() => setModal({ t: 'dict', term: '' })} aria-label="Dictionnaire">📚</button>
        <a className="btn soft round" href={`/api/stories/${story.id}/pdf`} aria-label="Exporter en PDF" download><Icon n="pdf" /></a>
      </div>

      <div className="reader-body" ref={scroller}>
        <div className="row" style={{ justifyContent: 'center', marginBottom: 8 }} role="group" aria-label="Lire ou écouter">
          {([['read', 'Lire', 'eye'], ['both', 'Lire et écouter', 'book'], ['listen', 'Écouter', 'ear']] as const).map(([m, l, ic]) => (
            <button key={m} className="chip" aria-pressed={prefs.mode === m} onClick={() => { unlockAudio(); setPrefs({ mode: m }); if (m !== 'read' && last && pstate === 'idle') readChapter(last); }}><Icon n={ic} size={22} />{l}</button>
          ))}
        </div>
        {chapters.map((ch, i) => (
          <article key={ch.id} className="page card">
            {ch.chosen && i > 0 && <div className="chosen">➜ {ch.chosen}</div>}
            {cfg.imageMode !== 'off' && (ch.image
              ? <div style={{ position: 'relative' }}><img className="illus" src={`/media/images/${ch.image}`} alt={ch.imagePrompt} loading="lazy" />
                  {i === chapters.length - 1 && <button className="btn soft" style={{ position: 'absolute', right: 10, bottom: 24 }} disabled={imgBusy.has(ch.id) || regenLeft === 0} onClick={() => void genImage(ch, true)}><Icon n="image" />Une autre image{regenLeft !== null ? ` (${regenLeft})` : ''}</button>}
                </div>
              : cfg.hasKey && (imgBusy.has(ch.id) || requested.current.has(ch.id)) && <div className="illus-ph" aria-label="Le dessin arrive"><span>🎨</span></div>)}
            {showText ? <div className="story-text selectable">{renderText(ch)}</div> : <div className="row" style={{ justifyContent: 'center' }}><Mascot mood={playing === ch.id ? 'joy' : 'idle'} size={110} /></div>}
            {showText && prefs.softTr && ch.translation && <div className="translation">🇫🇷 {ch.translation}</div>}
            {i === chapters.length - 1 && listens && (
              <div className="player" role="group" aria-label="Lecteur">
                <button className="btn soft round" onClick={() => player.skip(-1)} aria-label="Phrase précédente"><Icon n="prev" /></button>
                <button className="btn big orange" onClick={() => { unlockAudio(); if (playing !== ch.id || pstate === 'idle') readChapter(ch); else if (pstate === 'playing') player.pause(); else player.resume(); }}>
                  <Icon n={pstate === 'playing' && playing === ch.id ? 'pause' : 'play'} />{pstate === 'loading' && playing === ch.id ? '…' : plabel}
                </button>
                <button className="btn soft round" onClick={() => player.skip(1)} aria-label="Phrase suivante"><Icon n="next" /></button>
                <button className="chip" aria-pressed={prefs.speed > 1.1} onClick={() => setPrefs({ speed: prefs.speed > 1.1 ? 1 : 1.3 })} aria-label="Vitesse rapide"><Icon n="fast" size={22} />Vite</button>
              </div>
            )}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="chip" onClick={() => setModal({ t: 'edit', ch })}><Icon n="edit" size={20} />Changer un détail</button>
              {chapters.length > 1 && <button className="chip" onClick={() => setModal({ t: 'del', ch })} aria-label="Supprimer ce chapitre"><Icon n="trash" size={20} /></button>}
            </div>
          </article>
        ))}

        {last && (
          <section className="page" aria-label="Que se passe-t-il ensuite ?">
            <h2 style={{ textAlign: 'center' }}>Et maintenant ?</h2>
            <div className="choices">
              {last.choices.map((c, i) => (
                <button key={i} className="choice" onClick={() => { sfx('ok'); void act('continue', { type: 'choice', text: c.label }); }}>
                  <span className="ic">{c.icon}</span><span>{c.label}{c.labelFr && <small>{c.labelFr}</small>}</span>
                </button>
              ))}
              <button className="choice" onClick={() => { sfx('magic'); void act('continue', { type: 'twist' }, 'Pixi prépare une surprise…', '🎁'); }}><span className="ic">🎁</span><span>Surprise !<small>Un rebondissement</small></span></button>
              <button className="choice" onClick={() => setModal({ t: 'char' })}><span className="ic">🧙</span><span>Ajouter un personnage</span></button>
            </div>
          </section>
        )}
      </div>

      <div className="composer">
        <div className="suggest" aria-label="Idées rapides">{QUICK.map((q) => <button key={q} className="chip" onClick={() => setText(q)}>{q}</button>)}</div>
        {dict.listening && <div className="row" style={{ justifyContent: 'center' }}><div className="wave" aria-label="Pixi t’écoute">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ height: 6 + dict.level * 40 * (1 - Math.abs(i - 4) / 6) }} />)}</div><span>Je t’écoute… parle !</span></div>}
        <div className="row">
          <button className={`mic ${dict.listening ? 'rec' : ''}`} onClick={dict.toggle} disabled={dict.busy} aria-label={dict.listening ? 'Arrêter' : 'Parler à Pixi'}><Icon n="mic" /></button>
          <input type="text" className="selectable" value={text} placeholder={dict.busy ? 'Pixi écoute bien…' : 'Écris ou dis ton idée…'} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && text.trim() && send(text)} aria-label="Ton idée" />
          <button className="btn big round" style={{ width: 68 }} disabled={!text.trim()} onClick={() => send(text)} aria-label="Envoyer"><Icon n="send" /></button>
        </div>
      </div>

      {modal?.t === 'dict' && lang && <DictionaryModal term={modal.term} context={modal.ctx} lang={story.lang} cfg={cfg} onClose={() => setModal(null)} />}
      {modal?.t === 'edit' && <EditModal ch={modal.ch} lang={story.lang} cfg={cfg} onClose={() => setModal(null)} onSend={async (ins) => { const id = modal.ch.id; setModal(null); requested.current.delete(id); await act('continue', { type: 'edit', chapterId: id, instruction: ins }, 'Pixi réécrit ton chapitre…', '✏️'); }} />}
      {modal?.t === 'del' && (
        <Modal onClose={() => setModal(null)} label="Supprimer">
          <h2>Effacer ce chapitre ?</h2><p className="muted" style={{ margin: '8px 0 16px' }}>Tu pourras le retrouver avec le bouton « annuler ».</p>
          <div className="row"><button className="btn soft" onClick={() => setModal(null)}>Non, je le garde</button>
            <button className="btn danger" onClick={async () => { const id = modal.ch.id; setModal(null); try { setStory(await api.del<Story>(`/api/stories/${story.id}/chapters/${id}`)); onChanged(); } catch (e) { toast((e as KidError).kid); } }}><Icon n="trash" />Effacer</button></div>
        </Modal>
      )}
      {modal?.t === 'char' && !modal.edit && (
        <Modal onClose={() => setModal(null)} label="Nouveau personnage">
          <HeroForm cfg={cfg} lang={story.lang} title="Nouveau personnage" onCancel={() => setModal(null)} onDone={async (h: HeroDraft) => { setModal(null); await act('continue', { type: 'character', character: h }, 'Un nouveau personnage arrive…', '🧙'); }} />
        </Modal>
      )}
      {modal?.t === 'chars' && (
        <Modal onClose={() => setModal(null)} label="Personnages">
          <div className="topbar"><h2>Les personnages</h2><button className="btn soft round" onClick={() => setModal(null)} aria-label="Fermer"><Icon n="close" /></button></div>
          <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
            {story.book.characters.map((c) => (
              <div key={c.id} className="card row"><span style={{ fontSize: '2.2rem' }}>{c.isHero ? '🦸' : '🧑'}</span>
                <div className="spacer"><h3>{c.name}</h3><p className="muted">{[c.appearance, c.powers && `pouvoir : ${c.powers}`, c.flaws && `défaut : ${c.flaws}`].filter(Boolean).join(' · ')}</p></div>
                <button className="btn soft round" onClick={() => setModal({ t: 'char', edit: c.id })} aria-label={`Modifier ${c.name}`}><Icon n="edit" /></button></div>
            ))}
          </div>
          <button className="btn mint" style={{ marginTop: 14 }} onClick={() => setModal({ t: 'char' })}><Icon n="plus" />Ajouter</button>
        </Modal>
      )}
      {modal?.t === 'char' && modal.edit && (() => {
        const c = story.book.characters.find((x) => x.id === modal.edit)!;
        return (
          <Modal onClose={() => setModal(null)} label="Modifier">
            <HeroForm cfg={cfg} lang={story.lang} title={`Modifier ${c.name}`} initial={{ id: c.id, name: c.name, appearance: c.appearance, personality: c.personality, powers: c.powers, flaws: c.flaws }} onCancel={() => setModal(null)}
              onDone={async (h) => { setModal(null); try { setStory(await api.put<Story>(`/api/stories/${story.id}/characters/${c.id}`, h)); onChanged(); toast('C’est noté ! La suite en tiendra compte.'); } catch (e) { toast((e as KidError).kid); } }} />
          </Modal>
        );
      })()}
    </div>
  );
}

function EditModal({ ch, lang, cfg, onClose, onSend }: { ch: Chapter; lang: string; cfg: Config; onClose: () => void; onSend: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <Modal onClose={onClose} label="Changer un détail">
      <h2>Qu’est-ce que tu veux changer ?</h2>
      <p className="muted" style={{ margin: '6px 0 12px' }}>Ex : « le dragon est bleu », « il pleut au lieu du soleil »</p>
      <VoiceField multiline value={t} onChange={setT} placeholder="Dis ou écris ton changement" lang={lang} cfg={cfg} />
      <p className="muted selectable" style={{ margin: '10px 0', fontSize: '.85rem' }}>{ch.text.slice(0, 110)}…</p>
      <div className="row"><button className="btn soft" onClick={onClose}>Annuler</button><button className="btn mint" disabled={!t.trim()} onClick={() => onSend(t)}><Icon n="check" />Changer !</button></div>
    </Modal>
  );
}
