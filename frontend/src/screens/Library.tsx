import { useState } from 'react';
import type { Config, StoryItem } from '../lib/types';
import { Icon, GenreIcon } from '../components/Icon';
import { Modal, Say } from '../components/ui';
import { api } from '../lib/api';

export function Library({ items, cfg, onOpen, onNew, onChanged }: { items: StoryItem[]; cfg: Config; onOpen: (id: string) => void; onNew: () => void; onChanged: () => void }) {
  const [del, setDel] = useState<StoryItem | null>(null);
  return (
    <div>
      <div className="topbar"><div><span className="eyebrow">Bibliothèque</span><h1>Mes histoires</h1></div></div>
      {!items.length ? (
        <div className="empty"><Say mood="idle">Ta bibliothèque est vide. Créons ta première histoire !</Say><button className="btn big" onClick={onNew}><Icon n="plus" />Nouvelle histoire</button></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 18 }}>
          {items.map((s) => {
            const g = cfg.genres.find((x) => x.id === s.genreId);
            const fl = cfg.languages.find((l) => l.id === s.lang)?.flag;
            return (
              <div key={s.id} className="card-btn story-card" role="group">
                <button onClick={() => onOpen(s.id)} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }} aria-label={`Ouvrir ${s.title}`}>
                  {s.cover ? <img className="cover" src={`/media/images/${s.cover}`} alt="" loading="lazy" /> : <div className="cover" style={{ ['--gc' as string]: g?.color }}><GenreIcon id={s.genreId ?? ''} emoji="📖" /></div>}
                  <b style={{ fontFamily: 'var(--serif)', lineHeight: 1.25 }}>{s.title}</b>
                  <small>{fl} {s.chapters} chapitre{s.chapters > 1 ? 's' : ''}{s.heroes[0] ? ` · ${s.heroes[0]}` : ''}</small>
                </button>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <a className="chip" href={`/api/stories/${s.id}/pdf`} download aria-label="PDF"><Icon n="pdf" size={20} />PDF</a>
                  <button className="chip" onClick={() => setDel(s)} aria-label="Supprimer"><Icon n="trash" size={20} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {del && (
        <Modal onClose={() => setDel(null)} label="Supprimer l’histoire">
          <h2>Effacer « {del.title} » ?</h2><p className="muted" style={{ margin: '8px 0 16px' }}>Cette histoire disparaîtra pour toujours.</p>
          <div className="row"><button className="btn soft" onClick={() => setDel(null)}>Non, je la garde</button>
            <button className="btn danger" onClick={async () => { await api.del(`/api/stories/${del.id}`); setDel(null); onChanged(); }}><Icon n="trash" />Effacer</button></div>
        </Modal>
      )}
    </div>
  );
}
