# TASKS.md — Dixit Bot Task Tracker

> **How to use this file:**
> - Statuses: `⬜ Todo` → `🔄 In Progress` → `✅ Done`
> - Update status at the START and END of each task
> - Never skip a task. Never mark done without passing tests.
> - One task active at a time.

---

## Current Task: → Task 3

---

## PHASE 1 — Project Foundation

### Task 1 — Project Scaffold & Test Runner Setup
**Status**: ✅ Done
**Type**: Setup
**Tests**: Unit (smoke)

**What to do:**
1. Clone `https://github.com/TheMn/sheetgram-template` as the base
2. Rename and restructure into the folder layout defined in `CLAUDE.md`
3. Install dependencies:
   - `vitest` — unit/integration/API test runner
   - `@vitest/coverage-v8` — coverage reports
   - `msw` — Telegram API mocking at network level
   - `playwright` + `@playwright/test` — E2E tests
   - `dotenv` — local env vars
4. Configure `vitest.config.ts` with separate workspaces for unit/integration/api
5. Configure `playwright.config.ts`
6. Add all test scripts to `package.json`
7. Write one smoke test: `tests/unit/smoke.test.ts` that asserts `1 + 1 === 2`

**Done when:** `yarn test:unit` runs and shows 1 passing test.

---

### Task 2 — i18n System
**Status**: ✅ Done
**Type**: Feature + Unit Tests
**Tests**: Unit

**What to do:**
1. Create `src/i18n/en.ts` and `src/i18n/fa.ts` with all game message keys
2. Create `src/i18n/index.ts` with the `t(key, lang, params?)` function
3. Handle: missing keys (fallback to key name), param interpolation `{{name}}`, both langs

**Test cases to cover:**
- Returns correct string for `en` and `fa`
- Interpolates `{{params}}` correctly
- Falls back gracefully when key doesn't exist
- Handles missing params without crashing
- Persian strings are RTL-safe (contain correct characters)

**Done when:** `yarn test:unit` passes all i18n tests.

---

### Task 3 — Google Sheets Client Abstraction
**Status**: ✅ Done
**Type**: Feature + Unit + Integration Tests
**Tests**: Unit (mocked), Integration (real test sheet)

**What to do:**
1. Define a `ISheetsClient` interface in `src/sheets/client.ts`
2. Implement `GASheetsClient` (uses real `SpreadsheetApp` — runs only in GAS)
3. Implement `MockSheetsClient` for local testing
4. Wire up env-based client selection

**Test cases to cover:**
- Unit: MockSheetsClient CRUD operations work correctly
- Unit: type contract between interface and implementations
- Integration: real read/write to `TEST_SPREADSHEET_ID` (skipped if env var absent)

**Done when:** unit tests pass locally; integration tests pass with test sheet configured.

---

## PHASE 2 — Core Game Engine (Pure Logic)

### Task 4 — Scoring Algorithm
**Status**: ✅ Done
**Type**: Feature + Unit Tests
**Tests**: Unit (exhaustive)

**What to do:**
1. Implement `src/game/scoring.ts` as pure functions — zero imports from sheets or telegram
2. Types: `Player`, `Round`, `VoteResult`, `ScoreResult`
3. Core function: `calculateScores(round: Round): ScoreResult`

**Test cases to cover (all edge cases):**
- All players guess the storyteller's card → storyteller 0, others 2 each
- No player guesses the storyteller's card → storyteller 0, others 2 each
- Exactly some players guess correctly → storyteller 3, correct guessers 3 each
- Vote bonuses: a non-storyteller card that got 2 votes → +2 for that player
- 3-player, 4-player, 5-player, 6-player scenarios
- Storyteller cannot vote on own card (validation)
- Player cannot vote on their own submitted card (validation)

**Done when:** `yarn test:unit` passes all scoring tests with 100% branch coverage on `scoring.ts`.

---

### Task 5 — Game Engine (State Machine)
**Status**: ✅ Done
**Type**: Feature + Unit Tests
**Tests**: Unit

**What to do:**
1. Implement `src/game/engine.ts` — pure functions for game lifecycle
2. Functions: `createGame()`, `addPlayer()`, `dealCards()`, `startGame()`, `nextRound()`, `endGame()`
3. Implement `src/game/state.ts` — GameState type and state transition guards

**Test cases to cover:**
- `createGame()` produces a valid initial state
- `addPlayer()` enforces min (3) and max (6) players
- Duplicate player join is rejected
- `dealCards()` gives each player exactly 6 cards, no duplicates across hands
- `startGame()` fails if < 3 players
- `nextRound()` rotates storyteller correctly
- `endGame()` triggers when deck empty or score ≥ 30

**Done when:** `yarn test:unit` passes all engine tests.

---

### Task 6 — Round Lifecycle
**Status**: ✅ Done
**Type**: Feature + Unit + Integration Tests
**Tests**: Unit + Integration

**What to do:**
1. Implement `src/game/rounds.ts` — round state machine
2. Phases: `waiting_clue` → `waiting_submissions` → `waiting_votes` → `revealing` → `done`
3. Functions: `submitClue()`, `submitCard()`, `submitVote()`, `revealRound()`

**Test cases to cover:**
- Unit: each phase transition is valid/invalid
- Unit: submitting clue before storyteller is set → error
- Unit: submitting twice → error
- Unit: voting before all submitted → error
- Unit: all submissions received → auto-advance to voting phase
- Integration: full round from clue to reveal using MockSheetsClient

**Done when:** unit + integration tests pass.

---

## PHASE 3 — Sheets Integration

### Task 7 — Sheets Modules (All CRUD)
**Status**: ✅ Done
**Type**: Feature + Integration Tests
**Tests**: Integration (real test sheet), Unit (mocked)

**What to do:**
Implement all 5 sheet modules: `games.ts`, `players.ts`, `rounds.ts`, `cards.ts`, `leaderboard.ts`
Each must implement full CRUD against the schema in `CLAUDE.md`.

**Test cases to cover (per module):**
- Create a record → can be read back correctly
- Update a field → change is persisted
- Delete / mark inactive → no longer returned in active queries
- Query by foreign key (e.g. all players in game_id X)
- Concurrent write safety (note limitations of Sheets)

**Done when:** integration tests pass against real `TEST_SPREADSHEET_ID`.

---

## PHASE 4 — Telegram Bot

### Task 8 — Bot Commands
**Status**: ✅ Done
**Type**: Feature + API Tests
**Tests**: API (msw)

**What to do:**
1. Implement `src/commands.ts`: `/start`, `/newgame`, `/join`, `/startgame`, `/stats`, `/leaderboard`
2. Set up `tests/api/mocks/telegram.mock.ts` with msw handlers for Telegram Bot API
3. Each command handler tested end-to-end (mocked network, mocked sheets)

**Test cases to cover:**
- `/start` → sends welcome message with language options
- `/newgame` in group → creates game, returns join instructions
- `/newgame` when game already active → returns error message
- `/join` → adds player to game
- `/join` when game full (6 players) → returns error
- `/startgame` with < 3 players → returns error
- `/stats` → returns player's personal stats
- `/leaderboard` → returns top 5 players

**Done when:** all API tests pass with msw.

---

### Task 9 — Inline Keyboards & Callbacks
**Status**: ✅ Done
**Type**: Feature + API Tests
**Tests**: API (msw)

**What to do:**
1. Implement `src/telegram/keyboards.ts`: card selection keyboard, voting keyboard, lang switcher
2. Handle `callback_query` updates in `src/main.ts`
3. Card selection: sent privately to each player (except storyteller phase)
4. Voting: sent in group showing shuffled cards

**Test cases to cover:**
- Card selection callback → updates player's submission in state
- Voting callback → records vote, prevents double voting
- Language switch callback → updates user lang preference in Sheets
- Callback from unknown game → graceful error
- Expired callback (game ended) → graceful error

**Done when:** API tests pass.

---

### Task 10 — Full Message Flow
**Status**: 🔄 In Progress
**Type**: Feature + Integration Tests
**Tests**: Integration (full round simulation)

**What to do:**
1. Wire all pieces: storyteller clue → card collection → vote display → reveal → scoring → next round
2. Implement `src/telegram/messages.ts` (all formatted messages)
3. Integration test: simulate a 3-player game, one complete round, via mocked Telegram + real test sheet

**Test cases to cover:**
- Full round completes without errors
- Score is correctly calculated and saved to Sheets
- Cards are replenished after round
- Storyteller rotates to next player
- Game-ending condition triggers correctly

**Done when:** integration test for full round passes.

---

## PHASE 5 — E2E Tests

### Task 11 — Playwright Setup & First Game Round E2E
**Status**: ⬜ Todo
**Type**: E2E Tests
**Tests**: Playwright

**What to do:**
1. Configure Playwright to connect to Telegram Web (`web.telegram.org`)
2. Create Page Object Models in `tests/e2e/pages/`
3. Write `full-game.spec.ts`: join a game, play one round as a player, assert score appears

**Test cases to cover:**
- Bot responds to `/start`
- Player can join a game via group chat
- Card selection keyboard appears in private chat
- Vote keyboard appears after all submissions
- Scores displayed correctly after round

**Done when:** E2E test runs headlessly in CI.

---

### Task 12 — Leaderboard E2E
**Status**: ⬜ Todo
**Type**: E2E Tests
**Tests**: Playwright

**What to do:**
Play 2 full games via Playwright, assert leaderboard rankings update correctly.

**Done when:** Playwright test passes.

---

## PHASE 6 — CI/CD

### Task 13 — GitHub Actions CI Pipeline
**Status**: ⬜ Todo
**Type**: DevOps
**Tests**: Validates all test suites run in CI

**What to do:**
Create `.github/workflows/ci.yml`:
- Trigger: every PR to `main`
- Steps: install → unit tests → integration tests → API tests → E2E (headless Playwright)
- Secrets: `TEST_SPREADSHEET_ID`, `TELEGRAM_TEST_BOT_TOKEN`, `CLASPRC_JSON`
- Coverage report uploaded as artifact

**Done when:** a test PR triggers CI and all steps pass.

---

### Task 14 — GitHub Actions Deploy Pipeline
**Status**: ⬜ Todo
**Type**: DevOps

**What to do:**
Create `.github/workflows/deploy.yml`:
- Trigger: merge to `main`
- Steps: build with esbuild → `clasp push` → `clasp deploy`
- Uses stored `CLASPRC_JSON` secret

**Done when:** merge to main triggers deploy and bot is live on GAS.

---

## PHASE 7 — Performance Tests

### Task 15 — k6 Performance Scripts
**Status**: ⬜ Todo
**Type**: Performance Tests
**Tests**: k6

**What to do:**
1. `tests/performance/game-creation.js` — 10 concurrent `/newgame` requests
2. `tests/performance/voting-load.js` — 50 concurrent vote submissions
3. Document: p95 response time, error rate, throughput

**Acceptance criteria:**
- p95 response < 2000ms
- Error rate < 1%

**Done when:** k6 scripts run and produce a result report.

---

## PHASE 8 — Polish

### Task 16 — Error Handling & Logging
**Status**: ⬜ Todo
**Type**: Feature + Unit + Integration Tests
**Tests**: Unit + Integration

**What to do:**
1. grammY error handler middleware
2. `/help` command
3. Logging to Sheets "Logs" tab (timestamp, level, message, context)

**Done when:** unit tests for error handler + integration test for log writing pass.

---

### Task 17 — Card Upload Script
**Status**: ⬜ Todo
**Type**: Tooling

**What to do:**
Script to bulk-upload Dixit card images to Telegram (via bot sendPhoto) and save returned
`file_id` values to Google Sheets Cards sheet. Run once, store for all future games.

**Done when:** Cards sheet is populated with real `file_id` values.

---

### Task 18 — README & Docs
**Status**: ⬜ Todo
**Type**: Documentation

**What to do:**
1. `README.md` with: setup guide, architecture diagram (Mermaid), how to run tests
2. Coverage report badge
3. Lessons learned section on each test type

**Done when:** README is complete and accurate.

---

## Summary Table

| # | Task | Phase | Test Types | Status |
|---|---|---|---|---|
| 1 | Project Scaffold | Foundation | Unit (smoke) | ✅ |
| 2 | i18n System | Foundation | Unit | ✅ |
| 3 | Sheets Client | Foundation | Unit, Integration | ✅ |
| 4 | Scoring Algorithm | Game Engine | Unit (exhaustive) | ✅ |
| 5 | Game Engine | Game Engine | Unit | ✅ |
| 6 | Round Lifecycle | Game Engine | Unit, Integration | ✅ |
| 7 | Sheets CRUD | Sheets | Integration, Unit | ✅ |
| 8 | Bot Commands | Telegram | API (msw) | ✅ |
| 9 | Keyboards & Callbacks | Telegram | API (msw) | ✅ |
| 10 | Full Message Flow | Telegram | Integration | 🔄 |
| 11 | Playwright Setup + E2E Round | E2E | Playwright | ⬜ |
| 12 | Leaderboard E2E | E2E | Playwright | ⬜ |
| 13 | CI Pipeline | CI/CD | All suites | ⬜ |
| 14 | Deploy Pipeline | CI/CD | — | ⬜ |
| 15 | Performance Tests | Performance | k6 | ⬜ |
| 16 | Error Handling & Logging | Polish | Unit, Integration | ⬜ |
| 17 | Card Upload Script | Polish | — | ⬜ |
| 18 | README & Docs | Polish | — | ⬜ |
