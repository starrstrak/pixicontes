import { useState } from 'react';
import type { Config, HeroDraft } from '../lib/types';
import { HeroForm } from '../components/HeroForm';
import { Icon } from '../components/Icon';
import { Say } from '../components/ui';
import { api } from '../lib/api';
import { usePrefs } from '../lib/prefs';

export function Characters({ items, cfg, onChanged }: { items: (HeroDraft & { id: string })[]; cfg: Config; onChanged: () => void }) {
  const [edit, setEdit] = useState<HeroDraft | 'new' | null>(null);
  const prefs = usePrefs();
  if (edit) return <HeroForm cfg={cfg} lang={prefs.lang} initial={edit === 'new' ? undefined : edit} title={edit === 'new' ? 'Nouveau personnage' : 'Modifier'} onCancel={() => setEdit(null)} onDone={async (h) => { await api.post('/api/characters', h); setEdit(null); onChanged(); }} />;
  return (
    <div>
      <div className="topbar"><h1>Mes personnages</h1><button className="btn mint" onClick={() => setEdit('new')}><Icon n="plus" />Créer</button></div>
      {!items.length ? <div className="empty"><Say mood="joy">Invente tes héros ! Ils pourront vivre dans toutes tes histoires.</Say></div> : (
        <div className="grid">
          {items.map((c) => (
            <div key={c.id} className="card-btn" style={{ minHeight: 170 }}>
              <span className="big-emoji">🧒</span>{c.name}<small>{c.powers}</small>
              <div className="row"><button className="chip" onClick={() => setEdit(c)} aria-label={`Modifier ${c.name}`}><Icon n="edit" size={20} /></button>
                <button className="chip" onClick={async () => { await api.del(`/api/characters/${c.id}`); onChanged(); }} aria-label={`Supprimer ${c.name}`}><Icon n="trash" size={20} /></button></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
