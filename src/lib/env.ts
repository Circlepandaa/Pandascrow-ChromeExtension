export type Env = 'live' | 'sandbox';

const API: Record<Env, string> = {
  live: 'https://api.pandascrow.io',
  sandbox: 'https://sandbox.pandascrow.io',
};

const DASHBOARD: Record<Env, string> = {
  live: 'https://app.pandascrow.io',
  sandbox: 'https://demo.pandascrow.io',
};

/** Development builds can point at a local API with VITE_API_BASE. */
const override = (import.meta.env?.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '');

export function apiBase(env: Env): string {
  return override || API[env];
}

export function dashboardUrl(env: Env, path = '/'): string {
  const base = (import.meta.env?.VITE_DASHBOARD_BASE as string | undefined)?.replace(/\/+$/, '') || DASHBOARD[env];
  return base + path;
}

export const VERSION: string = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.().version) || '0.0.0';
