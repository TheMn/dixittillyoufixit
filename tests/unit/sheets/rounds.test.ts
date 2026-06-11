import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../../src/sheets/client";
import {
  createRound,
  getRound,
  getRoundsForGame,
  getCurrentRound,
  updateRound,
  deleteRound,
  type RoundRecord,
} from "../../../src/sheets/rounds";

const BASE: RoundRecord = {
  round_id: "r1",
  game_id: "g1",
  round_num: 1,
  clue: "",
  storyteller_card: "",
  submissions: {},
  votes: {},
  status: "waiting_clue",
};

describe("rounds sheet module", () => {
  let client: MockSheetsClient;

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  describe("createRound / getRound", () => {
    it("should create a record that can be read back correctly", () => {
      createRound(client, BASE);
      expect(getRound(client, "r1")).toEqual(BASE);
    });

    it("should serialise and deserialise submissions as an object", () => {
      createRound(client, { ...BASE, submissions: { u2: "card5" } });
      expect(getRound(client, "r1")!.submissions).toEqual({ u2: "card5" });
    });

    it("should serialise and deserialise votes as an object", () => {
      createRound(client, { ...BASE, votes: { u2: "card3", u3: "card5" } });
      expect(getRound(client, "r1")!.votes).toEqual({ u2: "card3", u3: "card5" });
    });

    it("should return null for a non-existent round_id", () => {
      expect(getRound(client, "r99")).toBeNull();
    });
  });

  describe("getRoundsForGame", () => {
    it("should return all rounds for a game in insertion order", () => {
      createRound(client, { ...BASE, round_id: "r1", round_num: 1 });
      createRound(client, { ...BASE, round_id: "r2", round_num: 2 });
      createRound(client, { ...BASE, round_id: "r3", game_id: "g2", round_num: 1 });

      const rounds = getRoundsForGame(client, "g1");
      expect(rounds).toHaveLength(2);
      expect(rounds.map(r => r.round_id)).toEqual(["r1", "r2"]);
    });

    it("should return an empty array when no rounds exist for the game", () => {
      expect(getRoundsForGame(client, "g99")).toEqual([]);
    });
  });

  describe("getCurrentRound", () => {
    it("should return the round that is not yet done", () => {
      createRound(client, { ...BASE, round_id: "r1", status: "done" });
      createRound(client, { ...BASE, round_id: "r2", status: "waiting_votes" });
      expect(getCurrentRound(client, "g1")!.round_id).toBe("r2");
    });

    it("should return null when all rounds are done", () => {
      createRound(client, { ...BASE, status: "done" });
      expect(getCurrentRound(client, "g1")).toBeNull();
    });

    it("should return null when there are no rounds for the game", () => {
      expect(getCurrentRound(client, "g1")).toBeNull();
    });
  });

  describe("updateRound", () => {
    it("should persist a clue and storyteller_card change", () => {
      createRound(client, BASE);
      updateRound(client, "r1", { clue: "something dreamy", storyteller_card: "card42" });
      const updated = getRound(client, "r1")!;
      expect(updated.clue).toBe("something dreamy");
      expect(updated.storyteller_card).toBe("card42");
    });

    it("should persist a submissions update", () => {
      createRound(client, BASE);
      updateRound(client, "r1", { submissions: { u2: "card7" } });
      expect(getRound(client, "r1")!.submissions).toEqual({ u2: "card7" });
    });

    it("should persist a votes update and status transition", () => {
      createRound(client, BASE);
      updateRound(client, "r1", {
        votes: { u2: "card42", u3: "card7" },
        status: "revealing",
      });
      const updated = getRound(client, "r1")!;
      expect(updated.votes).toEqual({ u2: "card42", u3: "card7" });
      expect(updated.status).toBe("revealing");
    });

    it("should not overwrite unpatched fields", () => {
      createRound(client, { ...BASE, clue: "stormy night" });
      updateRound(client, "r1", { status: "waiting_submissions" });
      expect(getRound(client, "r1")!.clue).toBe("stormy night");
    });

    it("should throw when round_id does not exist", () => {
      expect(() => updateRound(client, "r99", { status: "done" })).toThrow();
    });
  });

  describe("deleteRound", () => {
    it("should remove the round so it is no longer returned", () => {
      createRound(client, BASE);
      deleteRound(client, "r1");
      expect(getRound(client, "r1")).toBeNull();
    });

    it("should not affect other rounds in the same game", () => {
      createRound(client, { ...BASE, round_id: "r1" });
      createRound(client, { ...BASE, round_id: "r2" });
      deleteRound(client, "r1");
      expect(getRound(client, "r2")).not.toBeNull();
    });

    it("should throw when the round_id does not exist", () => {
      expect(() => deleteRound(client, "r99")).toThrow();
    });
  });
});
