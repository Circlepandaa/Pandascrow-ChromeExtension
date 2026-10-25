import { extractListing, siteFor } from './extract';

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
  font-family: "degulardisplay", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; animation: in .25s ease-out; }
@keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.btn { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 18px 0 8px; border: 0; border-radius: 999px;
  background: #182cd1; color: #fff; font: 500 15px/1 inherit; font-family: inherit; cursor: pointer;
  box-shadow: 0 6px 20px rgba(24, 44, 209, .35); }
.btn:hover { background: #1426b8; }
.btn:focus-visible { outline: 3px solid rgba(24, 44, 209, .35); outline-offset: 2px; }
.logo { width: 32px; height: 32px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; }
.text { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.small { font-size: 11px; opacity: .8; font-weight: 400; }
.close { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #e4e4e4; background: #fff; color: #616161; cursor: pointer;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,.08); }
.close:hover { color: #1f1f1f; }
`;

const SHIELD = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#182cd1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>`;
const CROSS = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function remove(): void {
  document.getElementById(HOST_ID)?.remove();
}

function render(): void {
  remove();
  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="wrap">
      <button class="btn" type="button" title="Hold your payment in escrow until the item is delivered">
        <span class="logo">${SHIELD}</span>
        <span class="text">Pay safely with Pandascrow<span class="small">Escrow: the seller is paid after delivery</span></span>
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
