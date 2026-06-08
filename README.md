# Dixit Telegram Bot

A full [Dixit](https://en.wikipedia.org/wiki/Dixit_(card_game)) card game playable in Telegram groups, built on Google Apps Script and Google Sheets — no server required.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| Yarn | 1.x | `npm install -g yarn` |
| clasp | latest | `npm install -g @google/clasp` |
| k6 | latest | [k6.io/docs/get-started/installation](https://k6.io/docs/get-started/installation) (only for performance tests) |

You also need:
- A **Telegram Bot Token** — create one via [@BotFather](https://t.me/BotFather)
- A **Google Account** with Google Apps Script enabled
- Two **Google Sheets** — one for production, one for tests

---

## 1. Initial Setup

```bash
# Clone the repo
git clone <repo-url>
cd dixit-bot

# Install dependencies
yarn install --ignore-engines
```

> `--ignore-engines` is required because msw ships a CLI tool that needs Node ≥ 20.
> The msw runtime used in tests works fine on Node 18.

---

## 2. Environment Variables

### Local development & tests — `.env`

Copy the example and fill in your values:

```bash
cp .env.example .env
```

`.env` contents:

```env
TELEGRAM_BOT_TOKEN=123456789:AABBCCDDEEFFaabbccddeeff
TELEGRAM_TEST_BOT_TOKEN=987654321:ZZYYXXWWVVUUzzyyxxwwvvuu
SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
TEST_SPREADSHEET_ID=1another_sheet_id_for_tests
WEBAPP_URL=https://script.google.com/macros/s/<deployment-id>/exec
```

> `.env` is gitignored. Never commit it.

### In production (Google Apps Script)

Secrets live in **Script Properties**, not `.env`. Set them once after first deploy:

1. Open [script.google.com](https://script.google.com)
2. Open your project → **Project Settings** → **Script Properties**
3. Add each key from the table above (same names, same values — except `TEST_*` keys which are not needed in production)

`src/vars.ts` detects the runtime automatically:
- **In GAS**: reads from `PropertiesService.getScriptProperties()`
- **In Node.js**: reads from `process.env` (populated by dotenv)

---

## 3. Running Tests Locally

```bash
# Unit tests only (pure logic, no external deps)
yarn test:unit

# Integration tests (requires TEST_SPREADSHEET_ID in .env)
yarn test:integration

# API tests (msw mocks Telegram network layer)
yarn test:api

# E2E tests (requires TELEGRAM_TEST_BOT_TOKEN + a running GAS deploy)
yarn test:e2e

# Performance tests (requires k6 installed)
yarn test:perf

# Run unit + integration + api together
yarn test
```

---

## 4. First Deployment to Google Apps Script

### Step 1 — Log in to clasp

```bash
clasp login
```

This opens a browser to authenticate your Google account.

### Step 2 — Create a new GAS project

```bash
clasp create --type webapp --title "Dixit Bot" --rootDir dist
```

This creates a new script and writes the script ID to `.clasp.json`.

> If you already have a script ID (e.g. from a team member), skip this and manually update `.clasp.json`:
> ```json
> { "scriptId": "YOUR_SCRIPT_ID", "rootDir": "dist" }
> ```

### Step 3 — Build and push

```bash
yarn build       # compiles TypeScript → dist/index.js
clasp push       # uploads dist/ to GAS
```

### Step 4 — Deploy as a Web App

```bash
clasp deploy --description "v1"
```

Copy the deployment URL from the output — it looks like:
```
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

This is your `WEBAPP_URL`. Add it to:
- Script Properties (for production)
- `.env` (for local reference)

---

## 5. Setting the Webhook

After deploying, register the webhook so Telegram forwards updates to your bot:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEBAPP_URL>"
```

Example:
```bash
curl "https://api.telegram.org/bot123456:ABC/setWebhook?url=https://script.google.com/macros/s/XYZ/exec"
```

Expected response:
```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

To verify:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

> The bot can also set the webhook itself. In GAS, open the script editor and run `setWebhook()` manually once from the **Run** menu.

---

## 6. Subsequent Deployments

After the first deploy, use the deploy script which reuses the existing deployment ID:

```bash
yarn deploy
```

This runs: `yarn build` → `clasp push` → `clasp deploy -i <existing-id>`

> Re-deploying does **not** change the webhook URL — the `/exec` URL stays the same across redeploys.

---

## 7. Google Sheets Setup

Create two Google Sheets (production + test) with these tabs:

| Tab name | Columns |
|---|---|
| Games | game_id, chat_id, status, current_round, storyteller_id, created_at |
| Players | game_id, user_id, username, hand (JSON), score, lang |
| Rounds | round_id, game_id, round_num, clue, storyteller_card, submissions (JSON), votes (JSON), status |
| Cards | card_id, file_id (Telegram), drive_url, in_use |
| Leaderboard | user_id, username, total_games, total_wins, total_score, last_played |
| Logs | timestamp, level, message, context (JSON) |

Add the first row as a header row. The bot reads/writes all rows below it.

---

## 8. Project Structure

```
dixit-bot/
├── src/
│   ├── main.ts              # GAS entry point (doPost, setWebhook)
│   ├── commands.ts          # Bot command handlers
│   ├── game/
│   │   ├── engine.ts        # Pure functions — game lifecycle
│   │   ├── state.ts         # GameState types and guards
│   │   ├── scoring.ts       # Pure functions — score calculation
│   │   └── rounds.ts        # Round state machine
│   ├── sheets/
│   │   ├── client.ts        # ISheetsClient interface + GAS/Mock implementations
│   │   ├── games.ts
│   │   ├── players.ts
│   │   ├── rounds.ts
│   │   ├── cards.ts
│   │   └── leaderboard.ts
│   ├── telegram/
│   │   ├── api.ts
│   │   ├── keyboards.ts
│   │   └── messages.ts
│   ├── i18n/
│   │   ├── index.ts         # t(key, lang, params?) function
│   │   ├── fa.ts
│   │   └── en.ts
│   ├── helpers.ts
│   └── vars.ts              # Runtime-aware config (GAS vs Node.js)
├── tests/
│   ├── unit/                # Vitest — pure logic, no I/O
│   ├── integration/         # Vitest — real test sheet
│   ├── api/                 # Vitest + msw — mocked Telegram API
│   ├── e2e/                 # Playwright — real bot + real sheet
│   └── performance/         # k6 scripts
├── dist/
│   └── appsscript.json      # GAS manifest (pushed alongside index.js)
├── scripts/
│   └── deploy.sh
├── vitest.config.ts
├── vitest.workspace.ts      # Separate unit / integration / api workspaces
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

---

## 9. How It Works

```
Telegram user
     │  sends message
     ▼
Telegram servers
     │  POST update to webhook URL
     ▼
Google Apps Script (doPost)
     │  parses Update
     ▼
commands.ts / game engine
     │  reads/writes state
     ▼
Google Sheets (via sheets/client.ts)
     │  persists everything
     ▼
Telegram API (sendMessage, sendPhoto, etc.)
     │  replies to user
     ▼
Telegram user
```

All game state lives in Google Sheets. GAS is stateless — each webhook call is independent.
