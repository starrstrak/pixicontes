// Logo PixiContes : marque seule (livre ouvert) ou logo complet. En mode nuit, posé sur une pastille claire pour rester lisible.
export function Logo({ variant = 'mark', height = 40 }: { variant?: 'mark' | 'full'; height?: number }) {
  return <img className="brand-img" src={`/brand/logo-${variant}.png`} alt={variant === 'full' ? 'PixiContes' : ''} aria-hidden={variant === 'mark'} style={{ height, width: 'auto' }} draggable={false} />;
}
/** Nom en deux tons, comme sur le logo. */
export function Wordmark() {
  return <span className="wordmark"><span>Pixi</span><span>Contes</span></span>;
}
