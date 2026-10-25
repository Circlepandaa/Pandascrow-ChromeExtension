import pkg from './package.json' with { type: 'json' };

const icons = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
};

/** Pages where the "Pay safely with Pandascrow" button appears. */
export const MARKETPLACE_MATCHES = [
  'https://www.facebook.com/marketplace/*',
  'https://web.facebook.com/marketplace/*',
  'https://m.facebook.com/marketplace/*',
  'https://jiji.ng/*',
  'https://www.instagram.com/*',
];

/**
 * Chrome extension manifest (MV3). Development builds may also call a local API
 * (VITE_API_BASE), so they get permission for localhost too.
 */
export function manifest(mode: string) {
  const dev = mode === 'development';
  return {
    manifest_version: 3,
    name: dev ? 'Pandascrow (dev)' : 'Pandascrow',
    short_name: 'Pandascrow',
    version: pkg.version,
    description: 'Check balances and escrows, create payment links and invoices, get alerts, and pay safely through escrow on online marketplaces.',
    homepage_url: 'https://pandascrow.io',
    minimum_chrome_version: '116',
    icons,
    action: { default_popup: 'popup.html', default_title: 'Pandascrow', default_icon: icons },
    background: { service_worker: 'background.js', type: 'module' },
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: [
      'https://api.pandascrow.io/*',
      'https://sandbox.pandascrow.io/*',
      ...(dev ? ['http://localhost/*', 'http://127.0.0.1/*'] : []),
    ],
    content_scripts: [{ matches: MARKETPLACE_MATCHES, js: ['content.js'], run_at: 'document_idle' }],
  };
}
