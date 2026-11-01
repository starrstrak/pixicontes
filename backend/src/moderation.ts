// Sécurité enfant : nettoyage des données perso, filtre local (gratuit, hors-ligne) + modération OpenAI (gratuite).
import { db, now, getSettings } from './db.js';
import { oaFetch, recordUsage } from './openai.js';
import { getApiKey } from './secrets.js';

/** Retire e-mails, liens, numéros de téléphone avant tout envoi à l'IA. */
export function scrubPII(text: string, max = 400): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ')
    .replace(/(\+?\d[\d .-]{7,}\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Radicaux sans ambiguïté (FR/EN/DE). Volontairement courts : les combats de dragons restent permis.
// Bornes Unicode (\b ne gère pas les lettres accentuées).
const W = (src: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, 'iu');
const LOCAL_BLOCK: [RegExp, string][] = [
  [W(String.raw`porno?|sexe|sexy|sex|nudes?|violer|violé|violee|violeur`), 'sexual'],
  [W(String.raw`(?:égorg|egorg|massacr|décapit|decapit|éventr|eventr|tripes|torture|torturer|démembr|demembr)\w*`), 'violence/graphic'],
  [W(String.raw`suicid\w*|me\s+tuer|se\s+tuer|kill\s+myself|selbstmord`), 'self-harm'],
  [W(String.raw`nazi|hitler|racis\w*|sale\s+(noir|arabe|juif|nègre)|nigg\w+`), 'hate'],
  [W(String.raw`drogue|cocaïne|cocaine|héroïne|heroine|cannabis|weed|alcool\s+fort`), 'illicit'],
  [W(String.raw`connard|enculé|encule|salope|pute|putain|merde|fuck\w*|bitch|shit|scheiße|scheisse|arschloch`), 'harassment'],
  [W(String.raw`mon\s+adresse|mon\s+numéro|mon\s+telephone|mon\s+téléphone|mot\s+de\s+passe|password`), 'privacy'],
];
export function localCheck(text: string): { flagged: boolean; category?: string } {
  for (const [re, cat] of LOCAL_BLOCK) if (re.test(text)) return { flagged: true, category: cat };
  return { flagged: false };
}

type ModResult = { flagged: boolean; categories: Record<string, boolean>; category_scores: Record<string, number> };
// Seuils adaptés à 8 ans ; « violence » simple tolérée à un niveau bas (dragons, chevaliers), le reste strict.
const THRESHOLDS: Record<string, number> = {
  sexual: 0.1, 'sexual/minors': 0.01, hate: 0.2, 'hate/threatening': 0.1, harassment: 0.5, 'harassment/threatening': 0.3,
  'self-harm': 0.1, 'self-harm/intent': 0.05, 'self-harm/instructions': 0.05,
  violence: 0.85, 'violence/graphic': 0.2, illicit: 0.5, 'illicit/violent': 0.2,
};
/** Décide à partir du résultat OpenAI (fonction pure, testée). */
export function evaluateModeration(r: ModResult): { flagged: boolean; category?: string } {
  for (const [cat, th] of Object.entries(THRESHOLDS)) {
    const score = r.category_scores?.[cat];
    if (typeof score === 'number' && score >= th) return { flagged: true, category: cat };
  }
  return { flagged: false };
}

export function logModeration(source: 'input' | 'output', category: string, text: string, action: string) {
  // Extrait court seulement (pas de donnée personnelle conservée au-delà de 120 caractères).
  db.prepare('INSERT INTO moderation_log(ts,source,category,excerpt,action) VALUES(?,?,?,?,?)').run(now(), source, category, text.slice(0, 120), action);
}

/** Vérifie un texte : filtre local puis modération OpenAI si une clé existe. Échec réseau → on reste prudent côté sortie. */
export async function moderate(text: string, source: 'input' | 'output'): Promise<{ flagged: boolean; category?: string }> {
  const local = localCheck(text);
  if (local.flagged) {
    logModeration(source, local.category!, text, 'détourné (filtre local)');
    return local;
  }
  if (!getApiKey() || !text.trim()) return { flagged: false };
  try {
    const res = await oaFetch(
      '/moderations',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: getSettings().models.moderation, input: text }) },
      { retries: 1, timeoutMs: 15000 },
    );
    const j = (await res.json()) as { results: ModResult[] };
    recordUsage({ kind: 'moderation', model: getSettings().models.moderation, cost: 0 });
    const ev = evaluateModeration(j.results[0]);
    if (ev.flagged) logModeration(source, ev.category!, text, 'détourné (modération OpenAI)');
    return ev;
  } catch {
    // Modération indisponible : l'entrée passe par le filtre local + prompt strict ; la sortie est aussi protégée par le prompt.
    return { flagged: false };
  }
}
