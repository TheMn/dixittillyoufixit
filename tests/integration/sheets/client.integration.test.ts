import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../../src/sheets/client";

// Real-sheet tests (GASheetsClient via HTTP) require TEST_SPREADSHEET_ID.
// Those will be wired in Task 7 when the HTTP client is implemented.
// For now, these integration tests validate multi-step CRUD flows with
// MockSheetsClient using the actual Sheets schema from CLAUDE.md.
describe.skipIf(!process.env["TEST_SPREADSHEET_ID"])(
  "SheetsClient — real sheet (TEST_SPREADSHEET_ID)",
  () => {
    it.todo("append and read back a Games row from the real test sheet");
    it.todo("update a row in the real test sheet and verify persistence");
    it.todo("delete a row from the real test sheet");
  }
);

describe("SheetsClient — multi-step integration flows (MockSheetsClient)", () => {
  let client: MockSheetsClient;

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  it("should complete a full CRUD cycle on the Games sheet", () => {
    // Append
    client.appendRow("Games", {
      game_id: "g1",
      chat_id: "c100",
      status: "waiting",
      current_round: "0",
      storyteller_id: "",
      created_at: "2026-06-09T10:00:00Z",
    });

    // Read back
    const created = client.findRow("Games", "game_id", "g1");
    expect(created).toMatchObject({ game_id: "g1", status: "waiting" });

    // Update status
    client.updateRow("Games", "game_id", "g1", { status: "active", storyteller_id: "u42" });
    const updated = client.findRow("Games", "game_id", "g1");
    expect(updated).toMatchObject({ status: "active", storyteller_id: "u42" });
    expect(updated!["chat_id"]).toBe("c100"); // unrelated field preserved

    // Delete
    client.deleteRow("Games", "game_id", "g1");
    expect(client.findRow("Games", "game_id", "g1")).toBeNull();
  });

  it("should retrieve all players belonging to a game", () => {
    const players = [
      { game_id: "g1", user_id: "u1", username: "alice", hand: "[]", score: "0", lang: "en" },
      { game_id: "g1", user_id: "u2", username: "bob",   hand: "[]", score: "0", lang: "fa" },
      { game_id: "g1", user_id: "u3", username: "carol", hand: "[]", score: "0", lang: "en" },
      { game_id: "g2", user_id: "u4", username: "dave",  hand: "[]", score: "0", lang: "en" },
    ];
    players.forEach(p => client.appendRow("Players", p));

    const game1Players = client.findRows("Players", "game_id", "g1");

    expect(game1Players).toHaveLength(3);
    expect(game1Players.map(p => p["username"])).toEqual(["alice", "bob", "carol"]);
  });

  it("should upsert a leaderboard entry idempotently across multiple calls", () => {
    const base = {
      user_id: "u1",
      username: "alice",
      total_games: "1",
      total_wins: "1",
      total_score: "15",
      last_played: "2026-06-09",
    };

    client.upsertRow("Leaderboard", "user_id", base);
    client.upsertRow("Leaderboard", "user_id", { ...base, total_games: "2", total_score: "28" });
    client.upsertRow("Leaderboard", "user_id", { ...base, total_games: "3", total_score: "41", total_wins: "2" });

    const rows = client.getRows("Leaderboard");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ total_games: "3", total_score: "41", total_wins: "2" });
  });

  it("should track round submissions and votes without cross-sheet contamination", () => {
    client.appendRow("Games", { game_id: "g1", status: "active" });
    client.appendRow("Rounds", {
      round_id: "r1",
      game_id: "g1",
      round_num: "1",
      clue: "something dreamy",
      storyteller_card: "card_42",
      submissions: "{}",
      votes: "{}",
      status: "waiting_votes",
    });

    client.updateRow("Rounds", "round_id", "r1", {
      votes: JSON.stringify({ u1: "card_42", u2: "card_7" }),
      status: "revealing",
    });

    const round = client.findRow("Rounds", "round_id", "r1");
    expect(round!["status"]).toBe("revealing");
    expect(JSON.parse(round!["votes"])).toEqual({ u1: "card_42", u2: "card_7" });

    // Game row must be unaffected
    expect(client.findRow("Games", "game_id", "g1")!["status"]).toBe("active");
  });
});
