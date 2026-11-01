// Espace parent : protégé par PIN, tous les réglages, coûts, gestion.
import { useCallback, useEffect, useState } from 'react';
import { adminToken, api, KidError } from '../lib/api';
import { Modal } from '../components/ui';
import { Icon } from '../components/Icon';
import { playOnce, unlockAudio } from '../lib/player';
import type { Config } from '../lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type S = any;

export function PinGate({ onOk, onClose }: { onOk: () => void; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get<{ hasPin: boolean }>('/api/admin/status').then((r) => setHasPin(r.hasPin)).catch(() => setMsg('Serveur injoignable.')); }, []);
  async function submit(p: string) {
    try {
      const r = await api.post<{ token: string }>('/api/admin/login', { pin: p });
      adminToken.set(r.token); onOk();
    } catch (e) { setPin(''); setMsg((e as KidError).admin ?? 'Code incorrect.'); }
  }
  const press = (d: string) => { const n = (pin + d).slice(0, 8); setPin(n); setMsg(''); };
  return (
    <Modal onClose={onClose} label="Espace parent">
      <div className="topbar"><h2>Espace parent</h2><button className="btn soft round" onClick={onClose} aria-label="Fermer"><Icon n="close" /></button></div>
      {hasPin === false && <p className="muted" style={{ marginBottom: 8 }}>Première utilisation : choisissez un code (4 à 8 chiffres). Gardez-le pour vous !</p>}
      <div style={{ fontSize: '2rem', textAlign: 'center', letterSpacing: 8, minHeight: 50 }} aria-label="Code saisi">{'●'.repeat(pin.length) || '····'}</div>
      {msg && <p style={{ color: 'var(--danger)', textAlign: 'center', fontWeight: 800 }}>{msg}</p>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', margin: '12px 0' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✔'].map((k) => (
          <button key={k} className={`btn ${k === '✔' ? 'mint' : 'soft'} big`} disabled={k === '✔' && pin.length < 4} onClick={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : k === '✔' ? void submit(pin) : press(k))}>{k}</button>
        ))}
      </div>
    </Modal>
  );
}

const MODEL_HINT: Record<string, string[]> = {
  text: ['gpt-5-nano', 'gpt-4.1-nano', 'gpt-4o-mini', 'gpt-5-mini'],
  tts: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
  stt: ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1'],
  image: ['gpt-image-1-mini', 'gpt-image-1'],
  moderation: ['omni-moderation-latest'],
};
const MODEL_LABEL: Record<string, string> = { text: 'Texte (histoires, dictionnaire)', tts: 'Voix (synthèse vocale)', stt: 'Transcription (micro)', image: 'Illustrations', moderation: 'Modération (gratuite)' };

export function Admin({ cfg, onClose, onConfig }: { cfg: Config; onClose: () => void; onConfig: () => void }) {
  const [tab, setTab] = useState('api');
  const [data, setData] = useState<S>(null);
  const [st, setSt] = useState<S>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [keyIn, setKeyIn] = useState('');

  const load = useCallback(async () => {
    try { const d = await api.get<S>('/api/admin/settings'); setData(d); setSt(d.settings); setDirty(false); }
    catch { adminToken.set(''); onClose(); }
  }, [onClose]);
  useEffect(() => { void load(); }, [load]);
  if (!st) return null;

  const set = (path: string, v: any) => {
    const n = structuredClone(st); const k = path.split('.'); let o = n;
    k.slice(0, -1).forEach((p) => (o = o[p])); o[k.at(-1)!] = v; setSt(n); setDirty(true);
  };
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  const save = async () => { try { await api.put('/api/admin/settings', st); setDirty(false); flash('✅ Enregistré'); onConfig(); } catch (e) { flash((e as KidError).admin ?? 'Erreur'); } };
  const num = (path: string, label: string, step = 1, hint?: string) => (
    <div className="field"><label>{label}</label><input type="number" step={step} value={path.split('.').reduce((o: any, k) => o[k], st)} onChange={(e) => set(path, +e.target.value)} />{hint && <small className="muted">{hint}</small>}</div>
  );
  const bool = (path: string, label: string) => <label className="switch"><span>{label}</span><input type="checkbox" checked={path.split('.').reduce((o: any, k) => o[k], st)} onChange={(e) => set(path, e.target.checked)} /></label>;
  const tabs = [['api', 'Clé & modèles'], ['voice', 'Voix'], ['story', 'Histoires & images'], ['lang', 'Langues'], ['limits', 'Limites'], ['costs', 'Coûts'], ['genres', 'Genres'], ['manage', 'Gestion'], ['sec', 'Sécurité']];

  return (
    <div className="reader admin" style={{ animation: 'none' }}>
      <div className="reader-top">
        <button className="btn soft round" onClick={() => { void api.post('/api/admin/logout').catch(() => {}); adminToken.set(''); onClose(); }} aria-label="Quitter"><Icon n="lock" /></button>
        <h2>Espace parent</h2>
        {dirty && <button className="btn mint" onClick={() => void save()}><Icon n="check" />Enregistrer</button>}
        {msg && <span className="pill">{msg}</span>}
      </div>
      <div className="reader-body selectable" style={{ paddingBottom: 40 }}>
        <div className="page">
          <div className="tabs">{tabs.map(([id, l]) => <button key={id} className="chip" aria-pressed={tab === id} onClick={() => setTab(id)}>{l}</button>)}</div>

          {tab === 'api' && (<>
            <div className="card"><h3>Clé API OpenAI</h3>
              <p className="muted">Stockée chiffrée sur ce serveur, jamais envoyée au navigateur ni au dépôt. {data.keySet ? <b>Clé enregistrée ({data.keyHint}){data.keyFromEnv ? ' via le fichier .env' : ''}.</b> : <b style={{ color: 'var(--danger)' }}>Aucune clé : l’IA est désactivée.</b>}</p>
              <div className="field"><input type="password" autoComplete="off" placeholder="sk-…" value={keyIn} onChange={(e) => setKeyIn(e.target.value)} aria-label="Clé API" /></div>
              <div className="row">
                <button className="btn" disabled={!keyIn} onClick={async () => { try { await api.put('/api/admin/key', { key: keyIn }); setKeyIn(''); flash('✅ Clé enregistrée'); await load(); onConfig(); } catch { flash('Clé invalide (elle commence par sk-)'); } }}>Enregistrer la clé</button>
                <button className="btn soft" onClick={async () => { const r = await api.post<{ ok: boolean; message: string }>('/api/admin/key/test'); flash((r.ok ? '✅ ' : '❌ ') + r.message); }}>Tester la clé</button>
                {data.keySet && !data.keyFromEnv && <button className="btn danger" onClick={async () => { await api.del('/api/admin/key'); await load(); onConfig(); }}>Supprimer</button>}
              </div>
            </div>
            <h2>Modèles</h2>
            <p className="muted">Modifiez librement : saisissez n’importe quel identifiant de modèle. Les tarifs sont dans l’onglet Coûts.</p>
            {Object.keys(MODEL_LABEL).map((k) => (
              <div className="field" key={k}><label>{MODEL_LABEL[k]}</label>
                <input type="text" list={`m-${k}`} value={st.models[k]} onChange={(e) => set(`models.${k}`, e.target.value)} /><datalist id={`m-${k}`}>{MODEL_HINT[k].map((m) => <option key={m} value={m} />)}</datalist></div>
            ))}
            {bool('stt.browserFallback', 'Micro : repli sur la reconnaissance vocale du navigateur')}
          </>)}

          {tab === 'voice' && (<>
            <div className="field"><label>Voix par défaut</label><select value={st.voice.defaultProfile} onChange={(e) => set('voice.defaultProfile', e.target.value)}>{data.voiceProfiles.map((v: any) => <option key={v.id} value={v.id}>{v.emoji} {v.label} ({v.voice})</option>)}</select></div>
            <div className="field"><label>Style par défaut</label><select value={st.voice.defaultTone} onChange={(e) => set('voice.defaultTone', e.target.value)}>{data.tones.map((t: any) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}</select></div>
            {num('voice.defaultSpeed', 'Vitesse par défaut (0.7 à 1.3)', 0.05)}
            {bool('voice.perCharacter', 'Voix différente pour les dialogues (coûte un peu plus de cache)')}
            {st.voice.perCharacter && <div className="field"><label>Voix des dialogues</label><select value={st.voice.dialogueProfile} onChange={(e) => set('voice.dialogueProfile', e.target.value)}>{data.voiceProfiles.map((v: any) => <option key={v.id} value={v.id}>{v.emoji} {v.label}</option>)}</select></div>}
            {bool('voice.allowBrowserTts', 'Autoriser la voix du navigateur en dernier recours (robotique)')}
            <h2>Catalogue de voix</h2>
            <table><tbody>{data.voiceProfiles.map((v: any) => (
              <tr key={v.id}><td>{v.emoji} <b>{v.label}</b><br /><small className="muted">{v.voice} — {v.instructions}</small></td>
                <td><button className="btn soft round" aria-label="Échantillon" onClick={async () => { unlockAudio(); try { await playOnce('Il était une fois un petit dragon qui aimait les histoires.', { profile: v.id, dialogueProfile: null, tone: st.voice.defaultTone, lang: 'fr', speed: 1, volume: 1, browserTts: false }); } catch (e) { flash((e as KidError).admin ?? (e as KidError).kid); } }}><Icon n="play" /></button></td></tr>
            ))}</tbody></table>
          </>)}

          {tab === 'story' && (<>
            <h2>Chapitres</h2>
            {num('story.minWords', 'Mots minimum par chapitre')}{num('story.maxWords', 'Mots maximum par chapitre')}
            {num('story.maxOutputTokens', 'Tokens de sortie max', 100, 'Limite la dépense par chapitre')}
            <h2>Illustrations</h2>
            <div className="field"><label>Fréquence</label><select value={st.image.mode} onChange={(e) => set('image.mode', e.target.value)}><option value="chapter">Une par chapitre</option><option value="major">Seulement aux moments importants (début, surprise, nouveau personnage)</option><option value="off">Aucune (économie)</option></select></div>
            <div className="field"><label>Qualité</label><select value={st.image.quality} onChange={(e) => set('image.quality', e.target.value)}><option value="low">Basse (la moins chère)</option><option value="medium">Moyenne</option><option value="high">Haute</option></select></div>
            <div className="field"><label>Taille</label><select value={st.image.size} onChange={(e) => set('image.size', e.target.value)}><option value="1024x1024">1024×1024 (carré)</option><option value="1024x1536">1024×1536 (portrait)</option><option value="1536x1024">1536×1024 (paysage)</option></select></div>
            {num('image.regenPerDay', 'Régénérations « autre image » par jour (0 = illimité)')}
            <div className="field"><label>Thème visuel de l’app</label><select value={st.theme} onChange={(e) => set('theme', e.target.value)}><option value="auto">Automatique</option><option value="day">Jour</option><option value="night">Nuit</option></select></div>
          </>)}

          {tab === 'lang' && (<>
            <h3>Langues activées</h3>
            <div className="chips" style={{ margin: '8px 0 14px' }}>{[['fr', '🇫🇷 Français'], ['de', '🇩🇪 Allemand'], ['en', '🇬🇧 Anglais']].map(([id, l]) => (
              <button key={id} className="chip" aria-pressed={st.languages.enabled.includes(id)} onClick={() => { const e = st.languages.enabled as string[]; set('languages.enabled', e.includes(id) ? e.filter((x) => x !== id) : [...e, id]); }}>{l}</button>))}</div>
            <div className="field"><label>Niveau (allemand / anglais)</label><select value={st.languages.level} onChange={(e) => set('languages.level', e.target.value)}><option value="A1">A1 — débutant (phrases très courtes)</option><option value="A2">A2 — élémentaire</option><option value="B1">B1 — intermédiaire</option></select></div>
            {bool('languages.softTranslation', 'Traduction douce : phrase d’aide en français sous le texte (coûte quelques tokens)')}
          </>)}

          {tab === 'limits' && (<>
            {num('limits.dailyMinutes', 'Durée d’utilisation maximale par jour (minutes, 0 = illimité)', 5)}
            <button className="btn soft" onClick={async () => { await api.post('/api/admin/extend-time', { minutes: 15 }); flash('+15 minutes accordées'); }}>Accorder 15 minutes aujourd’hui</button>
            {num('limits.monthlyBudgetUsd', 'Plafond de dépense mensuel (USD, 0 = aucun) — blocage automatique', 0.5)}
            {num('limits.dailyChapters', 'Chapitres par jour')}{num('limits.dailyImages', 'Images par jour')}{num('limits.dailyTtsChars', 'Caractères de voix par jour')}
          </>)}

          {tab === 'costs' && <Costs st={st} set={set} num={num} />}
          {tab === 'genres' && <Genres />}
          {tab === 'manage' && <Manage flash={flash} />}
          {tab === 'sec' && <Security cfg={cfg} flash={flash} />}
        </div>
      </div>
    </div>
  );
}

function Costs({ st, set, num }: { st: S; set: (p: string, v: any) => void; num: (p: string, l: string, s?: number, h?: string) => any }) {
  const [u, setU] = useState<S>(null);
  useEffect(() => { api.get<S>('/api/admin/usage').then(setU).catch(() => {}); }, []);
  if (!u) return null;
  const max = Math.max(0.0001, ...u.days.map((d: any) => d.cost));
  return (
    <>
      <div className="card"><h3>Ce mois ({u.month})</h3>
        <p style={{ fontSize: '2rem', fontWeight: 900 }}>{u.costChf.toFixed(2)} CHF <span className="muted" style={{ fontSize: '1rem' }}>({u.costUsd.toFixed(3)} USD)</span></p>
        <p className="muted">Plafond : {u.capUsd ? `${u.capUsd} USD` : 'aucun'} {u.blocked ? '— ⛔ ATTEINT, générations bloquées' : u.alert ? '— ⚠️ 80 % atteints' : ''}</p>
        <p className="muted">Aujourd’hui : {u.today.chapters} chapitres · {u.today.images} images · {u.today.ttsChars} caractères de voix</p>
      </div>
      <h2>Par jour (30 derniers jours, USD)</h2>
      <div className="bars" role="img" aria-label="Coût par jour">{u.days.map((d: any) => <i key={d.day} title={`${d.day}: ${d.cost.toFixed(3)} USD`} style={{ height: `${(d.cost / max) * 100}%` }} />)}</div>
      <h2>Par type</h2>
      <table><thead><tr><th>Type</th><th>Tokens (in/out)</th><th>Images</th><th>Audio (s)</th><th>USD</th></tr></thead>
        <tbody>{u.kinds.map((k: any) => <tr key={k.kind}><td>{k.kind}</td><td>{k.tin}/{k.tout}</td><td>{k.images}</td><td>{Math.round(k.audio)}</td><td>{k.cost.toFixed(3)}</td></tr>)}</tbody></table>
      {num('chfPerUsd', 'Taux de change CHF par USD', 0.01)}
      <h2>Tarifs (estimation, à vérifier sur la page de prix OpenAI)</h2>
      <p className="muted">Modifiez ces valeurs si les tarifs changent : le suivi et le plafond en dépendent.</p>
      {Object.entries(st.pricing.text).map(([m, p]: any) => <div className="row" key={m}><b style={{ minWidth: 140 }}>{m}</b>
        <label>entrée $/M <input type="number" step="0.01" style={{ width: 90 }} value={p.in} onChange={(e) => set(`pricing.text.${m}.in`, +e.target.value)} /></label>
        <label>sortie $/M <input type="number" step="0.01" style={{ width: 90 }} value={p.out} onChange={(e) => set(`pricing.text.${m}.out`, +e.target.value)} /></label></div>)}
      {Object.entries(st.pricing.tts).map(([m, p]: any) => <div className="row" key={m}><b style={{ minWidth: 140 }}>{m}</b><label>$/minute <input type="number" step="0.001" style={{ width: 90 }} value={p.perMinute} onChange={(e) => set(`pricing.tts.${m}.perMinute`, +e.target.value)} /></label></div>)}
      {Object.entries(st.pricing.stt).map(([m, p]: any) => <div className="row" key={m}><b style={{ minWidth: 140 }}>{m}</b><label>$/minute <input type="number" step="0.001" style={{ width: 90 }} value={p.perMinute} onChange={(e) => set(`pricing.stt.${m}.perMinute`, +e.target.value)} /></label></div>)}
      {Object.entries(st.pricing.image).map(([m, q]: any) => <div key={m}><b>{m} ($/image)</b>{Object.entries(q).map(([ql, sz]: any) => <div className="row" key={ql}><span style={{ minWidth: 70 }}>{ql}</span>{Object.entries(sz).map(([s, v]: any) => <label key={s}>{s} <input type="number" step="0.001" style={{ width: 80 }} value={v} onChange={(e) => set(`pricing.image.${m}.${ql}.${s}`, +e.target.value)} /></label>)}</div>)}</div>)}
    </>
  );
}

function Genres() {
  const [g, setG] = useState<S[]>([]);
  const [n, setN] = useState({ name: '', icon: '✨', description: '', prompt: '' });
  const load = () => api.get<S[]>('/api/admin/genres').then(setG);
  useEffect(() => { void load(); }, []);
  return (
    <>
      <table><tbody>{g.map((x) => (
        <tr key={x.id}><td>{x.icon} <b>{x.name}</b>{!x.builtin && <span className="pill">à vous</span>}<br /><small className="muted">{x.description}</small></td>
          <td><label className="switch"><span>actif</span><input type="checkbox" checked={!!x.active} onChange={async (e) => { await api.post('/api/admin/genres', { ...x, active: e.target.checked }); await load(); }} /></label></td>
          <td>{!x.builtin && <button className="btn soft round" onClick={async () => { await api.del(`/api/admin/genres/${x.id}`); await load(); }} aria-label="Supprimer"><Icon n="trash" /></button>}</td></tr>
      ))}</tbody></table>
      <h2>Ajouter un genre</h2>
      <div className="field"><label>Nom</label><input type="text" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></div>
      <div className="field"><label>Icône (emoji)</label><input type="text" value={n.icon} onChange={(e) => setN({ ...n, icon: e.target.value })} /></div>
      <div className="field"><label>Description courte</label><input type="text" value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} /></div>
      <div className="field"><label>Consigne pour l’IA (ambiance, décor…)</label><textarea value={n.prompt} onChange={(e) => setN({ ...n, prompt: e.target.value })} /></div>
      <button className="btn mint" disabled={!n.name} onClick={async () => { await api.post('/api/admin/genres', { ...n, sort: 100 }); setN({ name: '', icon: '✨', description: '', prompt: '' }); await load(); }}><Icon n="plus" />Ajouter</button>
    </>
  );
}

function Manage({ flash }: { flash: (m: string) => void }) {
  const [stories, setStories] = useState<S[]>([]);
  const [mod, setMod] = useState<S[]>([]);
  const [ev, setEv] = useState<S[]>([]);
  const [size, setSize] = useState<S>(null);
  const load = useCallback(() => {
    void api.get<S[]>('/api/stories').then(setStories); void api.get<S[]>('/api/admin/moderation-log').then(setMod);
    void api.get<S[]>('/api/admin/events').then(setEv); void api.get<S>('/api/admin/cache-size').then(setSize);
  }, []);
  useEffect(load, [load]);
  const dl = async (url: string, name: string) => {
    const r = await fetch(url, { headers: { 'x-admin-token': adminToken.get() } });
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click();
  };
  return (
    <>
      <h2>Histoires ({stories.length})</h2>
      <table><tbody>{stories.map((s) => (
        <tr key={s.id}><td><b>{s.title}</b><br /><small className="muted">{s.chapters} chap. · {new Date(s.updatedAt).toLocaleDateString('fr-CH')}</small></td>
          <td className="row"><button className="btn soft" onClick={() => void dl(`/api/admin/stories/${s.id}/export`, `${s.title}.json`)}>Exporter</button>
            <button className="btn soft round" aria-label="Supprimer" onClick={async () => { if (confirm(`Supprimer « ${s.title} » ?`)) { await api.del(`/api/stories/${s.id}`); load(); } }}><Icon n="trash" /></button></td></tr>
      ))}</tbody></table>
      <h2>Sauvegarde</h2>
      <div className="row">
        <button className="btn" onClick={() => void dl('/api/admin/backup', 'pixicontes-sauvegarde.json')}>Sauvegarder (sans images)</button>
        <button className="btn soft" onClick={() => void dl('/api/admin/backup?images=1', 'pixicontes-sauvegarde-complete.json')}>Sauvegarde complète (avec images)</button>
        <label className="btn orange">Restaurer…<input type="file" accept="application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f || !confirm('Remplacer toutes les données actuelles ?')) return;
          try { await api.post('/api/admin/restore', JSON.parse(await f.text())); flash('✅ Restauré'); load(); } catch { flash('Fichier invalide'); }
        }} /></label>
      </div>
      <p className="muted">La clé API et le code PIN ne sont jamais inclus dans la sauvegarde.</p>
      <h2>Caches</h2>
      {size && <p className="muted">Audio : {size.audioMb} Mo · Images : {size.imagesMb} Mo</p>}
      <div className="row"><button className="btn soft" onClick={async () => { const r = await api.post<S>('/api/admin/clear-cache', { audio: true }); flash(`🧹 ${r.freedMb} Mo libérés`); load(); }}>Vider le cache audio</button>
        <button className="btn soft" onClick={async () => { await api.post('/api/admin/clear-cache', { dictionary: true }); flash('🧹 Dictionnaire vidé'); }}>Vider le dictionnaire</button></div>
      <h2>Contenus filtrés ({mod.length})</h2>
      <table><tbody>{mod.slice(0, 50).map((m) => <tr key={m.id}><td>{new Date(m.ts).toLocaleString('fr-CH')}</td><td>{m.source === 'input' ? 'enfant' : 'IA'}</td><td>{m.category}</td><td>{m.excerpt}</td></tr>)}</tbody></table>
      <h2>Journal des erreurs</h2>
      <table><tbody>{ev.slice(0, 30).map((m) => <tr key={m.id}><td>{new Date(m.ts).toLocaleString('fr-CH')}</td><td>{m.msg}</td></tr>)}</tbody></table>
    </>
  );
}

function Security({ flash }: { cfg: Config; flash: (m: string) => void }) {
  const [o, setO] = useState(''); const [n, setN] = useState('');
  return (
    <div className="card"><h3>Changer le code PIN</h3>
      <div className="field"><label>Ancien code</label><input type="password" inputMode="numeric" value={o} onChange={(e) => setO(e.target.value)} /></div>
      <div className="field"><label>Nouveau code (4 à 12 chiffres)</label><input type="password" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} /></div>
      <button className="btn" disabled={n.length < 4} onClick={async () => { try { await api.post('/api/admin/change-pin', { oldPin: o, newPin: n }); flash('✅ Code changé'); setO(''); setN(''); } catch (e) { flash((e as KidError).admin ?? 'Erreur'); } }}>Changer</button>
      <p className="muted" style={{ marginTop: 10 }}>Après 5 essais ratés, l’accès est verrouillé 1 min, puis 5, 15 et 60 min.</p>
    </div>
  );
}
