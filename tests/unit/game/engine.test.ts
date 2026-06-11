import { describe, it, expect, beforeEach } from "vitest";
import {
  createGame,
  addPlayer,
  loadDeck,
  dealCards,
  startGame,
  nextRound,
  applyScores,
  replenishHands,
  endGame,
  MIN_PLAYERS,
  MAX_PLAYERS,
  HAND_SIZE,
  WIN_SCORE,
} from "../../../src/game/engine";
import { GameState, currentStoryteller } from "../../../src/game/state";

function makeDeck(size: number): string[] {
  return Array.from({ length: size }, (_, i) => `card-${i}`);
}

function makePlayer(id: string) {
  return { id, username: `user_${id}` };
}

function lobbyWithPlayers(count: number): GameState {
  let state = createGame("g1", "chat1");
  for (let i = 0; i < count; i++) {
    const result = addPlayer(state, makePlayer(`p${i}`));
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
  return state;
}

function readyGame(playerCount: number, extraCards = 0): GameState {
  let state = lobbyWithPlayers(playerCount);
  state = loadDeck(state, makeDeck(playerCount * HAND_SIZE + extraCards));
  const dealt = dealCards(state);
  if (!dealt.ok) throw new Error(dealt.error);
  const started = startGame(dealt.state);
  if (!started.ok) throw new Error(started.error);
  return started.state;
}

// ---------------------------------------------------------------------------

describe("createGame", () => {
  it("should produce a valid initial lobby state", () => {
    const state = createGame("g1", "chat42");
    expect(state.gameId).toBe("g1");
    expect(state.chatId).toBe("chat42");
    expect(state.status).toBe("lobby");
    expect(state.players).toHaveLength(0);
    expect(state.deck).toHaveLength(0);
    expect(state.currentRound).toBe(0);
    expect(state.storytellerIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("addPlayer", () => {
  it("should add a player to a lobby game", () => {
    const state = createGame("g1", "chat1");
    const result = addPlayer(state, makePlayer("p1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players).toHaveLength(1);
    expect(result.state.players[0].id).toBe("p1");
    expect(result.state.players[0].score).toBe(0);
    expect(result.state.players[0].hand).toHaveLength(0);
  });

  it("should reject a duplicate player", () => {
    let state = createGame("g1", "chat1");
    const r1 = addPlayer(state, makePlayer("p1"));
    if (!r1.ok) throw new Error();
    state = r1.state;
    const r2 = addPlayer(state, makePlayer("p1"));
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.error).toBe("player_already_joined");
  });

  it("should reject a player when the game is full (6 players)", () => {
    const state = lobbyWithPlayers(MAX_PLAYERS);
    const result = addPlayer(state, makePlayer("extra"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_full");
  });

  it("should reject when game is not in lobby", () => {
    const state = readyGame(MIN_PLAYERS);
    const result = addPlayer(state, makePlayer("late"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_not_in_lobby");
  });

  it("should allow up to MAX_PLAYERS players", () => {
    const state = lobbyWithPlayers(MAX_PLAYERS);
    expect(state.players).toHaveLength(MAX_PLAYERS);
  });
});

// ---------------------------------------------------------------------------

describe("dealCards", () => {
  it("should give each player exactly HAND_SIZE cards", () => {
    let state = lobbyWithPlayers(4);
    state = loadDeck(state, makeDeck(4 * HAND_SIZE));
    const result = dealCards(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.state.players) {
      expect(p.hand).toHaveLength(HAND_SIZE);
    }
  });

  it("should produce no duplicate cards across all hands", () => {
    let state = lobbyWithPlayers(4);
    state = loadDeck(state, makeDeck(4 * HAND_SIZE));
    const result = dealCards(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const allCards = result.state.players.flatMap((p) => p.hand);
    expect(new Set(allCards).size).toBe(allCards.length);
  });

  it("should remove dealt cards from the deck", () => {
    const playerCount = 3;
    let state = lobbyWithPlayers(playerCount);
    state = loadDeck(state, makeDeck(playerCount * HAND_SIZE + 5));
    const result = dealCards(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.deck).toHaveLength(5);
  });

  it("should fail when there are not enough cards in the deck", () => {
    let state = lobbyWithPlayers(4);
    state = loadDeck(state, makeDeck(4 * HAND_SIZE - 1));
    const result = dealCards(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not_enough_cards");
  });

  it("should fail when game is not in lobby", () => {
    const state = readyGame(MIN_PLAYERS);
    const result = dealCards(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_not_in_lobby");
  });
});

// ---------------------------------------------------------------------------

describe("startGame", () => {
  it("should transition lobby to active with round 1", () => {
    let state = lobbyWithPlayers(MIN_PLAYERS);
    state = loadDeck(state, makeDeck(MIN_PLAYERS * HAND_SIZE));
    const dealt = dealCards(state);
    if (!dealt.ok) throw new Error();
    const result = startGame(dealt.state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("active");
    expect(result.state.currentRound).toBe(1);
    expect(result.state.storytellerIndex).toBe(0);
  });

  it("should fail when there are fewer than MIN_PLAYERS players", () => {
    let state = lobbyWithPlayers(MIN_PLAYERS - 1);
    state = loadDeck(state, makeDeck((MIN_PLAYERS - 1) * HAND_SIZE));
    const dealt = dealCards(state);
    if (!dealt.ok) throw new Error();
    const result = startGame(dealt.state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not_enough_players");
  });

  it("should fail when game is not in lobby", () => {
    const state = readyGame(MIN_PLAYERS);
    const result = startGame(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_not_in_lobby");
  });
});

// ---------------------------------------------------------------------------

describe("nextRound", () => {
  it("should increment round counter", () => {
    const state = readyGame(MIN_PLAYERS, 10);
    const result = nextRound(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.currentRound).toBe(2);
  });

  it("should rotate storyteller to next player", () => {
    const state = readyGame(4, 10);
    expect(state.storytellerIndex).toBe(0);
    const r1 = nextRound(state);
    if (!r1.ok) throw new Error();
    expect(r1.state.storytellerIndex).toBe(1);
    const r2 = nextRound(r1.state);
    if (!r2.ok) throw new Error();
    expect(r2.state.storytellerIndex).toBe(2);
  });

  it("should wrap storyteller index back to 0 after last player", () => {
    let state = readyGame(MIN_PLAYERS, 10);
    for (let i = 0; i < MIN_PLAYERS; i++) {
      const result = nextRound(state);
      if (!result.ok) throw new Error();
      state = result.state;
    }
    expect(state.storytellerIndex).toBe(0);
  });

  it("should end game when deck is empty", () => {
    const state = readyGame(MIN_PLAYERS, 0);
    expect(state.deck).toHaveLength(0);
    const result = nextRound(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("ended");
  });

  it("should end game when a player reaches WIN_SCORE", () => {
    let state = readyGame(MIN_PLAYERS, 10);
    state = applyScores(state, { p0: WIN_SCORE });
    const result = nextRound(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("ended");
  });

  it("should fail when game is not active", () => {
    const state = createGame("g1", "chat1");
    const result = nextRound(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_not_active");
  });
});

// ---------------------------------------------------------------------------

describe("endGame", () => {
  it("should set status to ended", () => {
    const state = readyGame(MIN_PLAYERS, 10);
    const result = endGame(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("ended");
  });

  it("should fail when game is not active", () => {
    const state = createGame("g1", "chat1");
    const result = endGame(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_not_active");
  });
});

// ---------------------------------------------------------------------------

describe("currentStoryteller", () => {
  it("should return the player at storytellerIndex", () => {
    const state = readyGame(4, 10);
    const teller = currentStoryteller(state);
    expect(teller.id).toBe(state.players[0].id);
  });
});

// ---------------------------------------------------------------------------

describe("applyScores", () => {
  it("should add deltas to each player score", () => {
    const state = readyGame(3, 10);
    const updated = applyScores(state, { p0: 3, p1: 2 });
    const p0 = updated.players.find((p) => p.id === "p0")!;
    const p1 = updated.players.find((p) => p.id === "p1")!;
    const p2 = updated.players.find((p) => p.id === "p2")!;
    expect(p0.score).toBe(3);
    expect(p1.score).toBe(2);
    expect(p2.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("replenishHands", () => {
  it("should refill each player hand back to HAND_SIZE", () => {
    let state = readyGame(3, 6);
    // Simulate each player having used one card
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, hand: p.hand.slice(1) })),
    };
    const result = replenishHands(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.state.players) {
      expect(p.hand).toHaveLength(HAND_SIZE);
    }
  });

  it("should not duplicate cards between hands and deck after replenish", () => {
    let state = readyGame(3, 6);
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, hand: p.hand.slice(1) })),
    };
    const result = replenishHands(state);
    if (!result.ok) throw new Error();
    const allCards = [
      ...result.state.players.flatMap((p) => p.hand),
      ...result.state.deck,
    ];
    expect(new Set(allCards).size).toBe(allCards.length);
  });

  it("should fail when game is not active", () => {
    const state = createGame("g1", "chat1");
    const result = replenishHands(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_not_active");
  });
});

// ---------------------------------------------------------------------------

describe("player count scenarios", () => {
  it.each([3, 4, 5, 6] as const)(
    "should handle a %d-player game correctly",
    (count) => {
      const state = readyGame(count, 10);
      expect(state.status).toBe("active");
      expect(state.players).toHaveLength(count);
      for (const p of state.players) {
        expect(p.hand).toHaveLength(HAND_SIZE);
      }
    }
  );
});
