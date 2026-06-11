# CLAUDE.md — Dixit Telegram Bot

> This file is the project bible. Read it fully at the start of every session.
> Never modify this file unless explicitly asked. For task progress, see `TASKS.md`.

---

## 🎯 Project Goal

Build a full **Dixit card game** as a Telegram Bot for learning **AI Test Automation Engineering**.
Every feature must ship with tests. Tests are not optional — they are part of the definition of done.

---

## 🧱 Tech Stack

| Concern | Tool |
|---|---|
| Language | TypeScript |
| Bot framework | grammY |
| Hosting | Google Apps Script (serverless, free) |
| Database | Google Sheets (all persistent state) |
| Bundler | esbuild |
| GAS CLI | clasp |
| Unit & Integration tests | Vitest |
| API mocking | msw (Mock Service Worker) |
| E2E tests | Playwright |
| Performance tests | k6 |
| CI/CD | GitHub Actions (free tier) |
| i18n | Custom `t()` function, `fa` + `en` |

**Base template**: https://github.com/TheMn/sheetgram-template

---

## 🎮 Full Dixit Rules

1. 3–6 players per game (Telegram group or simulated in private)
2. Each player holds **6 cards** (images)
3. Each round:
   - **Storyteller** picks a card → sends a clue (text/emoji)
   - **Other players** each submit one card from their hand that fits the clue
   - All submitted cards (including storyteller's) are **shuffled and displayed**
   - **Players vote** on which card is the storyteller's (cannot vote own card)
   - **Scoring**:
     - ALL or NONE guess storyteller's card → storyteller gets **0**, others get **2**
     - Otherwise → storyteller + correct guessers get **3** each
     - Every player whose non-storyteller card got voted on gets **+1 per vote**
   - All players draw a card to refill hand to 6
   - Next player becomes storyteller
4. Game ends when deck runs out or a player hits **30 points**
5. Winner announced; leaderboard updated in Google Sheets

---

## 🗂️ Google Sheets Schema

| Sheet | Columns |
|---|---|
| **Games** | game_id, chat_id, status, current_round, storyteller_id, created_at |
| **Players** | game_id, user_id, username, hand (JSON), score, lang |
| **Rounds** | round_id, game_id, round_num, clue, storyteller_card, submissions (JSON), votes (JSON), status |
| **Cards** | card_id, file_id (Telegram), drive_url, in_use |
| **Leaderboard** | user_id, username, total_games, total_wins, total_score, last_played |
| **Logs** | timestamp, level, message, context (JSON) |

---

## 📁 Final Project Structure

```
dixit-bot/
├── src/
│   ├── main.ts
│   ├── commands.ts
│   ├── game/
│   │   ├── engine.ts        # Pure functions only — no side effects
│   │   ├── state.ts
│   │   ├── scoring.ts       # Pure functions only — no side effects
│   │   └── rounds.ts
│   ├── sheets/
│   │   ├── client.ts        # Abstracts SpreadsheetApp behind an interface
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
│   └── vars.ts
├── tests/
│   ├── unit/
│   │   ├── game/
│   │   │   ├── engine.test.ts
│   │   │   ├── scoring.test.ts
│   │   │   └── rounds.test.ts
│   │   ├── i18n/
│   │   │   └── translations.test.ts
│   │   └── helpers.test.ts
│   ├── integration/
│   │   ├── sheets/
│   │   │   ├── games.integration.test.ts
│   │   │   └── players.integration.test.ts
│   │   └── game-flow.integration.test.ts
│   ├── api/
│   │   ├── mocks/
│   │   │   └── telegram.mock.ts
│   │   ├── commands.api.test.ts
│   │   └── voting.api.test.ts
│   ├── e2e/
│   │   ├── fixtures/
│   │   ├── pages/           # Page Object Models
│   │   ├── full-game.spec.ts
│   │   └── leaderboard.spec.ts
│   └── performance/
│       ├── voting-load.js
│       └── game-creation.js
├── scripts/
│   └── deploy.sh
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── dist/
│   └── appsscript.json
├── vitest.config.ts
├── playwright.config.ts
├── .clasp.json
├── package.json
├── tsconfig.json
├── CLAUDE.md               ← you are here
├── TASKS.md                ← task tracker
└── README.md
```

---

## ⚙️ Non-Negotiable Implementation Rules

### 1. Tests ship WITH the feature
A task is NOT done until its tests pass. Never say "we'll add tests later."

### 2. Pure functions first
`engine.ts` and `scoring.ts` must have **zero side effects** — no Sheets calls, no Telegram calls.
This is what makes unit testing fast and reliable.

### 3. Always abstract GAS APIs
`SpreadsheetApp`, `UrlFetchApp`, etc. do not exist in Node.js.
Always put them behind an interface in `sheets/client.ts` so they can be mocked in tests.

```typescript
// ✅ Good — testable
interface SheetsClient {
  getRange(sheet: string, row: number, col: number): string;
}

// ❌ Bad — untestable in Node.js
SpreadsheetApp.openById(id).getSheetByName("Games").getRange(...)
```

### 4. Mocking strategy by test type

| Test type | Telegram API | Google Sheets | Game logic |
|---|---|---|---|
| Unit | mocked | mocked | real |
| Integration | mocked | real (test sheet) | real |
| API | msw (network level) | mocked | real |
| E2E | real (test bot token) | real (test sheet) | real |
| Performance | real or stub | real or stub | real |

### 5. Test naming — describe behavior, not implementation

```typescript
// ✅ Good
it("should give 0 points to storyteller when all players guess correctly")

// ❌ Bad
it("tests the scoring function with allCorrect=true")
```

### 6. i18n — all user-facing strings go through `t()`
Never hardcode strings in commands/messages. Always:
```typescript
await ctx.reply(t("game.round.start", user.lang, { round: 3 }));
```

### 7. One task at a time
Complete → test → confirm → move on. See `TASKS.md` for current status.

---

## 🔐 Required Secrets (GitHub Actions + local `.env`)

```
TELEGRAM_BOT_TOKEN=       # main bot token
TELEGRAM_TEST_BOT_TOKEN=  # separate bot for E2E tests
SPREADSHEET_ID=           # main Google Sheet ID
TEST_SPREADSHEET_ID=      # separate sheet for integration/E2E tests
WEBAPP_URL=               # deployed GAS web app URL
CLASPRC_JSON=             # clasp auth JSON (for CI deploy)
```

---

## 🚦 How to Run Tests Locally

```bash
yarn test:unit          # Vitest unit tests
yarn test:integration   # Vitest integration tests (needs TEST_SPREADSHEET_ID)
yarn test:api           # Vitest API tests with msw
yarn test:e2e           # Playwright E2E (needs TELEGRAM_TEST_BOT_TOKEN)
yarn test:perf          # k6 performance tests
yarn test               # all of the above
```

---

## 📌 Session Protocol

When starting a new session:
1. Read `CLAUDE.md` (this file) fully
2. Read `TASKS.md` and identify the current task
3. Read `LESSONS.md` — it contains hard-won lessons from past sessions (architectural traps, grammY quirks, confirmed patterns). Apply them throughout the session.
4. State out loud: "I am working on Task N: [title]. It is currently [status]."
5. Do not start a new task until the current one is marked ✅ Done in `TASKS.md`
6. After completing a task, update `TASKS.md` status before stopping
