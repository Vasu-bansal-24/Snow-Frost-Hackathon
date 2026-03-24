hehe
# Consent Tracker (Snow Frost Hackathon)

Consent Tracker is a Chrome extension that logs user consent interactions (cookie prompts, newsletter signups, browser permission grants, etc.), categorizes them, and presents them in a searchable dashboard.

It also supports daily batch anchoring with Merkle roots for tamper-evident proof trails, and includes an optional Gemini-powered AI chatbot widget.

## What it does

- Detects consent-like clicks and form submissions directly on visited pages
- Tracks browser permission grants (geolocation, notifications, camera, microphone)
- Categorizes events (cookies, newsletter, email, account, terms, marketing, etc.)
- Stores consent logs locally in extension storage
- Shows popup metrics (total consents, today count, unique sites, risk level)
- Provides a full dashboard with filtering, search, export, and retention controls
- Anchors daily consent batches using Merkle roots (simulated mode by default)

## How it works

1. `content.js` monitors page interactions and classifies consent events.
2. `inject.js` is injected into page context to intercept browser permission APIs.
3. Events are sent to `background.js` and saved to `chrome.storage.local`.
4. `blockchain.js` hashes consent data, batches events by UTC day, builds a Merkle tree, and anchors batch metadata.
5. `popup.html` / `popup.js` shows quick stats; `dashboard.html` / `dashboard.js` provides deep analysis and controls.

## Project structure

- `manifest.json` — Extension manifest (MV3)
- `background.js` — Service worker, consent storage, batch anchoring orchestration
- `content.js` — Consent detection and logging from page interactions
- `inject.js` — Browser permission interception (runs in page context)
- `blockchain.js` — Batch hashing, Merkle root anchoring, verification helpers
- `lib/merkleTree.js` — Local Merkle tree/proof utilities
- `dashboard.html`, `dashboard.js`, `dashboard.css` — Main UI and analytics
- `popup.html`, `popup.js` — Toolbar popup summary
- `options.html`, `options.js` — Gemini API settings for chatbot
- `chatbot-widget.js`, `chatbot-widget.css`, `chatbot-widget.html` — AI assistant widget
- `contracts/ConsentAnchor.sol` — Solidity contract for batch anchor storage

## Installation (Chrome)

1. Clone the repository:

```bash
git clone https://github.com/Vasu-bansal-24/Snow-Frost-Hackathon.git
cd Snow-Frost-Hackathon
```

2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this project folder.
5. Pin **Consent Tracker** from the extension toolbar (optional but recommended).

## Usage

### 1) Track consent activity

- Browse websites normally.
- When you click consent-like actions (accept/allow/agree/subscribe/etc.), they are logged automatically.
- You will see on-page feedback when a consent is captured.

### 2) Check quick stats in popup

- Click the extension icon to view:
  - Total consents
  - Unique sites
  - Today’s consents
  - Privacy risk indicator
  - Recent activity

### 3) Use dashboard for full history

- Open dashboard from popup.
- Filter by category/date, search by domain/content, and inspect detailed records.
- Export data as JSON or CSV.
- Clear history when needed.

### 4) Blockchain batch anchoring

- Use **Anchor Today’s Batch** in the dashboard blockchain panel.
- Each anchored batch stores:
  - Merkle root
  - Storage pointer hash
  - Day timestamp
  - Batch size
  - Tx hash / block metadata

> Note: The extension currently runs in **simulated blockchain mode** by default (`blockchain.js`). Real-chain anchoring requires additional wallet/provider wiring and deployed contract configuration.

### 5) Optional AI chatbot

- Open extension options page.
- Add your Gemini API key and model settings.
- Visit any site and use the floating chat button (`💬`).

## Data and privacy

- Consent logs are stored in `chrome.storage.local`.
- Chatbot settings are stored in `chrome.storage.sync`.
- No backend server is included in this repository for consent log ingestion.
- Chatbot requests are sent to Google Generative Language API only when you use the chatbot and provide an API key.

## Permissions used

- `storage` — Persist consent logs/settings
- `activeTab`, `tabs` — Open dashboard/options and interact with current tab context
- `alarms` — Trigger scheduled daily batch anchoring checks
- `host_permissions: <all_urls>` — Monitor consent interactions across sites

## Smart contract

`contracts/ConsentAnchor.sol` implements:

- Batch anchoring by Merkle root
- Batch lookup by user/day
- Anchor existence checks
- Signature-based anchor flow (`anchorBatchWithSignature`)

Deploy this contract separately if you want true on-chain anchoring.

## Current limitations

- Keyword-based detection can miss custom/non-standard consent UX flows.
- Real on-chain mode is not fully wired in extension runtime by default.
- No automated test suite is included yet.

## Team

- Vasu Bansal — https://github.com/Vasu-bansal-24
- Yash Gawali — https://github.com/Dueyash

Built for Snow Frost Hackathon.
