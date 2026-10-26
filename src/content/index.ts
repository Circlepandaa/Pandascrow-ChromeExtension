import { extractListing, siteFor } from './extract';
import degularMedium from '@/assets/fonts/DegularDisplay-Medium.woff2?inline';
import degularBold from '@/assets/fonts/DegularDisplay-Bold.woff2?inline';

/**
 * On marketplace listings, show a "Pay safely with Pandascrow" button. Clicking it
 * sends the item details to the extension, which opens the escrow form prefilled.
 * Runs inside a shadow root so the page's styles can't break it (and ours can't break the page).
 */

const HOST_ID = 'pandascrow-escrow-button';
let lastUrl = '';
let dismissedFor = '';

const CSS = `
:host { all: initial; }
.wrap { position: fixed; right: 20px; bottom: 24px; z-index: 2147483646; display: flex; align-items: center; gap: 6px;
  font-family: "PandascrowDegular", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; animation: in .25s ease-out; }
@keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.btn { display: inline-flex; align-items: center; gap: 18px; padding: 14px 28px 14px 20px; border: 2px solid #5dae32; border-radius: 14px;
  background: #f9fff5; color: #000; font-family: inherit; text-align: left; cursor: pointer;
  box-shadow: 0 6px 20px rgba(93, 174, 50, .22); transition: background .15s, box-shadow .15s; }
.btn:hover { background: #effbe6; box-shadow: 0 8px 24px rgba(93, 174, 50, .3); }
.btn:focus-visible { outline: 3px solid rgba(93, 174, 50, .4); outline-offset: 2px; }
.badge { display: flex; flex: none; }
.text { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.small { font-size: 13px; font-weight: 500; line-height: 1.2; color: #000; }
.title { font-size: 20px; font-weight: 700; line-height: 1.15; color: #5dae32; }
.close { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #e4e4e4; background: #fff; color: #616161; cursor: pointer;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,.08); }
.close:hover { color: #1f1f1f; }
`;

const BADGE = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5dae32" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>`;
const CROSS = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

// Fonts declared inside a shadow root are ignored, so register the brand font
// with the page under a name the page won't use. Bundled as data URLs, so no
// extension files need to be exposed to the site.
let fontsLoaded = false;
function loadFonts(): void {
  if (fontsLoaded) return;
  fontsLoaded = true;
  try {
    for (const [src, weight] of [[degularMedium, '500'], [degularBold, '700']] as const) {
      const face = new FontFace('PandascrowDegular', `url(${src})`, { weight, display: 'swap' });
      document.fonts.add(face);
      void face.load().catch(() => undefined);
    }
  } catch {
    /* falls back to the system font */
  }
}

function remove(): void {
  document.getElementById(HOST_ID)?.remove();
}

function render(): void {
  remove();
  loadFonts();
  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="wrap">
      <button class="btn" type="button" aria-label="Pay safely with Pandascrow Escrow" title="Hold your payment in escrow until the item is delivered">
        <span class="badge">${BADGE}</span>
        <span class="text"><span class="small">pay safely with</span><span class="title">Pandascrow Escrow</span></span>
      </button>
      <button class="close" type="button" aria-label="Hide for this item">${CROSS}</button>
    </div>`;

  root.querySelector('.btn')!.addEventListener('click', () => {
    const listing = extractListing(document, new URL(location.href));
    if (!listing) return;
    chrome.runtime.sendMessage({ type: 'open-escrow', listing }).catch(() => undefined);
  });
  root.querySelector('.close')!.addEventListener('click', () => {
    dismissedFor = location.href;
    remove();
  });
  document.documentElement.appendChild(host);
}

async function enabled(): Promise<boolean> {
  try {
    const { settings } = await chrome.storage.local.get('settings');
    return (settings as { marketplaceButton?: boolean } | undefined)?.marketplaceButton !== false;
  } catch {
    return false; // extension was reloaded; this old script is orphaned
  }
}

async function check(): Promise<void> {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  const onListing = siteFor(new URL(location.href)) !== null;
  if (!onListing || dismissedFor === location.href || !(await enabled())) {
    remove();
    return;
  }
  // Single-page sites fill the page in after navigation; give them a moment
  setTimeout(() => {
    if (location.href === lastUrl && !document.getElementById(HOST_ID)) render();
  }, 600);
}

// These sites change pages without reloading, so watch the URL
void check();
setInterval(() => void check(), 1000);

try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      lastUrl = '';
      void check();
    }
  });
} catch {
  /* orphaned after an extension update */
}
