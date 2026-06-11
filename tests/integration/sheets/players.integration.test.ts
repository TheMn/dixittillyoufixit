import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../../src/sheets/client";
import {
  createPlayer,
  getPlayer,
  getGamePlayers,
  updatePlayer,
  deletePlayer,
  type PlayerRecord,
} from "../../../src/sheets/players";

describe.skipIf(!process.env["TEST_SPREADSHEET_ID"])(
  "players — real sheet (TEST_SPREADSHEET_ID)",
  () => {
    it.todo("create a player row and read it back from the real test sheet");
    it.todo("update player score and verify persistence");
    it.todo("query all players by game_id from the real sheet");
  }
);

describe("players — multi-step integration flows (MockSheetsClient)", () => {
  let client: MockSheetsClient;

  const PLAYERS: PlayerRecord[] = [
    { game_id: "g1", user_id: "u1", username: "alice", hand: ["c1", "c2", "c3"], score: 0, lang: "en" },
    { game_id: "g1", user_id: "u2", username: "bob",   hand: ["c4", "c5", "c6"], score: 0, lang: "fa" },
    { game_id: "g1", user_id: "u3", username: "carol", hand: ["c7", "c8", "c9"], score: 0, lang: "en" },
  ];

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  it("should support a full lifecycle: create, read, update, delete", () => {
    createPlayer(client, PLAYERS[0]);
    expect(getPlayer(client, "g1", "u1")).toMatchObject({ username: "alice", score: 0 });

    updatePlayer(client, "g1", "u1", { score: 7, hand: ["c10"] });
    const updated = getPlayer(client, "g1", "u1")!;
    expect(updated.score).toBe(7);
    expect(updated.hand).toEqual(["c10"]);
    expect(updated.username).toBe("alice");

    deletePlayer(client, "g1", "u1");
    expect(getPlayer(client, "g1", "u1")).toBeNull();
  });

  it("should retrieve all 3 players for a game after bulk creation", () => {
    PLAYERS.forEach(p => createPlayer(client, p));
    const players = getGamePlayers(client, "g1");
    expect(players).toHaveLength(3);
    expect(players.map(p => p.user_id).sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("should isolate players across games: same user, different game records", () => {
    createPlayer(client, PLAYERS[0]);
    createPlayer(client, { ...PLAYERS[0], game_id: "g2", score: 20 });

    updatePlayer(client, "g1", "u1", { score: 5 });
    expect(getPlayer(client, "g1", "u1")!.score).toBe(5);
    expect(getPlayer(client, "g2", "u1")!.score).toBe(20);
  });

  it("should simulate a full round scoring update across all players", () => {
    PLAYERS.forEach(p => createPlayer(client, p));

    const scoreDeltas: Record<string, number> = { u1: 3, u2: 0, u3: 3 };
    for (const [userId, delta] of Object.entries(scoreDeltas)) {
      const current = getPlayer(client, "g1", userId)!;
      updatePlayer(client, "g1", userId, { score: current.score + delta });
    }

    expect(getPlayer(client, "g1", "u1")!.score).toBe(3);
    expect(getPlayer(client, "g1", "u2")!.score).toBe(0);
    expect(getPlayer(client, "g1", "u3")!.score).toBe(3);
  });
});
