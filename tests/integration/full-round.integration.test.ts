import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../src/sheets/client";
import { createGame } from "../../src/sheets/games";
import { createPlayer, updatePlayer } from "../../src/sheets/players";
import { createRound as createRoundRecord } from "../../src/sheets/rounds";
import { createCard } from "../../src/sheets/cards";
import { processRoundEnd } from "../../src/game/flow";
import { WIN_SCORE } from "../../src/game/engine";
import type { GameRecord } from "../../src/sheets/games";
import type { PlayerRecord } from "../../src/sheets/players";
import type { RoundRecord } from "../../src/sheets/rounds";

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

function buildGame(): GameRecord {
  return {
    game_id: "g1",
    chat_id: "c1",
    status: "active",
    current_round: 1,
    storyteller_id: "p1",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function buildPlayers(): PlayerRecord[] {
  return [
    { game_id: "g1", user_id: "p1", username: "Alice", hand: ["c1","c2","c3","c4","c5","c6"], score: 0, lang: "en" },
    { game_id: "g1", user_id: "p2", username: "Bob",   hand: ["c7","c8","c9","c10","c11","c12"], score: 0, lang: "en" },
    { game_id: "g1", user_id: "p3", username: "Carol", hand: ["c13","c14","c15","c16","c17","c18"], score: 0, lang: "en" },
  ];
}

function buildRound(): RoundRecord {
  // p1 = storyteller (card c1), p2 submits c7, p3 submits c13
  // p2 votes for storyteller's card (c1) — correct
  // p3 votes for p2's card (c7) — wrong
  return {
    round_id: "r1",
    game_id: "g1",
    round_num: 1,
    clue: "flying castle",
    storyteller_card: "c1",
    submissions: { p2: "c7", p3: "c13" },
    votes: { p2: "c1", p3: "c7" },
    status: "revealing",
  };
}

function seedClient(client: MockSheetsClient, game: GameRecord, players: PlayerRecord[], round: RoundRecord): void {
  createGame(client, game);
  for (const p of players) createPlayer(client, p);
  createRoundRecord(client, round);
  // Hand cards are tracked in player rows only; mark them as in_use in Cards sheet
  for (let i = 1; i <= 18; i++) {
    createCard(client, { card_id: `c${i}`, file_id: "", drive_url: "", in_use: true });
  }
  // Available deck cards for replenishment
  for (let i = 19; i <= 30; i++) {
    createCard(client, { card_id: `c${i}`, file_id: "", drive_url: "", in_use: false });
  }
}

// ---------------------------------------------------------------------------

describe("processRoundEnd — full round integration", () => {
  let client: MockSheetsClient;
  let game: GameRecord;
  let players: PlayerRecord[];
  let round: RoundRecord;

  beforeEach(() => {
    client = new MockSheetsClient();
    game = buildGame();
    players = buildPlayers();
    round = buildRound();
    seedClient(client, game, players, round);
  });

  it("should calculate scores correctly and save them to the Players sheet", () => {
    // Votes: p2 correct (+3), p3 wrong (+0); p2's card got 1 vote (+1 bonus); storyteller (p1) +3
    const result = processRoundEnd(client, game, round, players);

    const p1 = result.updatedPlayers.find(p => p.user_id === "p1")!;
    const p2 = result.updatedPlayers.find(p => p.user_id === "p2")!;
    const p3 = result.updatedPlayers.find(p => p.user_id === "p3")!;

    expect(p1.score).toBe(3);  // storyteller, partial correct → +3
    expect(p2.score).toBe(4);  // correct guess (+3) + 1 vote on their card (+1)
    expect(p3.score).toBe(0);  // wrong guess, no votes on their card

    // Scores persisted in Players sheet
    const p1Row = client.findRow("Players", "player_key", "g1:p1");
    expect(p1Row?.score).toBe("3");
    const p2Row = client.findRow("Players", "player_key", "g1:p2");
    expect(p2Row?.score).toBe("4");
  });

  it("should remove submitted cards from each player's hand", () => {
    const result = processRoundEnd(client, game, round, players);

    const p1 = result.updatedPlayers.find(p => p.user_id === "p1")!;
    const p2 = result.updatedPlayers.find(p => p.user_id === "p2")!;
    const p3 = result.updatedPlayers.find(p => p.user_id === "p3")!;

    expect(p1.hand).not.toContain("c1");   // storyteller's submitted card
    expect(p2.hand).not.toContain("c7");   // p2's submitted card
    expect(p3.hand).not.toContain("c13");  // p3's submitted card
  });

  it("should replenish each player's hand back to 6 cards", () => {
    const result = processRoundEnd(client, game, round, players);

    for (const p of result.updatedPlayers) {
      expect(p.hand).toHaveLength(6);
    }
  });

  it("should mark drawn cards as in_use in the Cards sheet", () => {
    processRoundEnd(client, game, round, players);

    // c19, c20, c21 should now be in_use (3 players each needed 1 card)
    expect(client.findRow("Cards", "card_id", "c19")?.in_use).toBe("true");
    expect(client.findRow("Cards", "card_id", "c20")?.in_use).toBe("true");
    expect(client.findRow("Cards", "card_id", "c21")?.in_use).toBe("true");

    // c22 and beyond should still be available
    expect(client.findRow("Cards", "card_id", "c22")?.in_use).toBe("false");
  });

  it("should mark the round as done in the Rounds sheet", () => {
    processRoundEnd(client, game, round, players);

    const roundRow = client.findRow("Rounds", "round_id", "r1");
    expect(roundRow?.status).toBe("done");
  });

  it("should rotate storyteller to the next player", () => {
    const result = processRoundEnd(client, game, round, players);

    // p1 was storyteller → next is p2
    expect(result.nextStorytellerId).toBe("p2");
    expect(result.nextRoundNum).toBe(2);
  });

  it("should update game round number and storyteller in the Games sheet", () => {
    processRoundEnd(client, game, round, players);

    const gameRow = client.findRow("Games", "game_id", "g1");
    expect(gameRow?.current_round).toBe("2");
    expect(gameRow?.storyteller_id).toBe("p2");
  });

  it("should not end the game when no player has reached WIN_SCORE", () => {
    const result = processRoundEnd(client, game, round, players);

    expect(result.gameDone).toBe(false);
    expect(result.winner).toBeNull();

    const gameRow = client.findRow("Games", "game_id", "g1");
    expect(gameRow?.status).toBe("active");
  });

  it("should end the game when a player reaches WIN_SCORE", () => {
    // Give p1 enough score so that after +3 they hit WIN_SCORE (30)
    updatePlayer(client, "g1", "p1", { score: WIN_SCORE - 3 });
    const boostedPlayers = players.map(p =>
      p.user_id === "p1" ? { ...p, score: WIN_SCORE - 3 } : p
    );

    const result = processRoundEnd(client, game, round, boostedPlayers);

    expect(result.gameDone).toBe(true);
    expect(result.winner?.user_id).toBe("p1");

    const gameRow = client.findRow("Games", "game_id", "g1");
    expect(gameRow?.status).toBe("ended");
  });

  it("should update leaderboard for all players when game ends", () => {
    updatePlayer(client, "g1", "p1", { score: WIN_SCORE - 3 });
    const boostedPlayers = players.map(p =>
      p.user_id === "p1" ? { ...p, score: WIN_SCORE - 3 } : p
    );

    processRoundEnd(client, game, round, boostedPlayers);

    const lb1 = client.findRow("Leaderboard", "user_id", "p1");
    const lb2 = client.findRow("Leaderboard", "user_id", "p2");
    const lb3 = client.findRow("Leaderboard", "user_id", "p3");

    expect(lb1).toBeTruthy();
    expect(lb1?.total_wins).toBe("1");   // winner
    expect(lb1?.total_games).toBe("1");

    expect(lb2?.total_wins).toBe("0");   // not the winner
    expect(lb2?.total_games).toBe("1");

    expect(lb3?.total_wins).toBe("0");
    expect(lb3?.total_games).toBe("1");
  });

  it("should end the game when the deck cannot fully replenish all hands", () => {
    // Use a client with no available cards so replenishment fails
    const emptyDeckClient = new MockSheetsClient();
    const emptyGame = buildGame();
    const emptyPlayers = buildPlayers();
    const emptyRound = buildRound();

    createGame(emptyDeckClient, emptyGame);
    for (const p of emptyPlayers) createPlayer(emptyDeckClient, p);
    createRoundRecord(emptyDeckClient, emptyRound);
    // No available deck cards — only hand cards (in_use: true)
    for (let i = 1; i <= 18; i++) {
      createCard(emptyDeckClient, { card_id: `c${i}`, file_id: "", drive_url: "", in_use: true });
    }

    const result = processRoundEnd(emptyDeckClient, emptyGame, emptyRound, emptyPlayers);

    // Players each lost 1 card and got 0 back → hand.length = 5 < 6 → handsShort → gameDone
    expect(result.gameDone).toBe(true);
    for (const p of result.updatedPlayers) {
      expect(p.hand.length).toBeLessThan(6);
    }
  });

  it("should correctly rotate storyteller across multiple rounds", () => {
    // Round 1: p1 is storyteller → next should be p2
    const r1 = processRoundEnd(client, game, round, players);
    expect(r1.nextStorytellerId).toBe("p2");

    // Round 2: p2 is storyteller
    const game2: GameRecord = { ...game, current_round: 2, storyteller_id: "p2" };
    const round2: RoundRecord = {
      ...buildRound(),
      round_id: "r2",
      round_num: 2,
      storyteller_card: "c7",
      submissions: { p1: "c2", p3: "c14" },
      votes: { p1: "c7", p3: "c2" },
    };
    createRoundRecord(client, round2);

    const r2 = processRoundEnd(client, game2, round2, r1.updatedPlayers);
    expect(r2.nextStorytellerId).toBe("p3");
  });
});
