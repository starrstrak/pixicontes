// Client API. Les erreurs sont toujours transformées en messages doux pour l'enfant.
export class KidError extends Error {
  constructor(public kid: string, public code = 'server', public admin?: string, public status = 500) { super(kid); }
}
const tokenKey = 'pixi_admin';
export const adminToken = {
  get: () => { try { return sessionStorage.getItem(tokenKey) ?? ''; } catch { return ''; } },
  set: (t: string) => { try { t ? sessionStorage.setItem(tokenKey, t) : sessionStorage.removeItem(tokenKey); } catch { /* ignore */ } },
};

async function raw(method: string, url: string, body?: unknown, form?: FormData): Promise<Response> {
  const headers: Record<string, string> = {};
  const t = adminToken.get();
  if (t) headers['x-admin-token'] = t;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  } catch {
    throw new KidError('Oups, Pixi ne trouve plus Internet. Vérifie que le wifi est allumé !', 'network');
  }
  if (!res.ok) {
    let e: { error?: { kid?: string; code?: string; admin?: string } } = {};
    try { e = await res.json(); } catch { /* ignore */ }
    throw new KidError(e.error?.kid ?? 'Pixi s’est emmêlé les ailes. On réessaie ?', e.error?.code ?? 'server', e.error?.admin, res.status);
  }
  return res;
}
export const api = {
  get: async <T>(u: string) => (await raw('GET', u)).json() as Promise<T>,
  post: async <T>(u: string, b?: unknown) => (await raw('POST', u, b ?? {})).json() as Promise<T>,
  put: async <T>(u: string, b?: unknown) => (await raw('PUT', u, b ?? {})).json() as Promise<T>,
  patch: async <T>(u: string, b?: unknown) => (await raw('PATCH', u, b ?? {})).json() as Promise<T>,
  del: async <T>(u: string) => (await raw('DELETE', u)).json() as Promise<T>,
  blob: async (u: string, b: unknown) => (await raw('POST', u, b)).blob(),
  form: async <T>(u: string, f: FormData) => (await raw('POST', u, undefined, f)).json() as Promise<T>,
};
