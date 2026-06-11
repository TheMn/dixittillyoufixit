import { Bot, Context } from "grammy";
import { ISheetsClient } from "./sheets/client";
import { t } from "./i18n/index";
import { getGame, getActiveGameByChat, createGame as createGameRecord, updateGame } from "./sheets/games";
import { getPlayer, createPlayer, getGamePlayers, updatePlayer } from "./sheets/players";
import { getCurrentRound, updateRound } from "./sheets/rounds";
import type { RoundRecord } from "./sheets/rounds";
import { submitCard, submitVote } from "./game/rounds";
import type { RoundState } from "./game/rounds";
import { getLeaderboardEntry, getTopPlayers } from "./sheets/leaderboard";
import { addPlayer, startGame } from "./game/engine";
import { GameState, GamePlayer } from "./game/state";
import { GameRecord } from "./sheets/games";
import { PlayerRecord } from "./sheets/players";

export type DixitContext = Context & { sheets: ISheetsClient };

function gameRecordToState(game: GameRecord, players: PlayerRecord[]): GameState {
  return {
    gameId: game.game_id,
    chatId: game.chat_id,
    status: game.status,
    players: players.map((p): GamePlayer => ({
      id: p.user_id,
      username: p.username,
      hand: p.hand,
      score: p.score,
    })),
    deck: [],
    currentRound: game.current_round,
    storytellerIndex: 0,
    createdAt: 0,
  };
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function roundRecordToState(
  round: RoundRecord,
  game: GameRecord,
  players: PlayerRecord[]
): RoundState {
  return {
    roundId: round.round_id,
    gameId: round.game_id,
    roundNum: round.round_num,
    phase: round.status,
    storytellerId: game.storyteller_id,
    playerIds: players.map(p => p.user_id),
    clue: round.clue || null,
    storytellerCardId: round.storyteller_card || null,
    submissions: round.submissions,
    votes: round.votes,
  };
}

export function registerCallbacks(bot: Bot<DixitContext>): void {
  // select_card:{gameId}:{cardId} — player submits a card for the current round
  bot.callbackQuery(/^select_card:/, async (ctx) => {
    const [, gameId, cardId] = ctx.callbackQuery.data.split(":");
    const userId = String(ctx.from.id);
    const lang = "en";

    const game = getGame(ctx.sheets, gameId);
    if (!game) {
      await ctx.answerCallbackQuery({ text: t("game.not_found", lang) });
      return;
    }
    if (game.status === "ended") {
      await ctx.answerCallbackQuery({ text: t("callback.game_ended", lang) });
      return;
    }

    const roundRecord = getCurrentRound(ctx.sheets, gameId);
    if (!roundRecord) {
      await ctx.answerCallbackQuery({ text: t("error.generic", lang) });
      return;
    }

    const players = getGamePlayers(ctx.sheets, gameId);
    const roundState = roundRecordToState(roundRecord, game, players);
    const result = submitCard(roundState, userId, cardId);

    if (!result.ok) {
      const key = result.error === "already_submitted" ? "callback.already_submitted" : "error.generic";
      await ctx.answerCallbackQuery({ text: t(key, lang) });
      return;
    }

    updateRound(ctx.sheets, roundRecord.round_id, {
      submissions: result.state.submissions,
      status: result.state.phase,
    });
    await ctx.answerCallbackQuery({ text: t("callback.card_selected", lang) });
  });

  // vote_card:{gameId}:{cardId} — player votes for the storyteller's card
  bot.callbackQuery(/^vote_card:/, async (ctx) => {
    const [, gameId, cardId] = ctx.callbackQuery.data.split(":");
    const userId = String(ctx.from.id);
    const lang = "en";

    const game = getGame(ctx.sheets, gameId);
    if (!game) {
      await ctx.answerCallbackQuery({ text: t("game.not_found", lang) });
      return;
    }
    if (game.status === "ended") {
      await ctx.answerCallbackQuery({ text: t("callback.game_ended", lang) });
      return;
    }

    const roundRecord = getCurrentRound(ctx.sheets, gameId);
    if (!roundRecord) {
      await ctx.answerCallbackQuery({ text: t("error.generic", lang) });
      return;
    }

    const players = getGamePlayers(ctx.sheets, gameId);
    const roundState = roundRecordToState(roundRecord, game, players);
    const result = submitVote(roundState, userId, cardId);

    if (!result.ok) {
      const key = result.error === "already_voted" ? "callback.already_voted" : "error.generic";
      await ctx.answerCallbackQuery({ text: t(key, lang) });
      return;
    }

    updateRound(ctx.sheets, roundRecord.round_id, {
      votes: result.state.votes,
      status: result.state.phase,
    });
    await ctx.answerCallbackQuery({ text: t("callback.vote_recorded", lang) });
  });

  // set_lang:{gameId}:{lang} — player switches their language preference
  bot.callbackQuery(/^set_lang:/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split(":");
    const gameId = parts[1];
    const rawLang = parts[2];
    const newLang = rawLang === "fa" ? "fa" : "en";
    const userId = String(ctx.from.id);

    const game = getGame(ctx.sheets, gameId);
    if (!game) {
      await ctx.answerCallbackQuery({ text: t("game.not_found", "en") });
      return;
    }

    updatePlayer(ctx.sheets, gameId, userId, { lang: newLang });
    await ctx.answerCallbackQuery({ text: t("player.lang_set", newLang) });
  });
}

export function registerCommands(bot: Bot<DixitContext>): void {
  bot.command("start", async (ctx) => {
    const lang = "en";
    await ctx.reply(t("player.welcome", lang));
  });

  bot.command("newgame", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const lang = "en";

    const existing = getActiveGameByChat(ctx.sheets, chatId);
    if (existing) {
      await ctx.reply(t("game.already_active", lang));
      return;
    }

    const game: GameRecord = {
      game_id: generateId(),
      chat_id: chatId,
      status: "lobby",
      current_round: 0,
      storyteller_id: "",
      created_at: new Date().toISOString(),
    };
    createGameRecord(ctx.sheets, game);
    await ctx.reply(t("game.created", lang));
  });

  bot.command("join", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const userId = String(ctx.from?.id ?? "");
    const username = ctx.from?.username ?? ctx.from?.first_name ?? userId;
    const lang = "en";

    const game = getActiveGameByChat(ctx.sheets, chatId);
    if (!game) {
      await ctx.reply(t("game.not_found", lang));
      return;
    }

    const existingPlayer = getPlayer(ctx.sheets, game.game_id, userId);
    if (existingPlayer) {
      await ctx.reply(t("player.already_joined", lang));
      return;
    }

    const players = getGamePlayers(ctx.sheets, game.game_id);
    const state = gameRecordToState(game, players);
    const result = addPlayer(state, { id: userId, username });

    if (!result.ok) {
      if (result.error === "game_full") {
        await ctx.reply(t("player.full", lang));
      } else {
        await ctx.reply(t("error.generic", lang));
      }
      return;
    }

    createPlayer(ctx.sheets, {
      game_id: game.game_id,
      user_id: userId,
      username,
      hand: [],
      score: 0,
      lang,
    });
    await ctx.reply(t("player.joined", lang, { username }));
  });

  bot.command("startgame", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const lang = "en";

    const game = getActiveGameByChat(ctx.sheets, chatId);
    if (!game) {
      await ctx.reply(t("game.not_found", lang));
      return;
    }

    const players = getGamePlayers(ctx.sheets, game.game_id);
    const state = gameRecordToState(game, players);
    const result = startGame(state);

    if (!result.ok) {
      if (result.error === "not_enough_players") {
        await ctx.reply(t("game.not_enough_players", lang));
      } else {
        await ctx.reply(t("error.generic", lang));
      }
      return;
    }

    updateGame(ctx.sheets, game.game_id, { status: "active" });
    await ctx.reply(t("game.started", lang));
  });

  bot.command("stats", async (ctx) => {
    const userId = String(ctx.from?.id ?? "");
    const lang = "en";

    const entry = getLeaderboardEntry(ctx.sheets, userId);
    if (!entry) {
      await ctx.reply(t("leaderboard.empty", lang));
      return;
    }

    await ctx.reply(
      t("leaderboard.entry", lang, {
        rank: "-",
        username: entry.username,
        score: entry.total_score,
        wins: entry.total_wins,
      })
    );
  });

  bot.command("leaderboard", async (ctx) => {
    const lang = "en";
    const top = getTopPlayers(ctx.sheets, 5);

    if (top.length === 0) {
      await ctx.reply(t("leaderboard.empty", lang));
      return;
    }

    const lines = [t("leaderboard.title", lang)];
    top.forEach((entry, i) => {
      lines.push(
        t("leaderboard.entry", lang, {
          rank: i + 1,
          username: entry.username,
          score: entry.total_score,
          wins: entry.total_wins,
        })
      );
    });
    await ctx.reply(lines.join("\n"));
  });
}

const STUB_BOT_INFO = {
  id: 0,
  is_bot: true as const,
  first_name: "DixitBot",
  username: "DixitBot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_manage_bots: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
};

export function createBot(
  sheets: ISheetsClient,
  token: string,
  // Allow overriding fetch so MSW (native fetch) can intercept in tests.
  fetchFn?: typeof fetch
): Bot<DixitContext> {
  const bot = new Bot<DixitContext>(token, {
    botInfo: STUB_BOT_INFO,
    client: fetchFn ? { fetch: fetchFn } : undefined,
  });
  bot.use(async (ctx, next) => {
    ctx.sheets = sheets;
    await next();
  });
  registerCommands(bot);
  registerCallbacks(bot);
  return bot;
}
