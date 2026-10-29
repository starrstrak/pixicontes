// Pixi, le petit dragon. États : calme, joie (saute), réflexion (balance), sommeil.
export type Mood = 'idle' | 'joy' | 'think' | 'sleep';
export function Mascot({ mood = 'idle', size = 96 }: { mood?: Mood; size?: number }) {
  return (
    <svg className={`dragon ${mood}`} viewBox="0 0 120 120" style={{ width: size, height: size }} role="img" aria-label="Pixi le dragon">
      <g className="body-g">
        <path className="wing" d="M78 52c14-18 34-16 38-8-8 2-10 8-8 14-6-4-12-2-14 4-2-4-8-6-16-10Z" fill="#ffb86b" />
        <path d="M30 84c-14 2-20 12-14 20 6-6 14-6 22-2l-8-18Z" fill="#46c98f" />
        <ellipse cx="60" cy="76" rx="32" ry="30" fill="#5ee0a6" />
        <ellipse cx="60" cy="86" rx="20" ry="20" fill="#fff0c2" />
        <g fill="#7c5cff"><path d="M44 28l5 10 6-8 5 9 6-9 5 8 4-10-8-4-8 4-8-4Z" opacity=".9" /></g>
        <circle cx="60" cy="52" r="28" fill="#5ee0a6" />
        <circle cx="44" cy="62" r="6" fill="#ff9fc0" opacity=".7" /><circle cx="76" cy="62" r="6" fill="#ff9fc0" opacity=".7" />
        <g className="eye"><ellipse cx="48" cy="50" rx="6" ry="8" fill="#2b2340" /><circle cx="50" cy="47" r="2.4" fill="#fff" /></g>
        <g className="eye"><ellipse cx="72" cy="50" rx="6" ry="8" fill="#2b2340" /><circle cx="74" cy="47" r="2.4" fill="#fff" /></g>
        <ellipse cx="60" cy="62" rx="7" ry="5" fill="#46c98f" />
        <circle cx="57" cy="61" r="1.2" fill="#2b2340" /><circle cx="63" cy="61" r="1.2" fill="#2b2340" />
        {mood === 'joy' ? <path d="M50 68q10 12 20 0Z" fill="#c44569" stroke="#2b2340" strokeWidth="2" strokeLinejoin="round" /> : <path d="M52 69q8 6 16 0" fill="none" stroke="#2b2340" strokeWidth="2.6" strokeLinecap="round" />}
        {mood === 'think' && <text x="88" y="30" fontSize="22">💭</text>}
        {mood === 'sleep' && <text x="88" y="30" fontSize="20">💤</text>}
        <path d="M38 30 32 16l14 8ZM82 30l6-14-14 8Z" fill="#ffd166" />
      </g>
    </svg>
  );
}
