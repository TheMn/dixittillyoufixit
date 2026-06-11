import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { Update, Message, Chat, User } from "@grammyjs/types";
import { MockSheetsClient } from "../../src/sheets/client";
import { createGame as createGameRecord } from "../../src/sheets/games";
import { createPlayer } from "../../src/sheets/players";
import { upsertLeaderboard } from "../../src/sheets/leaderboard";
import { createBot } from "../../src/commands";
import { t } from "../../src/i18n/index";
import { createTelegramServer } from "./mocks/telegram.mock";

const TEST_TOKEN = "test_token_123";

// ---------- helpers ----------

function makeUser(id: number, username = `user${id}`): User {
  return { id, is_bot: false, first_name: username, username };
}

function makeGroupChat(id: number): Chat.GroupChat {
  return { id, type: "group", title: "Test Group" };
}

function makeUpdate(chatId: number, userId: number, text: string, username?: string): Update {
  const user = makeUser(userId, username);
  const chat = makeGroupChat(chatId);
  const message: Message.TextMessage = {
    message_id: 1,
    date: 0,
    chat,
    from: user,
    text,
  };
  return { update_id: 1, message };
}

// ---------- test setup ----------

const tg = createTelegramServer();

beforeAll(() => tg.server.listen({ onUnhandledRequest: "error" }));
afterAll(() => tg.server.close());
afterEach(() => tg.reset());

// ---------- /start ----------

describe("/start", () => {
  it("should send welcome message", async () => {
    const sheets = new MockSheetsClient();
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 1, "/start"));

    expect(tg.messages).toHaveLength(1);
    expect(tg.messages[0].chat_id).toBe(100);
    expect(tg.messages[0].text).toBe(t("player.welcome", "en"));
  });
});

// ---------- /newgame ----------

describe("/newgame", () => {
  it("should create a game when no active game exists", async () => {
    const sheets = new MockSheetsClient();
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 1, "/newgame"));

    expect(tg.messages).toHaveLength(1);
    expect(tg.messages[0].text).toBe(t("game.created", "en"));
  });

  it("should reject when a game is already active in this chat", async () => {
    const sheets = new MockSheetsClient();
    createGameRecord(sheets, {
      game_id: "g1",
      chat_id: "100",
      status: "lobby",
      current_round: 0,
      storyteller_id: "",
      created_at: "",
    });
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 1, "/newgame"));

    expect(tg.messages).toHaveLength(1);
    expect(tg.messages[0].text).toBe(t("game.already_active", "en"));
  });
});

// ---------- /join ----------

describe("/join", () => {
  it("should add a player to a lobby game", async () => {
    const sheets = new MockSheetsClient();
    createGameRecord(sheets, {
      game_id: "g1",
      chat_id: "100",
      status: "lobby",
      current_round: 0,
      storyteller_id: "",
      created_at: "",
    });
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 42, "/join", "alice"));

    expect(tg.messages).toHaveLength(1);
    expect(tg.messages[0].text).toBe(t("player.joined", "en", { username: "alice" }));
  });

  it("should reject when no active game in chat", async () => {
    const sheets = new MockSheetsClient();
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 42, "/join"));

    expect(tg.messages[0].text).toBe(t("game.not_found", "en"));
  });

  it("should reject when player already joined", async () => {
    const sheets = new MockSheetsClient();
    createGameRecord(sheets, {
      game_id: "g1",
      chat_id: "100",
      status: "lobby",
      current_round: 0,
      storyteller_id: "",
      created_at: "",
    });
    createPlayer(sheets, {
      game_id: "g1",
      user_id: "42",
      username: "alice",
      hand: [],
      score: 0,
      lang: "en",
    });
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 42, "/join", "alice"));

    expect(tg.messages[0].text).toBe(t("player.already_joined", "en"));
  });

  it("should reject when game is full (6 players)", async () => {
    const sheets = new MockSheetsClient();
    createGameRecord(sheets, {
      game_id: "g1",
      chat_id: "100",
      status: "lobby",
      current_round: 0,
      storyteller_id: "",
      created_at: "",
    });
    for (let i = 1; i <= 6; i++) {
      createPlayer(sheets, {
        game_id: "g1",
        user_id: String(i),
        username: `player${i}`,
        hand: [],
        score: 0,
        lang: "en",
      });
    }
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 99, "/join", "latecomer"));

    expect(tg.messages[0].text).toBe(t("player.full", "en"));
  });
});

// ---------- /startgame ----------

describe("/startgame", () => {
  it("should start the game when 3 or more players have joined", async () => {
    const sheets = new MockSheetsClient();
    createGameRecord(sheets, {
      game_id: "g1",
      chat_id: "100",
      status: "lobby",
      current_round: 0,
      storyteller_id: "",
      created_at: "",
    });
    for (let i = 1; i <= 3; i++) {
      createPlayer(sheets, {
        game_id: "g1",
        user_id: String(i),
        username: `player${i}`,
        hand: [],
        score: 0,
        lang: "en",
      });
    }
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 1, "/startgame"));

    expect(tg.messages[0].text).toBe(t("game.started", "en"));
  });

  it("should reject when fewer than 3 players have joined", async () => {
    const sheets = new MockSheetsClient();
    createGameRecord(sheets, {
      game_id: "g1",
      chat_id: "100",
      status: "lobby",
      current_round: 0,
      storyteller_id: "",
      created_at: "",
    });
    createPlayer(sheets, {
      game_id: "g1",
      user_id: "1",
      username: "solo",
      hand: [],
      score: 0,
      lang: "en",
    });
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 1, "/startgame"));

    expect(tg.messages[0].text).toBe(t("game.not_enough_players", "en"));
  });

  it("should reject when no active game in chat", async () => {
    const sheets = new MockSheetsClient();
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 1, "/startgame"));

    expect(tg.messages[0].text).toBe(t("game.not_found", "en"));
  });
});

// ---------- /stats ----------

describe("/stats", () => {
  it("should return player stats when they exist", async () => {
    const sheets = new MockSheetsClient();
    upsertLeaderboard(sheets, {
      user_id: "42",
      username: "alice",
      total_games: 5,
      total_wins: 2,
      total_score: 47,
      last_played: "",
    });
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 42, "/stats", "alice"));

    expect(tg.messages).toHaveLength(1);
    expect(tg.messages[0].text).toContain("alice");
    expect(tg.messages[0].text).toContain("47");
  });

  it("should return empty message when player has no stats", async () => {
    const sheets = new MockSheetsClient();
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 99, "/stats"));

    expect(tg.messages[0].text).toBe(t("leaderboard.empty", "en"));
  });
});

// ---------- /leaderboard ----------

describe("/leaderboard", () => {
  it("should return top 5 players ordered by score", async () => {
    const sheets = new MockSheetsClient();
    const players = [
      { user_id: "1", username: "alpha", total_games: 3, total_wins: 1, total_score: 30, last_played: "" },
      { user_id: "2", username: "beta",  total_games: 3, total_wins: 2, total_score: 50, last_played: "" },
      { user_id: "3", username: "gamma", total_games: 3, total_wins: 0, total_score: 10, last_played: "" },
      { user_id: "4", username: "delta", total_games: 3, total_wins: 1, total_score: 40, last_played: "" },
      { user_id: "5", username: "eps",   total_games: 3, total_wins: 0, total_score: 20, last_played: "" },
      { user_id: "6", username: "zeta",  total_games: 3, total_wins: 3, total_score: 60, last_played: "" },
    ];
    players.forEach(p => upsertLeaderboard(sheets, p));

    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 1, "/leaderboard"));

    expect(tg.messages).toHaveLength(1);
    const text = tg.messages[0].text;
    expect(text.indexOf("zeta")).toBeLessThan(text.indexOf("beta"));
    expect(text).not.toContain("gamma");
  });

  it("should return empty message when no games played", async () => {
    const sheets = new MockSheetsClient();
    const bot = createBot(sheets, TEST_TOKEN);
    await bot.handleUpdate(makeUpdate(100, 1, "/leaderboard"));

    expect(tg.messages[0].text).toBe(t("leaderboard.empty", "en"));
  });
});
