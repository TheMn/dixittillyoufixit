import { Bot, Context } from "grammy";
import { ISheetsClient } from "./sheets/client";
import { t } from "./i18n/index";
import { getGame, getActiveGameByChat, createGame as createGameRecord, updateGame } from "./sheets/games";
import { getPlayer, createPlayer, getGamePlayers, updatePlayer } from "./sheets/players";
import { getCurrentRound, updateRound, createRound as createRoundRecord } from "./sheets/rounds";
import type { RoundRecord } from "./sheets/rounds";
import { getAvailableCards, updateCard } from "./sheets/cards";
import { submitCard, submitVote, submitClue } from "./game/rounds";
import type { RoundState } from "./game/rounds";
import { getLeaderboardEntry, getTopPlayers } from "./sheets/leaderboard";
import { addPlayer, startGame } from "./game/engine";
import { GameState, GamePlayer } from "./game/state";
import { GameRecord } from "./sheets/games";
import { PlayerRecord } from "./sheets/players";
import { processRoundEnd } from "./game/flow";
import { sendMessage } from "./telegram/api";
import { cardSelectionKeyboard, votingKeyboard } from "./telegram/keyboards";
import {
  roundStartMessage,
  storytellerPromptMessage,
  submitCardPromptMessage,
  votePromptMessage,
  revealMessage,
  nextRoundMessage,
  gameOverMessage,
} from "./telegram/messages";
import { shuffle } from "./helpers";

export type DixitContext = Context & { sheets: ISheetsClient };

// Pending clues from storytellers: roundId -> clue text
// Stored in memory between the storyteller's text message and card selection callback.
const pendingClues = new Map<string, string>();

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

// Creates a new round record in Sheets and sends round-start messages to the group and storyteller.
async function beginRound(
  sheets: ISheetsClient,
  game: GameRecord,
  roundNum: number,
  storytellerId: string,
  players: PlayerRecord[],
  lang: "en" | "fa"
): Promise<void> {
  const roundId = generateId();
  const playerIds = players.map(p => p.user_id);

  createRoundRecord(sheets, {
    round_id: roundId,
    game_id: game.game_id,
    round_num: roundNum,
    clue: "",
    storyteller_card: "",
    submissions: {},
    votes: {},
    status: "waiting_clue",
  });

  const storyteller = players.find(p => p.user_id === storytellerId);
  const storytellerName = storyteller?.username ?? storytellerId;

  await sendMessage({
    chat_id: game.chat_id,
    text: roundStartMessage(roundNum, lang),
  });
  await sendMessage({
    chat_id: game.chat_id,
    text: storytellerPromptMessage(storytellerName, lang),
  });

  // Send private card keyboards to all players (storyteller needs to send clue text first)
  for (const p of players) {
    if (p.hand.length > 0) {
      await sendMessage({
        chat_id: p.user_id,
        text: p.user_id === storytellerId
          ? storytellerPromptMessage(p.username, lang)
          : t("round.submit_card", lang, { clue: "..." }),
        reply_markup: cardSelectionKeyboard(game.game_id, p.hand),
      });
    }
  }

  void playerIds; // suppress unused warning — stored in round record implicitly via playerIds
}

export function registerCallbacks(bot: Bot<DixitContext>): void {
  // select_card:{gameId}:{cardId}
  // Handles both storyteller card selection (waiting_clue) and player submission (waiting_submissions).
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

    // Storyteller selects their card after sending a clue text message
    if (roundState.phase === "waiting_clue" && userId === roundState.storytellerId) {
      const clue = pendingClues.get(roundState.roundId);
      if (!clue) {
        await ctx.answerCallbackQuery({ text: t("round.clue_first", lang) });
        return;
      }

      const result = submitClue(roundState, userId, clue, cardId);
      if (!result.ok) {
        await ctx.answerCallbackQuery({ text: t("error.generic", lang) });
        return;
      }

      pendingClues.delete(roundState.roundId);
      updateRound(ctx.sheets, roundRecord.round_id, {
        clue: result.state.clue ?? "",
        storyteller_card: result.state.storytellerCardId ?? "",
        status: result.state.phase,
      });

      // Prompt non-storyteller players privately to submit a card
      const nonStorytellers = players.filter(p => p.user_id !== userId);
      for (const player of nonStorytellers) {
        await sendMessage({
          chat_id: player.user_id,
          text: submitCardPromptMessage(clue, lang),
          reply_markup: cardSelectionKeyboard(gameId, player.hand),
        });
      }

      await ctx.answerCallbackQuery({ text: t("callback.card_selected", lang) });
      return;
    }

    // Non-storyteller submits a card during waiting_submissions
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

    // All submissions received — shuffle cards and send voting keyboard to group
    if (result.state.phase === "waiting_votes") {
      const allCards = shuffle([
        result.state.storytellerCardId!,
        ...Object.values(result.state.submissions),
      ]);
      await sendMessage({
        chat_id: game.chat_id,
        text: votePromptMessage(lang),
        reply_markup: votingKeyboard(gameId, allCards),
      });
    }

    await ctx.answerCallbackQuery({ text: t("callback.card_selected", lang) });
  });

  // vote_card:{gameId}:{cardId}
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

    // All votes in — reveal results and advance the game
    if (result.state.phase === "revealing") {
      const updatedRoundRecord: RoundRecord = {
        ...roundRecord,
        votes: result.state.votes,
        status: "revealing",
      };

      const flowResult = processRoundEnd(ctx.sheets, game, updatedRoundRecord, players);

      // Build score entries for the reveal message
      const scoreEntries = flowResult.updatedPlayers.map(p => {
        const original = players.find(orig => orig.user_id === p.user_id)!;
        return {
          username: p.username,
          delta: p.score - original.score,
          total: p.score,
        };
      });

      await sendMessage({
        chat_id: game.chat_id,
        text: revealMessage(scoreEntries, lang),
      });

      if (flowResult.gameDone) {
        await sendMessage({
          chat_id: game.chat_id,
          text: gameOverMessage(
            { username: flowResult.winner!.username, score: flowResult.winner!.score },
            lang
          ),
        });
      } else {
        await sendMessage({ chat_id: game.chat_id, text: nextRoundMessage(lang) });
        await beginRound(
          ctx.sheets,
          { ...game, current_round: flowResult.nextRoundNum, storyteller_id: flowResult.nextStorytellerId },
          flowResult.nextRoundNum,
          flowResult.nextStorytellerId,
          flowResult.updatedPlayers,
          lang
        );
      }
    }
  });

  // set_lang:{gameId}:{lang}
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

    // Deal up to 6 cards to each player from available deck; start even if no cards are ready yet.
    const available = getAvailableCards(ctx.sheets);
    let cursor = 0;
    const dealtPlayers = players.map(p => {
      const hand = available.slice(cursor, cursor + 6).map(c => c.card_id);
      cursor += hand.length;
      for (const cardId of hand) updateCard(ctx.sheets, cardId, { in_use: true });
      if (hand.length > 0) updatePlayer(ctx.sheets, game.game_id, p.user_id, { hand });
      return { ...p, hand };
    });

    const firstStorytellerId = players[0].user_id;
    updateGame(ctx.sheets, game.game_id, {
      status: "active",
      current_round: 1,
      storyteller_id: firstStorytellerId,
    });

    await ctx.reply(t("game.started", lang));

    await beginRound(
      ctx.sheets,
      { ...game, game_id: game.game_id, status: "active", current_round: 1, storyteller_id: firstStorytellerId },
      1,
      firstStorytellerId,
      dealtPlayers,
      lang
    );
  });

  // Storyteller sends their clue text; bot stores it and shows card selection keyboard.
  // Must call next() for non-clue messages so subsequent command handlers (/stats, etc.) still run.
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) { await next(); return; }
    const chatId = String(ctx.chat.id);
    const userId = String(ctx.from.id);
    const lang = "en";

    const game = getActiveGameByChat(ctx.sheets, chatId);
    if (!game || game.status !== "active") { await next(); return; }

    const round = getCurrentRound(ctx.sheets, game.game_id);
    if (!round || round.status !== "waiting_clue") { await next(); return; }
    if (game.storyteller_id !== userId) { await next(); return; }

    const clue = ctx.message.text;
    pendingClues.set(round.round_id, clue);

    const player = getPlayer(ctx.sheets, game.game_id, userId);
    if (!player || player.hand.length === 0) { await next(); return; }

    await ctx.reply(submitCardPromptMessage(clue, lang), {
      reply_markup: cardSelectionKeyboard(game.game_id, player.hand),
    });
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
