import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../../src/sheets/client";
import {
  upsertLeaderboard,
  getLeaderboardEntry,
  getTopPlayers,
  deleteLeaderboardEntry,
  type LeaderboardRecord,
} from "../../../src/sheets/leaderboard";

describe.skipIf(!process.env["TEST_SPREADSHEET_ID"])(
  "leaderboard — real sheet (TEST_SPREADSHEET_ID)",
  () => {
    it.todo("upsert a leaderboard entry and read it back from the real test sheet");
    it.todo("update an entry idempotently and verify no duplicate rows appear");
    it.todo("getTopPlayers returns results sorted by total_score from the real sheet");
  }
);

describe("leaderboard — multi-step integration flows (MockSheetsClient)", () => {
  let client: MockSheetsClient;

  const makeEntry = (userId: string, score: number, wins = 0): LeaderboardRecord => ({
    user_id: userId,
    username: `user_${userId}`,
    total_games: 10,
    total_wins: wins,
    total_score: score,
    last_played: "2026-06-11",
  });

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  it("should complete a full lifecycle: upsert, read, update, delete", () => {
    upsertLeaderboard(client, makeEntry("u1", 30));
    expect(getLeaderboardEntry(client, "u1")!.total_score).toBe(30);

    upsertLeaderboard(client, makeEntry("u1", 45, 3));
    const updated = getLeaderboardEntry(client, "u1")!;
    expect(updated.total_score).toBe(45);
    expect(updated.total_wins).toBe(3);

    deleteLeaderboardEntry(client, "u1");
    expect(getLeaderboardEntry(client, "u1")).toBeNull();
  });

  it("should produce correct top-5 leaderboard after a series of game results", () => {
    const scores = [
      { id: "u1", score: 80 },
      { id: "u2", score: 120 },
      { id: "u3", score: 60 },
      { id: "u4", score: 95 },
      { id: "u5", score: 45 },
      { id: "u6", score: 110 },
    ];
    scores.forEach(({ id, score }) => upsertLeaderboard(client, makeEntry(id, score)));

    const top5 = getTopPlayers(client, 5);
    expect(top5).toHaveLength(5);
    expect(top5.map(p => p.user_id)).toEqual(["u2", "u6", "u4", "u1", "u3"]);
  });

  it("should update entry idempotently and result in only one row", () => {
    const base = makeEntry("u1", 0);
    for (let game = 1; game <= 5; game++) {
      upsertLeaderboard(client, { ...base, total_games: game, total_score: game * 15 });
    }
    expect(getTopPlayers(client, 100)).toHaveLength(1);
    expect(getLeaderboardEntry(client, "u1")!.total_score).toBe(75);
  });

  it("should not affect other entries when one is deleted", () => {
    upsertLeaderboard(client, makeEntry("u1", 50));
    upsertLeaderboard(client, makeEntry("u2", 70));
    deleteLeaderboardEntry(client, "u1");

    expect(getLeaderboardEntry(client, "u1")).toBeNull();
    expect(getLeaderboardEntry(client, "u2")!.total_score).toBe(70);
  });
});
