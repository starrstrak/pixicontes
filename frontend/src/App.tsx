import { useCallback, useEffect, useRef, useState } from 'react';
import type { Config, HeroDraft, Story, StoryItem } from './lib/types';
import { adminToken, api } from './lib/api';
import { applyPrefs, usePrefs } from './lib/prefs';
import { unlockAudio } from './lib/player';
import { sfx } from './lib/sound';
import { Icon } from './components/Icon';
import { Mascot } from './components/Mascot';
import { useUI } from './components/ui';
import { NewStory } from './screens/NewStory';
import { Library } from './screens/Library';
import { Characters } from './screens/Characters';
import { ChildSettings } from './screens/ChildSettings';
import { Reader } from './screens/Reader';
import { Admin, PinGate } from './screens/Admin';

type Tab = 'new' | 'library' | 'chars' | 'settings';
const TABS: [Tab, string, string][] = [['new', 'Nouvelle histoire', 'plus'], ['library', 'Mes histoires', 'book'], ['chars', 'Mes personnages', 'users'], ['settings', 'Réglages', 'gear']];

export function App() {
  const prefs = usePrefs();
  const { toast } = useUI();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [tab, setTab] = useState<Tab>('new');
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [chars, setChars] = useState<(HeroDraft & { id: string })[]>([]);
  const [open, setOpen] = useState<Story | null>(null);
  const [admin, setAdmin] = useState<'off' | 'pin' | 'on'>('off');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  const loadCfg = useCallback(async () => { try { const c = await api.get<Config>('/api/config'); setCfg(c); setTimeLeft(c.timeLeftSec); } catch { /* hors-ligne : cache du service worker */ } }, []);
  const loadLists = useCallback(async () => {
    try { setStories(await api.get<StoryItem[]>('/api/stories')); setChars(await api.get('/api/characters')); } catch { /* hors-ligne */ }
  }, []);
  useEffect(() => { void loadCfg(); void loadLists(); }, [loadCfg, loadLists]);
  useEffect(() => { if (cfg) applyPrefs(prefs, cfg.theme); }, [cfg, prefs]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    const unlock = () => unlockAudio(); addEventListener('pointerdown', unlock, { once: true });
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);

  // Temps d'écran : un ping toutes les 20 s tant que l'app est visible
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden || !navigator.onLine) return;
      try { const r = await api.post<{ timeLeftSec: number | null }>('/api/ping', { seconds: 20 }); setTimeLeft(r.timeLeftSec); } catch { /* ignore */ }
    }, 20000);
    return () => clearInterval(t);
  }, []);

  // Appui long (1,2 s) sur le logo = porte du parent
  const lp = useRef<number | undefined>(undefined);
  const logoDown = () => { lp.current = window.setTimeout(() => { sfx('tap'); setAdmin(adminToken.get() ? 'on' : 'pin'); }, 1200); };
  const logoUp = () => window.clearTimeout(lp.current);

  async function openStory(id: string) {
    try { sfx('page'); setOpen(await api.get<Story>(`/api/stories/${id}`)); } catch (e) { toast((e as { kid?: string }).kid ?? 'Oups !'); }
  }

  if (!cfg) return <div className="loader" style={{ position: 'static', height: '100%' }}><Mascot mood="think" size={140} /><h2>Pixi se réveille…</h2><p className="muted">Si ça dure, vérifie que le serveur est allumé.</p></div>;

  const asleep = timeLeft === 0 && admin === 'off';
  return (
    <div className="app">
      <nav className="tabbar" aria-label="Menu principal">
        {TABS.map(([id, label, icon]) => <button key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => { sfx('tap'); setTab(id); if (id === 'library') void loadLists(); }}><Icon n={icon} /><span>{label}</span></button>)}
      </nav>
      <main className="main">
        <div className="topbar" style={{ marginBottom: 6 }}>
          <div className="logo-btn" onPointerDown={logoDown} onPointerUp={logoUp} onPointerLeave={logoUp} onContextMenu={(e) => e.preventDefault()}><Mascot size={44} /> PixiContes</div>
          {!online && <span className="pill">📴 Hors-ligne : tu peux relire tes histoires</span>}
          {!cfg.hasKey && <span className="pill">💤 Pixi dort : demande à un grand</span>}
        </div>
        {tab === 'new' && <NewStory cfg={cfg} libraryHeroes={chars} onCreated={(s) => { setOpen(s); void loadLists(); setTab('library'); }} />}
        {tab === 'library' && <Library items={stories} cfg={cfg} onOpen={openStory} onNew={() => setTab('new')} onChanged={loadLists} />}
        {tab === 'chars' && <Characters items={chars} cfg={cfg} onChanged={loadLists} />}
        {tab === 'settings' && <ChildSettings cfg={cfg} />}
      </main>
      {open && <Reader key={open.id} initial={open} cfg={cfg} onClose={() => { setOpen(null); void loadLists(); }} onChanged={loadLists} />}
      {admin === 'pin' && <PinGate onClose={() => setAdmin('off')} onOk={() => setAdmin('on')} />}
      {admin === 'on' && <Admin cfg={cfg} onClose={() => { setAdmin('off'); void loadCfg(); }} onConfig={loadCfg} />}
      {asleep && <div className="sleep"><Mascot mood="sleep" size={160} /><h1>Pixi dort…</h1><p>C’est fini pour aujourd’hui. À bientôt pour de nouvelles aventures ! 🌙</p></div>}
    </div>
  );
}
