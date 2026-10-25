import type { Env } from './env';

export interface SessionUser {
  uuid: string;
  name?: string;
  email?: string;
  user_type?: string;
  is_verified?: boolean;
  compliance_status?: string | null;
}

/**
 * What we keep after sign-in: the environment, that environment's API key (sent as
 * the Token header) and the account it belongs to. Stored only in this browser.
 */
export interface Session {
  env: Env;
  apiKey: string;
  user: SessionUser;
}

export interface Settings {
  alerts: boolean;
  /** Show the escrow button on marketplace pages. */
  marketplaceButton: boolean;
  lastEnv: Env;
}

/** Item details picked up from a marketplace page, waiting for the escrow form. */
export interface ListingDraft {
  title: string;
  amount?: string;
  currency?: string;
  description?: string;
  url: string;
  image?: string;
  site: string;
  seller?: string;
  createdAt: number;
}

const DEFAULT_SETTINGS: Settings = { alerts: true, marketplaceButton: true, lastEnv: 'live' };

function local(): chrome.storage.LocalStorageArea {
  return chrome.storage.local;
}

export async function getSession(): Promise<Session | null> {
  const { session } = await local().get('session');
  const s = session as Session | undefined;
  // sessions saved by older builds have no API key: sign in again
  return s && s.apiKey && s.user?.uuid ? s : null;
}

export async function setSession(session: Session): Promise<void> {
  await local().set({ session });
}

export async function clearSession(): Promise<void> {
  await local().remove(['session', 'lastNotificationId', 'unreadCount']);
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await local().get('settings');
  return { ...DEFAULT_SETTINGS, ...((settings as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await local().set({ settings: next });
  return next;
}

/** A random ID for this browser, so the dashboard's "Login sessions" shows it as one device. */
export async function deviceId(): Promise<string> {
  const { deviceId: existing } = await local().get('deviceId');
  if (typeof existing === 'string' && existing) return existing;
  const id = 'chrome-ext-' + crypto.randomUUID();
  await local().set({ deviceId: id });
  return id;
}

export async function setDraft(draft: ListingDraft): Promise<void> {
  await chrome.storage.session.set({ draft });
}

/** Take the waiting marketplace draft (once). Drafts older than 30 minutes are dropped. */
export async function takeDraft(): Promise<ListingDraft | null> {
  const { draft } = await chrome.storage.session.get('draft');
  if (!draft) return null;
  await chrome.storage.session.remove('draft');
  const d = draft as ListingDraft;
  return Date.now() - d.createdAt < 30 * 60 * 1000 ? d : null;
}
