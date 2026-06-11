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

describe.skipIf(!process.env["TEST_SPREADSHEET_ID"])(
  "rounds — real sheet (TEST_SPREADSHEET_ID)",
  () => {
    it.todo("create a round row and read it back from the real test sheet");
    it.todo("update submissions/votes JSON and verify persistence");
    it.todo("advance round status through all phases in the real sheet");
  }
);

describe("rounds — multi-step integration flows (MockSheetsClient)", () => {
  let client: MockSheetsClient;

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

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  it("should complete a full round lifecycle from clue to done", () => {
    createRound(client, BASE);

    // Storyteller submits clue
    updateRound(client, "r1", {
      clue: "something dreamy",
      storyteller_card: "card42",
      status: "waiting_submissions",
    });
    expect(getRound(client, "r1")!.status).toBe("waiting_submissions");

    // Players submit cards
    updateRound(client, "r1", {
      submissions: { u2: "card7", u3: "card15" },
      status: "waiting_votes",
    });
    expect(getRound(client, "r1")!.submissions).toEqual({ u2: "card7", u3: "card15" });

    // Players vote
    updateRound(client, "r1", {
      votes: { u2: "card42", u3: "card7" },
      status: "revealing",
    });
    expect(getRound(client, "r1")!.votes).toEqual({ u2: "card42", u3: "card7" });

    // Reveal completes
    updateRound(client, "r1", { status: "done" });
    expect(getRound(client, "r1")!.status).toBe("done");
  });

  it("should report no current round once all rounds are done", () => {
    createRound(client, { ...BASE, round_id: "r1", status: "done" });
    createRound(client, { ...BASE, round_id: "r2", status: "done" });
    expect(getCurrentRound(client, "g1")).toBeNull();
  });

  it("should return the in-progress round as getCurrentRound across multiple rounds", () => {
    createRound(client, { ...BASE, round_id: "r1", status: "done" });
    createRound(client, { ...BASE, round_id: "r2", status: "waiting_votes" });
    createRound(client, { ...BASE, round_id: "r3", status: "waiting_clue" });

    expect(getCurrentRound(client, "g1")!.round_id).toBe("r2");
  });

  it("should retrieve all rounds for a game in order", () => {
    for (let i = 1; i <= 4; i++) {
      createRound(client, { ...BASE, round_id: `r${i}`, round_num: i, status: "done" });
    }
    const rounds = getRoundsForGame(client, "g1");
    expect(rounds).toHaveLength(4);
    expect(rounds.map(r => r.round_num)).toEqual([1, 2, 3, 4]);
  });

  it("should delete a round and not affect others", () => {
    createRound(client, { ...BASE, round_id: "r1" });
    createRound(client, { ...BASE, round_id: "r2" });
    deleteRound(client, "r1");
    expect(getRound(client, "r1")).toBeNull();
    expect(getRound(client, "r2")).not.toBeNull();
  });
});
