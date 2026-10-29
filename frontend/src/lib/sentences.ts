// Même découpage que le serveur (backend/src/memory.ts) : phrases pour la lecture et le surlignage.
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?…\n]+(?:[.!?…]+["»”)]*|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) { const s = m[0].trim(); if (s) out.push(s); }
  const merged: string[] = [];
  for (const s of out) {
    if (merged.length && merged[merged.length - 1].length < 14) merged[merged.length - 1] += ' ' + s;
    else merged.push(s);
  }
  return merged;
}
export const DICT_RE = /^\s*(?:c['’]est quoi|qu['’]est[- ]ce que (?:c['’]est|veut dire)|ça veut dire quoi|ca veut dire quoi|what (?:does|is)|was (?:ist|bedeutet))\s+(?:un |une |le |la |les |l['’]|the |a |ein |eine |der |die |das )?(.+?)\s*[?!.]*$/i;
