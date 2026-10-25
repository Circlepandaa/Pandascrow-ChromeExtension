import { apiBase, VERSION, type Env } from './env';
import { clearSession, deviceId, getSession, setSession, type Session, type SessionUser } from './storage';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The login session ended (signed out elsewhere, expired). The UI goes back to sign-in. */
export class SessionEnded extends ApiError {
  constructor(message = 'Your session has ended. Please sign in again.') {
    super(message, 401);
    this.name = 'SessionEnded';
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

/** Seconds left on a JWT, from its exp claim (0 if unreadable). */
export function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

/**
 * Some API responses have extra output (a PHP warning, a debug echo) before
 * the JSON. Keep the last complete JSON object that looks like a response.
 */
export function parseBody(text: string): any {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const chunks: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"' && depth > 0) inString = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}' && depth > 0 && --depth === 0 && start >= 0) {
      chunks.push(trimmed.slice(start, i + 1));
    }
  }
  for (let i = chunks.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(chunks[i]);
      if (parsed && typeof parsed === 'object' && 'status' in parsed) return parsed;
    } catch {
      /* try the previous one */
    }
  }
  return null;
}

function messageOf(json: any, status: number): string {
  const candidates = [json?.data?.message, json?.message, json?.data?.error, json?.error];
  const found = candidates.find((m) => typeof m === 'string' && m.trim());
  if (found) return found;
  if (status >= 500) return 'Pandascrow is having trouble right now. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

async function send(env: Env, method: string, path: string, opts: { query?: Query; body?: unknown; token?: string } = {}): Promise<any> {
  const url = new URL(apiBase(env) + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Device-Id': await deviceId(),
    'X-Pandascrow-Client': `chrome-extension/${VERSION}`,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url.toString(), { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch (err) {
    // Say which server failed, so a wrong or unreachable API host is easy to spot
    console.error('[Pandascrow] request failed', method, url.toString(), err);
    throw new ApiError(`Couldn't reach ${url.host}. Check your internet connection, or whether this server is up.`);
  }
  const json = parseBody(await res.text());
  if (!json) throw new ApiError(res.ok ? 'Pandascrow sent an answer we could not read.' : messageOf(null, res.status), res.status);
  if (res.status === 401 && json.session_revoked) throw new SessionEnded(messageOf(json, 401));
  const ok = json.status === true || json.status === 'true' || json.status === 'success';
  if (!res.ok || !ok) throw new ApiError(messageOf(json, res.status), res.status);
  return 'data' in json ? json.data : json;
}

// ─── session ────────────────────────────────────────────────────────────────

let refreshing: Promise<Session> | null = null;

/** Refresh the token when it has under 10 minutes left. */
export async function freshSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new SessionEnded('Please sign in.');
  const secondsLeft = session.expiresAt - Math.floor(Date.now() / 1000);
  if (secondsLeft > 600) return session;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const data = await send(session.env, 'POST', '/session/refresh', { token: session.token });
        const next: Session = { ...session, token: data.token, expiresAt: tokenExpiry(data.token) || Math.floor(Date.now() / 1000) + 3600 };
        await setSession(next);
        return next;
      } catch (err) {
        if (err instanceof SessionEnded || secondsLeft <= 0) {
          await clearSession();
          throw err instanceof SessionEnded ? err : new SessionEnded();
        }
        return session; // network blip: keep using the current token while it lasts
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

/** Call the API as the signed-in user. */
export async function api<T = any>(method: 'GET' | 'POST' | 'PUT', path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const session = await freshSession();
  try {
    return await send(session.env, method, path, { ...opts, token: session.token });
  } catch (err) {
    if (err instanceof SessionEnded) await clearSession();
    throw err;
  }
}

// ─── sign in ────────────────────────────────────────────────────────────────

export type LoginStep =
  | { kind: 'done'; session: Session }
  | { kind: 'email-code'; message: string }
  | { kind: 'authenticator'; twoFactorToken: string; message: string };

async function finish(env: Env, data: any): Promise<LoginStep> {
  if (data?.two_factor_required) return { kind: 'authenticator', twoFactorToken: data.two_factor_token, message: data.message ?? 'Enter the code from your authenticator app.' };
  if (data?.otp_required) return { kind: 'email-code', message: data.message ?? 'We sent a sign-in code to your email.' };
  if (!data?.token || !data?.user?.uuid) throw new ApiError('Sign-in did not complete. Please try again.');
  const u = data.user;
  const user: SessionUser = {
    uuid: u.uuid,
    name: u.name,
    email: u.email,
    user_type: u.user_type,
    is_verified: u.is_verified,
    compliance_status: data.compliance_status ?? u.compliance_status ?? null,
  };
  const session: Session = { env, token: data.token, expiresAt: tokenExpiry(data.token) || Math.floor(Date.now() / 1000) + 3600, user };
  await setSession(session);
  return { kind: 'done', session };
}

export async function login(env: Env, email: string, password: string): Promise<LoginStep> {
  return finish(env, await send(env, 'POST', '/login', { body: { email, password } }));
}

export async function loginWithEmailCode(env: Env, email: string, code: string): Promise<LoginStep> {
  return finish(env, await send(env, 'POST', '/login/otp', { body: { email, otp_code: code } }));
}

export async function loginWithAuthenticator(env: Env, twoFactorToken: string, code: string): Promise<LoginStep> {
  return finish(env, await send(env, 'POST', '/login/2fa', { body: { two_factor_token: twoFactorToken, code } }));
}

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await send(session.env, 'POST', '/session/logout', { token: session.token });
    } catch {
      /* signing out locally is what matters */
    }
  }
  await clearSession();
}
