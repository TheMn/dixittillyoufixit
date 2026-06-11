import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../../src/sheets/client";
import {
  upsertLeaderboard,
  getLeaderboardEntry,
  getTopPlayers,
  deleteLeaderboardEntry,
  type LeaderboardRecord,
} from "../../../src/sheets/leaderboard";

const BASE: LeaderboardRecord = {
  user_id: "u1",
  username: "alice",
  total_games: 5,
  total_wins: 2,
  total_score: 45,
  last_played: "2026-06-11",
};

describe("leaderboard sheet module", () => {
  let client: MockSheetsClient;

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  describe("upsertLeaderboard / getLeaderboardEntry", () => {
    it("should create a record that can be read back correctly", () => {
      upsertLeaderboard(client, BASE);
      expect(getLeaderboardEntry(client, "u1")).toEqual(BASE);
    });

    it("should deserialise numeric fields as numbers", () => {
      upsertLeaderboard(client, BASE);
      const entry = getLeaderboardEntry(client, "u1")!;
      expect(typeof entry.total_games).toBe("number");
      expect(typeof entry.total_wins).toBe("number");
      expect(typeof entry.total_score).toBe("number");
    });

    it("should return null for a non-existent user_id", () => {
      expect(getLeaderboardEntry(client, "u99")).toBeNull();
    });

    it("should update an existing entry without creating a duplicate", () => {
      upsertLeaderboard(client, BASE);
      upsertLeaderboard(client, { ...BASE, total_games: 6, total_score: 58 });

      const entry = getLeaderboardEntry(client, "u1")!;
      expect(entry.total_games).toBe(6);
      expect(entry.total_score).toBe(58);
    });

    it("should result in exactly one row after multiple upserts", () => {
      upsertLeaderboard(client, BASE);
      upsertLeaderboard(client, { ...BASE, total_games: 6 });
      upsertLeaderboard(client, { ...BASE, total_games: 7 });

      expect(getTopPlayers(client, 100)).toHaveLength(1);
    });
  });

  describe("getTopPlayers", () => {
    it("should return players sorted by total_score descending", () => {
      upsertLeaderboard(client, { ...BASE, user_id: "u1", total_score: 20 });
      upsertLeaderboard(client, { ...BASE, user_id: "u2", total_score: 50 });
      upsertLeaderboard(client, { ...BASE, user_id: "u3", total_score: 35 });

      const top = getTopPlayers(client, 10);
      expect(top.map(p => p.user_id)).toEqual(["u2", "u3", "u1"]);
    });

    it("should respect the limit parameter", () => {
      for (let i = 1; i <= 6; i++) {
        upsertLeaderboard(client, { ...BASE, user_id: `u${i}`, total_score: i * 10 });
      }
      expect(getTopPlayers(client, 3)).toHaveLength(3);
    });

    it("should return the top player first", () => {
      upsertLeaderboard(client, { ...BASE, user_id: "u1", total_score: 10 });
      upsertLeaderboard(client, { ...BASE, user_id: "u2", total_score: 100 });

      expect(getTopPlayers(client, 5)[0].user_id).toBe("u2");
    });

    it("should return an empty array when the leaderboard is empty", () => {
      expect(getTopPlayers(client, 5)).toEqual([]);
    });
  });

  describe("deleteLeaderboardEntry", () => {
    it("should remove the entry so it is no longer returned", () => {
      upsertLeaderboard(client, BASE);
      deleteLeaderboardEntry(client, "u1");
      expect(getLeaderboardEntry(client, "u1")).toBeNull();
    });

    it("should not affect other entries when one is deleted", () => {
      upsertLeaderboard(client, BASE);
      upsertLeaderboard(client, { ...BASE, user_id: "u2", username: "bob" });
      deleteLeaderboardEntry(client, "u1");
      expect(getLeaderboardEntry(client, "u2")).not.toBeNull();
    });

    it("should throw when user_id does not exist", () => {
      expect(() => deleteLeaderboardEntry(client, "u99")).toThrow();
    });
  });
});
