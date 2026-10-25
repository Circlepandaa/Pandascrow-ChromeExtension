const SYMBOLS: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: '₵', KES: 'KSh ', ZAR: 'R', CAD: 'C$' };

/** "350000.00", "NGN" → "₦350,000.00". Accepts "1,000.00" strings too. */
export function money(amount: unknown, currency = 'NGN', opts: { decimals?: boolean } = {}): string {
  const n = Number(String(amount ?? '').replace(/,/g, ''));
  const cur = String(currency || '').toUpperCase();
  if (!Number.isFinite(n)) return `${SYMBOLS[cur] ?? ''}${amount ?? ''}`;
  const digits = opts.decimals === false ? 0 : 2;
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return SYMBOLS[cur] ? `${SYMBOLS[cur]}${formatted}` : `${formatted} ${cur}`;
}

/** "2026-10-25 03:56:21" → "25 Oct 2026". */
export function shortDate(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  const d = new Date(/\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "2 min ago", "3 h ago", "Yesterday", or a date. */
export function timeAgo(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  const d = new Date(/\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') : s);
  if (Number.isNaN(d.getTime())) return s;
  const secs = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'Just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} h ago`;
  if (secs < 172800) return 'Yesterday';
  return shortDate(value);
}

export function initials(name?: string): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'P';
}

export function firstName(name?: string): string {
  return String(name ?? '').trim().split(/\s+/)[0] || 'there';
}

/** "₦45,000", "NGN 45000", "45,000 naira" → "45000". */
export function parseAmount(text: string): string | undefined {
  const m = text.replace(/\s+/g, ' ').match(/(?:₦|NGN|N)\s?([\d][\d,]*(?:\.\d{1,2})?)|([\d][\d,]*(?:\.\d{1,2})?)\s?(?:naira|NGN)/i);
  const raw = m?.[1] ?? m?.[2];
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? String(n) : undefined;
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
