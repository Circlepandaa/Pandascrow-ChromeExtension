# Pandascrow for Chrome

Pandascrow in your browser toolbar, styled like the Pandascrow dashboard.

- **Account at a glance:** balances in every currency (available and held in escrow), recent escrows with their status, and your notifications.
- **Quick actions:** create an escrow, a payment link or an invoice from the popup, then copy or share the link.
- **Escrow on marketplaces:** on Facebook Marketplace, Jiji and Instagram listings, a "Pay safely with Pandascrow" button opens the escrow form with the item's title, price and link already filled in.
- **Alerts:** browser notifications and an unread badge when something happens on your account (payments, releases, disputes).

People sign in with their Pandascrow email and password, including the email code or authenticator step if they have one turned on. Nothing secret is built into the extension.

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
| `storage` | Keep you signed in and remember your settings |
| `alarms` | Check for new notifications every 2 minutes |
| `notifications` | Show alerts for payments, releases and disputes |
| Host access to `api.pandascrow.io`, `sandbox.pandascrow.io` | Talk to the Pandascrow API |
| Content script on Facebook Marketplace, Jiji, Instagram | Show the escrow button and read the listing's title and price when you click it |

## How it works

| Part | File | Job |
|---|---|---|
| Popup | `src/popup/` | React app: sign-in, home, escrows, create forms, alerts, account |
| Background worker | `src/background/index.ts` | Notification polling, badge, token refresh, opening the escrow form from a listing |
| Content script | `src/content/` | Finds listing pages, reads title/price/image, shows the button |
| API client | `src/lib/api.ts` | Calls the Pandascrow API with your session token and refreshes it before it expires |

### Sign-in and the API

The extension uses the API's session sign-in for device apps:

1. `POST /login` (then `/login/otp` or `/login/2fa` when asked) returns a token for a normal login session. The session shows up in the dashboard under Settings → Login sessions, and can be signed out there.
2. Requests send `Authorization: Bearer <token>`. The API only accepts this on the endpoints the extension needs, and always acts as the signed-in user, whatever `uuid` a request contains.
3. Tokens last an hour. The extension calls `POST /session/refresh` before they run out, and `POST /session/logout` when you sign out.

This needs the matching API change (`app/Helpers/SessionAuth.php`) deployed to the environment you sign in to.

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Type-check and build `dist/` for production |
| `npm run build:dev` | Unminified build with source maps and localhost access |
| `npm run dev` | Rebuild the popup and background on every change |
| `npm test` | Unit tests (listing extraction, API parsing, formatting) |
| `npm run zip` | Production build zipped for the Web Store |

Built with React 19, TypeScript, Tailwind CSS 4 and Vite, Manifest V3, Chrome 116+.
