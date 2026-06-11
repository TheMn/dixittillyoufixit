import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { Update, User, Chat } from "grammy/types";
import { MockSheetsClient } from "../../src/sheets/client";
import { createGame as createGameRecord } from "../../src/sheets/games";
import { createPlayer, getPlayer } from "../../src/sheets/players";
import { createRound as createRoundRecord, getCurrentRound } from "../../src/sheets/rounds";
import { createBot } from "../../src/commands";
import { t } from "../../src/i18n/index";
import { createTelegramServer } from "./mocks/telegram.mock";
import type { RoundPhase } from "../../src/game/rounds";
import type { GameStatus } from "../../src/game/state";

const TEST_TOKEN = "test_token_123";

// ---------- helpers ----------

function makeUser(id: number, username = `user${id}`): User {
  return { id, is_bot: false, first_name: username, username };
}

function makeGroupChat(id: number): Chat.GroupChat {
  return { id, type: "group", title: "Test Group" };
}

function makeCallbackUpdate(
  chatId: number,
  userId: number,
  callbackData: string,
  username?: string
): Update {
  const user = makeUser(userId, username);
  const chat = makeGroupChat(chatId);
  const message = { message_id: 1, date: 0, chat, from: user, text: "" };
  return {
    update_id: 2,
    callback_query: {
      id: "cq_1",
      from: user,
      message,
      chat_instance: "ci_1",
      data: callbackData,
    },
  } as unknown as Update;
}

// ---------- shared seed helpers ----------

function seedActiveGame(sheets: MockSheetsClient, gameId = "g1", storytellerId = "1") {
  createGameRecord(sheets, {
    game_id: gameId,
    chat_id: "100",
    status: "active" as GameStatus,
    current_round: 1,
    storyteller_id: storytellerId,
    created_at: "",
  });
}

function seedPlayers(sheets: MockSheetsClient, gameId = "g1") {
  createPlayer(sheets, { game_id: gameId, user_id: "1",  username: "storyteller", hand: ["card_a"], score: 0, lang: "en" });
  createPlayer(sheets, { game_id: gameId, user_id: "42", username: "alice",       hand: ["card_b"], score: 0, lang: "en" });
  createPlayer(sheets, { game_id: gameId, user_id: "2",  username: "bob",         hand: ["card_c"], score: 0, lang: "en" });
}

function seedRound(
  sheets: MockSheetsClient,
  status: RoundPhase,
  submissions: Record<string, string> = {},
  votes: Record<string, string> = {},
  gameId = "g1"
) {
  createRoundRecord(sheets, {
    round_id: "r1",
    game_id: gameId,
    round_num: 1,
    clue: "ocean",
    storyteller_card: "card_a",
    submissions,
    votes,
    status,
  });
}

// ---------- test setup ----------

const tg = createTelegramServer();

beforeAll(() => tg.server.listen({ onUnhandledRequest: "error" }));
afterAll(() => tg.server.close());
afterEach(() => tg.reset());

// ---------- keyboard shape ----------

describe("keyboard builders", () => {
  it("cardSelectionKeyboard produces correct callback_data", async () => {
    const { cardSelectionKeyboard } = await import("../../src/telegram/keyboards");
    const kb = cardSelectionKeyboard("g1", ["card_a", "card_b"]);
    expect(kb.inline_keyboard[0][0].callback_data).toBe("select_card:g1:card_a");
    expect(kb.inline_keyboard[1][0].callback_data).toBe("select_card:g1:card_b");
  });

  it("votingKeyboard produces numeric labels and correct callback_data", async () => {
    const { votingKeyboard } = await import("../../src/telegram/keyboards");
    const kb = votingKeyboard("g1", ["card_a", "card_b", "card_c"]);
    expect(kb.inline_keyboard[0][0].text).toBe("1");
    expect(kb.inline_keyboard[0][0].callback_data).toBe("vote_card:g1:card_a");
    expect(kb.inline_keyboard[2][0].callback_data).toBe("vote_card:g1:card_c");
  });

  it("langSwitcherKeyboard produces en and fa buttons", async () => {
    const { langSwitcherKeyboard } = await import("../../src/telegram/keyboards");
    const kb = langSwitcherKeyboard("g1");
    const row = kb.inline_keyboard[0];
    expect(row[0].callback_data).toBe("set_lang:g1:en");
    expect(row[1].callback_data).toBe("set_lang:g1:fa");
  });
});

// ---------- select_card ----------

describe("select_card callback", () => {
  it("should record card submission and answer with success", async () => {
    const sheets = new MockSheetsClient();
    seedActiveGame(sheets);
    seedPlayers(sheets);
    seedRound(sheets, "waiting_submissions");

    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "select_card:g1:card_b", "alice"));

    expect(tg.callbackAnswers).toHaveLength(1);
    expect(tg.callbackAnswers[0].text).toBe(t("callback.card_selected", "en"));

    const round = getCurrentRound(sheets, "g1")!;
    expect(round.submissions["42"]).toBe("card_b");
  });

  it("should reject when game does not exist", async () => {
    const sheets = new MockSheetsClient();
    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "select_card:unknown:card_b"));

    expect(tg.callbackAnswers[0].text).toBe(t("game.not_found", "en"));
  });

  it("should reject when game has ended", async () => {
    const sheets = new MockSheetsClient();
    createGameRecord(sheets, {
      game_id: "g1", chat_id: "100", status: "ended" as GameStatus,
      current_round: 1, storyteller_id: "1", created_at: "",
    });
    seedPlayers(sheets);
    seedRound(sheets, "done");

    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "select_card:g1:card_b"));

    expect(tg.callbackAnswers[0].text).toBe(t("callback.game_ended", "en"));
  });

  it("should reject double submission", async () => {
    const sheets = new MockSheetsClient();
    seedActiveGame(sheets);
    seedPlayers(sheets);
    // Player 42 has already submitted card_b
    seedRound(sheets, "waiting_submissions", { "42": "card_b" });

    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "select_card:g1:card_x"));

    expect(tg.callbackAnswers[0].text).toBe(t("callback.already_submitted", "en"));
  });
});

// ---------- vote_card ----------

describe("vote_card callback", () => {
  it("should record vote and answer with success", async () => {
    const sheets = new MockSheetsClient();
    seedActiveGame(sheets);
    seedPlayers(sheets);
    // All non-storytellers have submitted; round is in waiting_votes
    seedRound(sheets, "waiting_votes", { "42": "card_b", "2": "card_c" });

    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    // Player 42 votes for "card_a" (storyteller's card, not their own)
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "vote_card:g1:card_a", "alice"));

    expect(tg.callbackAnswers).toHaveLength(1);
    expect(tg.callbackAnswers[0].text).toBe(t("callback.vote_recorded", "en"));

    const round = getCurrentRound(sheets, "g1")!;
    expect(round.votes["42"]).toBe("card_a");
  });

  it("should prevent double voting", async () => {
    const sheets = new MockSheetsClient();
    seedActiveGame(sheets);
    seedPlayers(sheets);
    // Player 42 has already voted
    seedRound(sheets, "waiting_votes", { "42": "card_b", "2": "card_c" }, { "42": "card_a" });

    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "vote_card:g1:card_c"));

    expect(tg.callbackAnswers[0].text).toBe(t("callback.already_voted", "en"));
  });

  it("should reject when game does not exist", async () => {
    const sheets = new MockSheetsClient();
    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "vote_card:unknown:card_a"));

    expect(tg.callbackAnswers[0].text).toBe(t("game.not_found", "en"));
  });

  it("should reject when game has ended", async () => {
    const sheets = new MockSheetsClient();
    createGameRecord(sheets, {
      game_id: "g1", chat_id: "100", status: "ended" as GameStatus,
      current_round: 1, storyteller_id: "1", created_at: "",
    });
    seedPlayers(sheets);
    seedRound(sheets, "done", { "42": "card_b", "2": "card_c" });

    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "vote_card:g1:card_a"));

    expect(tg.callbackAnswers[0].text).toBe(t("callback.game_ended", "en"));
  });
});

// ---------- set_lang ----------

describe("set_lang callback", () => {
  it("should update player language to fa", async () => {
    const sheets = new MockSheetsClient();
    seedActiveGame(sheets);
    seedPlayers(sheets); // player 42 starts with lang "en"

    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "set_lang:g1:fa", "alice"));

    expect(tg.callbackAnswers).toHaveLength(1);
    expect(tg.callbackAnswers[0].text).toBe(t("player.lang_set", "fa"));

    const player = getPlayer(sheets, "g1", "42")!;
    expect(player.lang).toBe("fa");
  });

  it("should update player language to en", async () => {
    const sheets = new MockSheetsClient();
    seedActiveGame(sheets);
    // Start player 42 with lang "fa"
    createPlayer(sheets, { game_id: "g1", user_id: "42", username: "alice", hand: [], score: 0, lang: "fa" });

    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "set_lang:g1:en", "alice"));

    const player = getPlayer(sheets, "g1", "42")!;
    expect(player.lang).toBe("en");
  });

  it("should reject when game does not exist", async () => {
    const sheets = new MockSheetsClient();
    const bot = createBot(sheets, TEST_TOKEN, globalThis.fetch);
    await bot.handleUpdate(makeCallbackUpdate(100, 42, "set_lang:unknown:fa"));

    expect(tg.callbackAnswers[0].text).toBe(t("game.not_found", "en"));
  });
});
