// Pixi : petit personnage-blob à cornes, aplats lavande et rose poudré (style graphique, sans dégradés).
export type Mood = 'idle' | 'joy' | 'think' | 'sleep';
export function Mascot({ mood = 'idle', size = 96 }: { mood?: Mood; size?: number }) {
  return (
    <svg className={`dragon ${mood}`} viewBox="0 0 120 120" style={{ width: size, height: size }} role="img" aria-label="Pixi">
      <g className="body-g">
        <path className="wing" d="M92 66c12-4 20 2 22 10-8 0-12 4-12 10-6-2-12-6-14-12l4-8Z" fill="#eab3a8" />
        <path d="M60 14c24 0 40 18 40 44 0 24-14 44-40 44S20 82 20 58c0-26 16-44 40-44Z" fill="#a3a3e8" />
        <path d="M34 22 30 6l16 8ZM86 22l4-16-16 8Z" fill="#2a2b3d" />
        <ellipse cx="60" cy="86" rx="22" ry="14" fill="#c9c9f4" opacity=".7" />
        <circle cx="34" cy="68" r="8" fill="#eab3a8" /><circle cx="86" cy="68" r="8" fill="#eab3a8" />
        <g className="eye"><ellipse cx="46" cy="52" rx="10" ry="12" fill="#fff" /><circle cx="48" cy="54" r="5.5" fill="#2a2b3d" /></g>
        <g className="eye"><ellipse cx="74" cy="52" rx="10" ry="12" fill="#fff" /><circle cx="72" cy="54" r="5.5" fill="#2a2b3d" /></g>
        {mood === 'joy' ? <path d="M48 72h24c0 10-6 16-12 16s-12-6-12-16Z" fill="#2a2b3d" /> : mood === 'think' ? <path d="M52 76h16" stroke="#2a2b3d" strokeWidth="4" strokeLinecap="round" /> : <path d="M50 74q10 9 20 0" fill="none" stroke="#2a2b3d" strokeWidth="4" strokeLinecap="round" />}
        {mood === 'think' && <g fill="#eab3a8"><circle cx="98" cy="22" r="4" /><circle cx="106" cy="12" r="6" /></g>}
        {mood === 'sleep' && <path d="M94 24h12l-12 14h12" fill="none" stroke="#2a2b3d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      </g>
    </svg>
  );
}
