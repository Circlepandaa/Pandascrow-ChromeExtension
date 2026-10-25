/**
 * Read an item's title, price, image and seller from a marketplace listing page.
 * Pure functions over a Document so they can be tested without a browser.
 */

export interface Listing {
  site: string;
  title: string;
  amount?: string;
  currency?: string;
  description?: string;
  image?: string;
  seller?: string;
  url: string;
}

export type Site = 'facebook' | 'jiji' | 'instagram';

/** Which marketplace this URL is a listing on, if any. */
export function siteFor(url: URL): Site | null {
  const host = url.hostname.replace(/^(www|web|m)\./, '');
  if (host === 'facebook.com' && /^\/marketplace\/item\/\d+/.test(url.pathname)) return 'facebook';
  if (host === 'jiji.ng' && /\.html$/.test(url.pathname)) return 'jiji';
  if (host === 'instagram.com' && /^\/(p|reel)\/[\w-]+/.test(url.pathname)) return 'instagram';
  return null;
}

export const SITE_NAMES: Record<Site, string> = { facebook: 'Facebook Marketplace', jiji: 'Jiji', instagram: 'Instagram' };

const CURRENCY_SIGNS: Array<[RegExp, string]> = [
  [/₦|\bNGN\b|\bN(?=\s?\d)/i, 'NGN'],
  [/\$|\bUSD\b/i, 'USD'],
  [/£|\bGBP\b/i, 'GBP'],
  [/€|\bEUR\b/i, 'EUR'],
  [/₵|\bGHS\b/i, 'GHS'],
  [/\bKES\b|KSh/i, 'KES'],
];

/** First price in a piece of text: "₦45,000", "NGN 45000", "$120", "45,000 naira". */
export function findPrice(text: string): { amount: string; currency: string } | undefined {
  const t = text.replace(/ /g, ' ');
  const patterns = [
    /(₦|NGN|N|\$|USD|£|GBP|€|EUR|₵|GHS|KES|KSh)\s?(\d{1,3}(?:[,\s]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d])/i,
    /(\d{1,3}(?:,\d{3})+|\d{3,})(?:\.\d{1,2})?\s?(naira|ngn)\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const [num, sign] = re === patterns[0] ? [m[2], m[1]] : [m[1], m[2]];
    const amount = Number(num.replace(/[,\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    // a bare "N" right before digits is too easy to misread inside words: require a word start
    if (sign === 'N' && !new RegExp(`(^|[^A-Za-z])N\\s?${num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) continue;
    const currency = CURRENCY_SIGNS.find(([r]) => r.test(sign))?.[1] ?? 'NGN';
    return { amount: String(amount), currency };
  }
  return undefined;
}

function meta(doc: Document, key: string): string | undefined {
  const el = doc.querySelector(`meta[property="${key}"], meta[name="${key}"]`);
  const v = el?.getAttribute('content')?.trim();
  return v || undefined;
}

function clean(text: string | null | undefined, max = 120): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

/** schema.org Product data, which Jiji and many shops embed. */
function jsonLdProduct(doc: Document): Record<string, any> | undefined {
  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const parsed = JSON.parse(s.textContent ?? '');
      const items = Array.isArray(parsed) ? parsed : parsed?.['@graph'] ?? [parsed];
      const product = items.find((i: any) => i && /Product|Offer|Vehicle|Car|IndividualProduct/i.test(String(i['@type'])));
      if (product) return product;
    } catch {
      /* not JSON */
    }
  }
  return undefined;
}

export function extractListing(doc: Document, url: URL): Listing | null {
  const site = siteFor(url);
  if (!site) return null;
  const listing: Listing = { site: SITE_NAMES[site], title: '', url: url.origin + url.pathname };

  const ogTitle = meta(doc, 'og:title');
  const ogDesc = meta(doc, 'og:description');
  listing.image = meta(doc, 'og:image');

  if (site === 'instagram') {
    // og:title: "Ada Stores on Instagram: "Brand new sneakers ₦45,000 …""
    const who = ogTitle?.match(/^(.+?) on Instagram/i)?.[1];
    const caption = ogTitle?.match(/on Instagram:\s*["“](.+)["”]?$/is)?.[1] ?? ogDesc?.match(/:\s*["“](.+)["”]?$/is)?.[1] ?? ogDesc ?? '';
    listing.seller = who ? clean(who, 60) : undefined;
    listing.title = clean(caption.split(/\n|\. /)[0], 80) || 'Instagram item';
    listing.description = clean(caption, 300);
    const price = findPrice(caption);
    if (price) Object.assign(listing, price);
    return listing;
  }

  const product = jsonLdProduct(doc);
  if (product) {
    listing.title = clean(product.name, 100);
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    const price = offer?.price ?? offer?.lowPrice;
    if (price && Number(price) > 0) {
      listing.amount = String(Number(price));
      listing.currency = String(offer?.priceCurrency || 'NGN').toUpperCase();
    }
    const img = Array.isArray(product.image) ? product.image[0] : product.image;
    if (typeof img === 'string') listing.image = img;
    else if (img?.url) listing.image = img.url;
    if (product.description) listing.description = clean(product.description, 300);
    const seller = offer?.seller?.name ?? product.brand?.name;
    if (seller) listing.seller = clean(seller, 60);
  }

  if (!listing.title) {
    const h1 = doc.querySelector('h1')?.textContent;
    listing.title = clean(h1 || ogTitle?.replace(/\s*[|–-]\s*(Facebook|Jiji).*$/i, '').replace(/^Marketplace\s*[–-]\s*/i, '') || doc.title.replace(/\s*[|–-]\s*(Facebook|Jiji).*$/i, ''), 100);
  }
  if (!listing.description && ogDesc) listing.description = clean(ogDesc, 300);

  if (!listing.amount) {
    // Look near the title first (Facebook shows the price right under it), then the whole page
    const h1 = doc.querySelector('h1');
    const near = h1?.parentElement?.parentElement?.textContent ?? '';
    const price = findPrice(near) ?? findPrice([ogTitle, ogDesc].filter(Boolean).join(' ')) ?? findPrice((doc.body?.innerText || doc.body?.textContent || '').slice(0, 5000));
    if (price) Object.assign(listing, price);
  }

  if (!listing.title) return null;
  return listing;
}
