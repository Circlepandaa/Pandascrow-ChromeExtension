# Pandascrow for Chrome

Pandascrow in your browser toolbar, styled like the Pandascrow dashboard.

- **Account at a glance:** balances in every currency (available and held in escrow), recent escrows with their status, and your notifications.
- **Quick actions:** create an escrow, a payment link or an invoice from the popup, then copy or share the link.
- **Escrow on marketplaces:** on Facebook Marketplace, Jiji and Instagram listings, a "Pay safely with Pandascrow" button opens the escrow form with the item's title, price and link already filled in.
- **Alerts:** browser notifications and an unread badge when something happens on your account (payments, releases, disputes).

People sign in with their own API key (Dashboard → Developers → API keys) plus their Pandascrow email and password, including the email code or authenticator step if they have one turned on. Nothing secret is built into the extension: each person's key is stored only in their own browser and removed when they sign out.

## Install for testing

```bash
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `dist` folder.
4. Pin Pandascrow from the puzzle-piece menu.

After changing code, run `npm run build` again and click the reload icon on the extension's card.

To try it against a local API, build with its address:

```bash
VITE_API_BASE=http://127.0.0.1:8000 VITE_DASHBOARD_BASE=http://localhost:3000 npm run build:dev
```

Development builds are named "Pandascrow (dev)" and may call `localhost`; production builds can only reach `api.pandascrow.io` and `sandbox.pandascrow.io`.

## Publish to the Chrome Web Store

```bash
npm run zip     # builds and writes pandascrow-extension.zip
```

Upload the zip in the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). For the listing you'll need a privacy policy URL, 1280×800 screenshots, and a short reason for each permission:

| Permission | Why |
|---|---|
| `storage` | Keep your API key, account and settings in this browser |
| `alarms` | Check for new notifications every 2 minutes |
| `notifications` | Show alerts for payments, releases and disputes |
| Host access to `api.pandascrow.io`, `sandbox.pandascrow.io` | Talk to the Pandascrow API |
| Content script on Facebook Marketplace, Jiji, Instagram | Show the escrow button and read the listing's title and price when you click it |

## How it works

| Part | File | Job |
|---|---|---|
| Popup | `src/popup/` | React app: sign-in, home, escrows, create forms, alerts, account |
| Background worker | `src/background/index.ts` | Notification polling, badge, opening the escrow form from a listing |
| Content script | `src/content/` | Finds listing pages, reads title/price/image, shows the button |
| API client | `src/lib/api.ts` | Calls the Pandascrow API with your API key (Token header) and account ID |

### Sign-in and the API

The extension calls the API the same way the SDKs and CLI do:

1. The API key for the chosen environment goes in the `Token` header of every request.
2. `POST /login` (then `/login/otp` or `/login/2fa` when asked) finds the user's account ID, which is sent as `uuid` on every call.
3. Before saving anything, the extension checks with `GET /application` that the key belongs to that same account.
4. A rejected key (HTTP 401), or a device signed out from the dashboard, signs the extension out.

Live and sandbox keys are different: pick the environment on the sign-in screen and paste that environment's key.

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Type-check and build `dist/` for production |
| `npm run build:dev` | Unminified build with source maps and localhost access |
| `npm run dev` | Rebuild the popup and background on every change |
| `npm test` | Unit tests (listing extraction, API parsing, formatting) |
| `npm run zip` | Production build zipped for the Web Store |

Built with React 19, TypeScript, Tailwind CSS 4 and Vite, Manifest V3, Chrome 116+.
