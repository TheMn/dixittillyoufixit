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

const BASE: PlayerRecord = {
  game_id: "g1",
  user_id: "u1",
  username: "alice",
  hand: ["c1", "c2", "c3"],
  score: 0,
  lang: "en",
};

describe("players sheet module", () => {
  let client: MockSheetsClient;

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  describe("createPlayer / getPlayer", () => {
    it("should create a record that can be read back correctly", () => {
      createPlayer(client, BASE);
      expect(getPlayer(client, "g1", "u1")).toEqual(BASE);
    });

    it("should deserialise the hand JSON array correctly", () => {
      createPlayer(client, { ...BASE, hand: ["c10", "c20"] });
      expect(getPlayer(client, "g1", "u1")!.hand).toEqual(["c10", "c20"]);
    });

    it("should deserialise score as a number", () => {
      createPlayer(client, { ...BASE, score: 7 });
      expect(getPlayer(client, "g1", "u1")!.score).toBe(7);
    });

    it("should return null for a non-existent (game, user) pair", () => {
      createPlayer(client, BASE);
      expect(getPlayer(client, "g1", "u99")).toBeNull();
      expect(getPlayer(client, "g99", "u1")).toBeNull();
    });

    it("should isolate same user_id across different games", () => {
      createPlayer(client, BASE);
      createPlayer(client, { ...BASE, game_id: "g2", score: 15 });
      expect(getPlayer(client, "g1", "u1")!.score).toBe(0);
      expect(getPlayer(client, "g2", "u1")!.score).toBe(15);
    });
  });

  describe("getGamePlayers", () => {
    it("should return all players in a game", () => {
      createPlayer(client, BASE);
      createPlayer(client, { ...BASE, user_id: "u2", username: "bob" });
      createPlayer(client, { ...BASE, user_id: "u3", username: "carol" });
      createPlayer(client, { ...BASE, game_id: "g2", user_id: "u4", username: "dave" });

      const players = getGamePlayers(client, "g1");
      expect(players).toHaveLength(3);
      expect(players.map(p => p.username)).toEqual(["alice", "bob", "carol"]);
    });

    it("should return an empty array when no players exist for a game", () => {
      expect(getGamePlayers(client, "g99")).toEqual([]);
    });

    it("should return all players for the correct game when multiple games exist", () => {
      createPlayer(client, BASE);
      createPlayer(client, { ...BASE, game_id: "g2", user_id: "u2" });
      expect(getGamePlayers(client, "g2")).toHaveLength(1);
    });
  });

  describe("updatePlayer", () => {
    it("should persist a score change", () => {
      createPlayer(client, BASE);
      updatePlayer(client, "g1", "u1", { score: 9 });
      expect(getPlayer(client, "g1", "u1")!.score).toBe(9);
    });

    it("should persist a hand change", () => {
      createPlayer(client, BASE);
      updatePlayer(client, "g1", "u1", { hand: ["c7", "c8"] });
      expect(getPlayer(client, "g1", "u1")!.hand).toEqual(["c7", "c8"]);
    });

    it("should persist a lang change", () => {
      createPlayer(client, BASE);
      updatePlayer(client, "g1", "u1", { lang: "fa" });
      expect(getPlayer(client, "g1", "u1")!.lang).toBe("fa");
    });

    it("should not overwrite unpatched fields", () => {
      createPlayer(client, BASE);
      updatePlayer(client, "g1", "u1", { score: 5 });
      const updated = getPlayer(client, "g1", "u1")!;
      expect(updated.username).toBe("alice");
      expect(updated.hand).toEqual(["c1", "c2", "c3"]);
    });

    it("should update only the correct (game, user) row when two games have the same user", () => {
      createPlayer(client, BASE);
      createPlayer(client, { ...BASE, game_id: "g2", score: 10 });
      updatePlayer(client, "g1", "u1", { score: 99 });
      expect(getPlayer(client, "g1", "u1")!.score).toBe(99);
      expect(getPlayer(client, "g2", "u1")!.score).toBe(10);
    });

    it("should throw when the (game, user) pair does not exist", () => {
      expect(() => updatePlayer(client, "g99", "u1", { score: 1 })).toThrow();
    });
  });

  describe("deletePlayer", () => {
    it("should remove the player so it is no longer returned", () => {
      createPlayer(client, BASE);
      deletePlayer(client, "g1", "u1");
      expect(getPlayer(client, "g1", "u1")).toBeNull();
    });

    it("should not affect other players in the same game", () => {
      createPlayer(client, BASE);
      createPlayer(client, { ...BASE, user_id: "u2", username: "bob" });
      deletePlayer(client, "g1", "u1");
      expect(getPlayer(client, "g1", "u2")).not.toBeNull();
    });

    it("should not delete the same user in a different game", () => {
      createPlayer(client, BASE);
      createPlayer(client, { ...BASE, game_id: "g2" });
      deletePlayer(client, "g1", "u1");
      expect(getPlayer(client, "g2", "u1")).not.toBeNull();
    });

    it("should throw when the (game, user) pair does not exist", () => {
      expect(() => deletePlayer(client, "g99", "u1")).toThrow();
    });
  });
});
