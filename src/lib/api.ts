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

/** The key was rejected or the device was signed out. The UI goes back to sign-in. */
export class SessionEnded extends ApiError {
  constructor(message = 'Your session has ended. Please sign in again.') {
    super(message, 401);
    this.name = 'SessionEnded';
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

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

interface SendOptions {
  query?: Query;
  body?: unknown;
  /** API key for this environment, sent as the Token header. */
  apiKey: string;
}

async function send(env: Env, method: string, path: string, opts: SendOptions): Promise<any> {
  const url = new URL(apiBase(env) + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Token: opts.apiKey,
    'X-Device-Id': await deviceId(),
    'X-Pandascrow-Client': `chrome-extension/${VERSION}`,
  };
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
  // 401: the key was rejected or revoked, or this device was signed out in the dashboard
  if (res.status === 401) throw new SessionEnded(messageOf(json, 401));
  const ok = json.status === true || json.status === 'true' || json.status === 'success';
  if (!res.ok || !ok) throw new ApiError(messageOf(json, res.status), res.status);
  return 'data' in json ? json.data : json;
}

// ─── signed-in calls ────────────────────────────────────────────────────────

/** The saved session, or SessionEnded when nobody is signed in. */
export async function freshSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new SessionEnded('Please sign in.');
  return session;
}

/**
 * Call the API as the signed-in user: the API key goes in the Token header and
 * the user's uuid is added to the query (GET) or body (POST/PUT), as the API expects.
 */
export async function api<T = any>(method: 'GET' | 'POST' | 'PUT', path: string, opts: { query?: Query; body?: Record<string, unknown> } = {}): Promise<T> {
  const session = await freshSession();
  const uuid = session.user.uuid;
  const query = method === 'GET' ? { ...(opts.query ?? {}), uuid } : opts.query;
  let body: Record<string, unknown> | undefined;
  if (method !== 'GET') {
    body = { ...(opts.body ?? {}), uuid };
    // Fields that name the acting user always mean the signed-in user
    if ('owner_uuid' in body) body.owner_uuid = uuid;
    if ('escrow_type' in body) body.initiator_id = uuid;
  }
  try {
    return await send(session.env, method, path, { query, body, apiKey: session.apiKey });
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

export interface Credentials {
  env: Env;
  apiKey: string;
}

/** The key must belong to the account that signed in, or every call would act on someone else's application. */
async function checkKey(creds: Credentials, uuid: string): Promise<void> {
  let app: any;
  try {
    const res = await send(creds.env, 'GET', '/application', { query: { uuid }, apiKey: creds.apiKey });
    app = res.application;
  } catch (err) {
    if (err instanceof SessionEnded) throw new ApiError(`Pandascrow rejected this API key: ${err.message}`);
    throw new ApiError("Couldn't confirm this API key belongs to your account. Copy it from Developers → API keys while signed in to the same account.");
  }
  if (!app || app.public_key !== creds.apiKey) {
    throw new ApiError(`This API key belongs to a different account. Copy your ${creds.env} key from Developers → API keys.`);
  }
}

async function finish(creds: Credentials, data: any): Promise<LoginStep> {
  if (data?.two_factor_required) return { kind: 'authenticator', twoFactorToken: data.two_factor_token, message: data.message ?? 'Enter the code from your authenticator app.' };
  if (data?.otp_required) return { kind: 'email-code', message: data.message ?? 'We sent a sign-in code to your email.' };
  if (!data?.user?.uuid) throw new ApiError('Sign-in did not complete. Please try again.');
  const u = data.user;
  await checkKey(creds, u.uuid);
  const user: SessionUser = {
    uuid: u.uuid,
    name: u.name,
    email: u.email,
    user_type: u.user_type,
    is_verified: u.is_verified,
    compliance_status: data.compliance_status ?? u.compliance_status ?? null,
  };
  const session: Session = { env: creds.env, apiKey: creds.apiKey, user };
  await setSession(session);
  return { kind: 'done', session };
}

/** A login error worded for a key problem when the key is what failed. */
function keyError(err: unknown): never {
  if (err instanceof SessionEnded) throw new ApiError(`Pandascrow rejected this API key (${err.message}). Check you copied the right key for this account type.`);
  throw err;
}

export async function login(creds: Credentials, email: string, password: string): Promise<LoginStep> {
  const data = await send(creds.env, 'POST', '/login', { body: { email, password }, apiKey: creds.apiKey }).catch(keyError);
  return finish(creds, data);
}

export async function loginWithEmailCode(creds: Credentials, email: string, code: string): Promise<LoginStep> {
  const data = await send(creds.env, 'POST', '/login/otp', { body: { email, otp_code: code }, apiKey: creds.apiKey }).catch(keyError);
  return finish(creds, data);
}

export async function loginWithAuthenticator(creds: Credentials, twoFactorToken: string, code: string): Promise<LoginStep> {
  const data = await send(creds.env, 'POST', '/login/2fa', { body: { two_factor_token: twoFactorToken, code }, apiKey: creds.apiKey }).catch(keyError);
  return finish(creds, data);
}

/** Sign out of the extension (the saved key and account are removed from this browser). */
export async function logout(): Promise<void> {
  await clearSession();
}
