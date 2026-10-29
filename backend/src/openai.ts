// Client OpenAI minimal (fetch), avec retries, erreurs typées, suivi des coûts et plafond mensuel.
import { db, getSettings, now, dayStr, monthStr, logEvent } from './db.js';
import { getApiKey } from './secrets.js';

export type ErrCode = 'no_key' | 'invalid_key' | 'rate_limit' | 'quota' | 'network' | 'server' | 'bad_request' | 'budget' | 'limit' | 'blocked' | 'busy';

/** kid = message doux affiché à l'enfant ; admin = détail précis pour le parent. */
export class ApiError extends Error {
  constructor(public code: ErrCode, public kid: string, public admin: string, public status = 500) {
    super(admin);
  }
}
export const KID_MSG: Record<ErrCode, string> = {
  no_key: 'Pixi dort encore ! Demande à un grand de le réveiller.',
  invalid_key: 'Pixi a un petit souci de magie. Demande à un grand de regarder.',
  rate_limit: 'Pixi réfléchit trop vite ! On réessaie dans un instant.',
  quota: 'Pixi a besoin d’un petit repos. Demande à un grand.',
  network: 'Oups, Pixi ne trouve plus le chemin d’Internet. Vérifie le wifi !',
  server: 'Pixi s’est un peu emmêlé les ailes. On réessaie ?',
  bad_request: 'Pixi n’a pas bien compris. On réessaie ?',
  budget: 'Pixi a fini ses étoiles magiques pour ce mois-ci. À bientôt !',
  limit: 'C’est assez pour aujourd’hui ! Pixi va se reposer, à demain.',
  blocked: 'Pixi a une autre idée pour continuer l’histoire !',
  busy: 'Un instant, Pixi finit de réfléchir…',
};

// ---- Coûts ----
export function costText(model: string, tin: number, tout: number): number {
  const p = getSettings().pricing.text[model] ?? { in: 0.5, out: 2 }; // modèle inconnu : estimation prudente
  return (tin * p.in + tout * p.out) / 1e6;
}
export function costImage(model: string, quality: string, size: string): number {
  return getSettings().pricing.image[model]?.[quality]?.[size] ?? 0.05;
}
export function costTts(model: string, seconds: number): number {
  return ((getSettings().pricing.tts[model]?.perMinute ?? 0.02) * seconds) / 60;
}
export function costStt(model: string, seconds: number): number {
  return ((getSettings().pricing.stt[model]?.perMinute ?? 0.006) * seconds) / 60;
}
/** Estimation de la durée audio d'un texte lu (≈ 15 caractères / seconde en français). */
export const estimateSeconds = (chars: number) => chars / 15;

export function recordUsage(u: { kind: string; model?: string; tin?: number; tout?: number; images?: number; seconds?: number; chars?: number; cost: number }) {
  const t = now();
  db.prepare(
    'INSERT INTO usage(ts,day,month,kind,model,tokens_in,tokens_out,images,audio_seconds,chars,cost_usd) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
  ).run(t, dayStr(t), monthStr(t), u.kind, u.model ?? null, u.tin ?? 0, u.tout ?? 0, u.images ?? 0, u.seconds ?? 0, u.chars ?? 0, u.cost);
}
export function monthCost(m = monthStr()): number {
  return (db.prepare('SELECT COALESCE(SUM(cost_usd),0) c FROM usage WHERE month=?').get(m) as { c: number }).c;
}
/** Bloque toute génération payante si le plafond mensuel est atteint. */
export function assertBudget() {
  const cap = getSettings().limits.monthlyBudgetUsd;
  if (cap > 0 && monthCost() >= cap) {
    throw new ApiError('budget', KID_MSG.budget, `Plafond mensuel atteint (${monthCost().toFixed(2)} USD / ${cap} USD). Augmentez-le dans Réglages > Limites.`, 402);
  }
}

// ---- HTTP ----
// OPENAI_BASE_URL permet de pointer vers un faux serveur pour les tests de bout en bout.
const BASE = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function oaFetch(pathname: string, init: RequestInit & { headers?: Record<string, string> }, opts: { retries?: number; timeoutMs?: number } = {}): Promise<Response> {
  const key = getApiKey();
  if (!key) throw new ApiError('no_key', KID_MSG.no_key, 'Aucune clé API OpenAI. Ajoutez-la dans Admin > Clé API.', 503);
  const retries = opts.retries ?? 3;
  let lastErr: ApiError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(BASE + pathname, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
      });
      if (res.ok) return res;
      const body = await res.text().catch(() => '');
      let msg = body.slice(0, 300);
      try {
        msg = (JSON.parse(body) as { error?: { message?: string; code?: string } }).error?.message ?? msg;
      } catch {
        /* texte brut */
      }
      msg = msg.split(key).join('[clé]');
      if (res.status === 401) throw new ApiError('invalid_key', KID_MSG.invalid_key, `Clé API refusée par OpenAI (401). ${msg}`, 401);
      if (res.status === 429 && /quota|billing/i.test(msg)) throw new ApiError('quota', KID_MSG.quota, `Crédit OpenAI épuisé ou facturation non configurée (429). ${msg}`, 402);
      if (res.status === 429) lastErr = new ApiError('rate_limit', KID_MSG.rate_limit, `Limite de débit OpenAI (429). ${msg}`, 429);
      else if (res.status >= 500) lastErr = new ApiError('server', KID_MSG.server, `Erreur serveur OpenAI (${res.status}). ${msg}`, 502);
      else throw new ApiError('bad_request', KID_MSG.bad_request, `Requête refusée (${res.status}) : ${msg}`, 400);
      const ra = Number(res.headers.get('retry-after'));
      if (attempt < retries) await sleep(ra > 0 && ra < 20 ? ra * 1000 : 1000 * 2 ** attempt);
    } catch (e) {
      if (e instanceof ApiError && !['rate_limit', 'server', 'network'].includes(e.code)) throw e;
      if (!(e instanceof ApiError)) lastErr = new ApiError('network', KID_MSG.network, `Réseau indisponible ou délai dépassé vers api.openai.com (${(e as Error).message}).`, 503);
      if (attempt < retries) await sleep(1000 * 2 ** attempt);
    }
  }
  logEvent('error', lastErr?.admin ?? 'Erreur OpenAI inconnue');
  throw lastErr ?? new ApiError('server', KID_MSG.server, 'Erreur inconnue');
}

const isReasoning = (m: string) => /^(gpt-5|o\d)/.test(m);

/** Appel texte avec sortie JSON contrainte par schéma (strict). */
export async function chatJSON<T>(o: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  name: string;
  kind: string;
  maxTokens?: number;
  model?: string;
}): Promise<T> {
  assertBudget();
  const s = getSettings();
  const model = o.model ?? s.models.text;
  let max = o.maxTokens ?? s.story.maxOutputTokens;
  for (let attempt = 0; attempt < 2; attempt++) {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: o.system },
        { role: 'user', content: o.user },
      ],
      response_format: { type: 'json_schema', json_schema: { name: o.name, strict: true, schema: o.schema } },
      max_completion_tokens: max,
    };
    if (isReasoning(model)) body.reasoning_effort = 'minimal';
    else body.temperature = 0.9;
    const res = await oaFetch('/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await res.json()) as {
      choices: { message: { content: string | null; refusal?: string | null }; finish_reason: string }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const tin = j.usage?.prompt_tokens ?? 0;
    const tout = j.usage?.completion_tokens ?? 0;
    recordUsage({ kind: o.kind, model, tin, tout, cost: costText(model, tin, tout) });
    const c = j.choices?.[0];
    if (c?.finish_reason === 'length' && attempt === 0) {
      max = Math.min(max * 2, 6000);
      continue;
    }
    if (!c?.message.content) throw new ApiError('server', KID_MSG.server, `Réponse vide ou refusée par le modèle (${c?.message.refusal ?? c?.finish_reason}).`, 502);
    try {
      return JSON.parse(c.message.content) as T;
    } catch {
      if (attempt === 1) throw new ApiError('server', KID_MSG.server, 'JSON invalide renvoyé par le modèle.', 502);
    }
  }
  throw new ApiError('server', KID_MSG.server, 'Génération impossible.', 502);
}

/** Test de clé : liste de modèles (gratuit). */
export async function testKey(): Promise<{ ok: boolean; message: string }> {
  try {
    await oaFetch('/models', { method: 'GET' }, { retries: 0, timeoutMs: 15000 });
    return { ok: true, message: 'Clé valide : connexion à OpenAI réussie.' };
  } catch (e) {
    return { ok: false, message: e instanceof ApiError ? e.admin : (e as Error).message };
  }
}
