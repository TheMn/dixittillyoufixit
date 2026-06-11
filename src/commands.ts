import type { Update } from "@grammyjs/types";
import { ISheetsClient } from "./sheets/client";
import { t } from "./i18n/index";
import { sendMessage } from "./telegram/api";
import { getActiveGameByChat, createGame, updateGame } from "./sheets/games";
import { getPlayer, createPlayer, getGamePlayers } from "./sheets/players";
import { getLeaderboardEntry, getTopPlayers } from "./sheets/leaderboard";
import { addPlayer, startGame, MIN_PLAYERS, MAX_PLAYERS } from "./game/engine";
import { GameState, GamePlayer } from "./game/state";
import { GameRecord } from "./sheets/games";
import { PlayerRecord } from "./sheets/players";

export interface CommandDeps {
  sheets: ISheetsClient;
}

function extractMessage(update: Update) {
  return update.message ?? update.edited_message ?? null;
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

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function handleStart(update: Update, deps: CommandDeps): Promise<void> {
  const msg = extractMessage(update);
  if (!msg) return;

  const lang = "en";
  await sendMessage({ chat_id: msg.chat.id, text: t("player.welcome", lang) });
}

export async function handleNewGame(update: Update, deps: CommandDeps): Promise<void> {
  const msg = extractMessage(update);
  if (!msg) return;

  const chatId = String(msg.chat.id);
  const lang = "en";

  const existing = getActiveGameByChat(deps.sheets, chatId);
  if (existing) {
    await sendMessage({ chat_id: msg.chat.id, text: t("game.already_active", lang) });
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
  createGame(deps.sheets, game);

  await sendMessage({ chat_id: msg.chat.id, text: t("game.created", lang) });
}

export async function handleJoin(update: Update, deps: CommandDeps): Promise<void> {
  const msg = extractMessage(update);
  if (!msg || !msg.from) return;

  const chatId = String(msg.chat.id);
  const userId = String(msg.from.id);
  const username = msg.from.username ?? msg.from.first_name ?? userId;
  const lang = "en";

  const game = getActiveGameByChat(deps.sheets, chatId);
  if (!game) {
    await sendMessage({ chat_id: msg.chat.id, text: t("game.not_found", lang) });
    return;
  }

  const existingPlayer = getPlayer(deps.sheets, game.game_id, userId);
  if (existingPlayer) {
    await sendMessage({ chat_id: msg.chat.id, text: t("player.already_joined", lang) });
    return;
  }

  const players = getGamePlayers(deps.sheets, game.game_id);
  const state = gameRecordToState(game, players);
  const result = addPlayer(state, { id: userId, username });

  if (!result.ok) {
    if (result.error === "game_full") {
      await sendMessage({ chat_id: msg.chat.id, text: t("player.full", lang) });
    } else {
      await sendMessage({ chat_id: msg.chat.id, text: t("error.generic", lang) });
    }
    return;
  }

  createPlayer(deps.sheets, {
    game_id: game.game_id,
    user_id: userId,
    username,
    hand: [],
    score: 0,
    lang,
  });

  await sendMessage({
    chat_id: msg.chat.id,
    text: t("player.joined", lang, { username }),
  });
}

export async function handleStartGame(update: Update, deps: CommandDeps): Promise<void> {
  const msg = extractMessage(update);
  if (!msg) return;

  const chatId = String(msg.chat.id);
  const lang = "en";

  const game = getActiveGameByChat(deps.sheets, chatId);
  if (!game) {
    await sendMessage({ chat_id: msg.chat.id, text: t("game.not_found", lang) });
    return;
  }

  const players = getGamePlayers(deps.sheets, game.game_id);
  const state = gameRecordToState(game, players);
  const result = startGame(state);

  if (!result.ok) {
    if (result.error === "not_enough_players") {
      await sendMessage({ chat_id: msg.chat.id, text: t("game.not_enough_players", lang) });
    } else {
      await sendMessage({ chat_id: msg.chat.id, text: t("error.generic", lang) });
    }
    return;
  }

  updateGame(deps.sheets, game.game_id, { status: "active" });
  await sendMessage({ chat_id: msg.chat.id, text: t("game.started", lang) });
}

export async function handleStats(update: Update, deps: CommandDeps): Promise<void> {
  const msg = extractMessage(update);
  if (!msg || !msg.from) return;

  const userId = String(msg.from.id);
  const lang = "en";

  const entry = getLeaderboardEntry(deps.sheets, userId);
  if (!entry) {
    await sendMessage({ chat_id: msg.chat.id, text: t("leaderboard.empty", lang) });
    return;
  }

  const text = t("leaderboard.entry", lang, {
    rank: "-",
    username: entry.username,
    score: entry.total_score,
    wins: entry.total_wins,
  });
  await sendMessage({ chat_id: msg.chat.id, text });
}

export async function handleLeaderboard(update: Update, deps: CommandDeps): Promise<void> {
  const msg = extractMessage(update);
  if (!msg) return;

  const lang = "en";
  const top = getTopPlayers(deps.sheets, 5);

  if (top.length === 0) {
    await sendMessage({ chat_id: msg.chat.id, text: t("leaderboard.empty", lang) });
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

  await sendMessage({ chat_id: msg.chat.id, text: lines.join("\n") });
}

export async function dispatch(update: Update, deps: CommandDeps): Promise<void> {
  const msg = extractMessage(update);
  const text = msg?.text ?? "";

  const command = text.split(" ")[0].split("@")[0];

  switch (command) {
    case "/start":
      return handleStart(update, deps);
    case "/newgame":
      return handleNewGame(update, deps);
    case "/join":
      return handleJoin(update, deps);
    case "/startgame":
      return handleStartGame(update, deps);
    case "/stats":
      return handleStats(update, deps);
    case "/leaderboard":
      return handleLeaderboard(update, deps);
  }
}
