import { GameState, GamePlayer } from "./state";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const HAND_SIZE = 6;
export const WIN_SCORE = 30;

export type EngineError =
  | "game_not_in_lobby"
  | "game_not_active"
  | "player_already_joined"
  | "game_full"
  | "not_enough_players"
  | "not_enough_cards";

export type EngineResult<T> =
  | { ok: true; state: T }
  | { ok: false; error: EngineError };

export function createGame(gameId: string, chatId: string): GameState {
  return {
    gameId,
    chatId,
    status: "lobby",
    players: [],
    deck: [],
    currentRound: 0,
    storytellerIndex: 0,
    createdAt: Date.now(),
  };
}

export function addPlayer(
  state: GameState,
  player: Omit<GamePlayer, "hand" | "score">
): EngineResult<GameState> {
  if (state.status !== "lobby") {
    return { ok: false, error: "game_not_in_lobby" };
  }
  if (state.players.some((p) => p.id === player.id)) {
    return { ok: false, error: "player_already_joined" };
  }
  if (state.players.length >= MAX_PLAYERS) {
    return { ok: false, error: "game_full" };
  }
  return {
    ok: true,
    state: {
      ...state,
      players: [...state.players, { ...player, hand: [], score: 0 }],
    },
  };
}

export function loadDeck(state: GameState, cardIds: string[]): GameState {
  return { ...state, deck: [...cardIds] };
}

export function dealCards(state: GameState): EngineResult<GameState> {
  if (state.status !== "lobby") {
    return { ok: false, error: "game_not_in_lobby" };
  }
  const totalNeeded = state.players.length * HAND_SIZE;
  if (state.deck.length < totalNeeded) {
    return { ok: false, error: "not_enough_cards" };
  }

  const deck = [...state.deck];
  const players = state.players.map((p) => {
    const hand = deck.splice(0, HAND_SIZE);
    return { ...p, hand };
  });

  return { ok: true, state: { ...state, players, deck } };
}

export function startGame(state: GameState): EngineResult<GameState> {
  if (state.status !== "lobby") {
    return { ok: false, error: "game_not_in_lobby" };
  }
  if (state.players.length < MIN_PLAYERS) {
    return { ok: false, error: "not_enough_players" };
  }
  return {
    ok: true,
    state: { ...state, status: "active", currentRound: 1, storytellerIndex: 0 },
  };
}

export function nextRound(state: GameState): EngineResult<GameState> {
  if (state.status !== "active") {
    return { ok: false, error: "game_not_active" };
  }

  const hasWinner = state.players.some((p) => p.score >= WIN_SCORE);
  const deckEmpty = state.deck.length === 0;
  if (hasWinner || deckEmpty) {
    return { ok: true, state: { ...state, status: "ended" } };
  }

  const nextStoryteller = (state.storytellerIndex + 1) % state.players.length;
  return {
    ok: true,
    state: {
      ...state,
      currentRound: state.currentRound + 1,
      storytellerIndex: nextStoryteller,
    },
  };
}

export function applyScores(
  state: GameState,
  deltas: Record<string, number>
): GameState {
  const players = state.players.map((p) => ({
    ...p,
    score: p.score + (deltas[p.id] ?? 0),
  }));
  return { ...state, players };
}

export function replenishHands(state: GameState): EngineResult<GameState> {
  if (state.status !== "active") {
    return { ok: false, error: "game_not_active" };
  }

  const deck = [...state.deck];
  const players = state.players.map((p) => {
    const needed = HAND_SIZE - p.hand.length;
    const drawn = deck.splice(0, needed);
    return { ...p, hand: [...p.hand, ...drawn] };
  });

  return { ok: true, state: { ...state, players, deck } };
}

export function endGame(state: GameState): EngineResult<GameState> {
  if (state.status !== "active") {
    return { ok: false, error: "game_not_active" };
  }
  return { ok: true, state: { ...state, status: "ended" } };
}
