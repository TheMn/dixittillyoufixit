import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../../src/sheets/client";
import {
  createGame,
  getGame,
  getActiveGameByChat,
  updateGame,
  deleteGame,
  type GameRecord,
} from "../../../src/sheets/games";

// Real-sheet tests require TEST_SPREADSHEET_ID and a deployed HTTP client.
// Those will be wired when the GAS HTTP adapter is implemented.
describe.skipIf(!process.env["TEST_SPREADSHEET_ID"])(
  "games — real sheet (TEST_SPREADSHEET_ID)",
  () => {
    it.todo("create a game row and read it back from the real test sheet");
    it.todo("update game status and verify persistence in the real sheet");
    it.todo("delete a game row and verify it is gone from the real sheet");
  }
);

describe("games — multi-step integration flows (MockSheetsClient)", () => {
  let client: MockSheetsClient;

  const GAME: GameRecord = {
    game_id: "int-g1",
    chat_id: "int-c100",
    status: "lobby",
    current_round: 0,
    storyteller_id: "",
    created_at: "2026-06-11T10:00:00Z",
  };

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  it("should complete a full CRUD lifecycle", () => {
    createGame(client, GAME);
    expect(getGame(client, GAME.game_id)).toMatchObject({ status: "lobby" });

    updateGame(client, GAME.game_id, { status: "active", storyteller_id: "u42" });
    const updated = getGame(client, GAME.game_id)!;
    expect(updated.status).toBe("active");
    expect(updated.storyteller_id).toBe("u42");
    expect(updated.chat_id).toBe("int-c100");

    deleteGame(client, GAME.game_id);
    expect(getGame(client, GAME.game_id)).toBeNull();
  });

  it("should not return an ended game as the active game for a chat", () => {
    createGame(client, GAME);
    updateGame(client, GAME.game_id, { status: "ended" });
    expect(getActiveGameByChat(client, GAME.chat_id)).toBeNull();
  });

  it("should return the active game when an ended game also exists for the chat", () => {
    createGame(client, { ...GAME, game_id: "old-g", status: "ended" });
    createGame(client, { ...GAME, game_id: "new-g", status: "active" });
    expect(getActiveGameByChat(client, GAME.chat_id)!.game_id).toBe("new-g");
  });

  it("should advance current_round through multiple rounds", () => {
    createGame(client, GAME);
    for (let round = 1; round <= 5; round++) {
      updateGame(client, GAME.game_id, { current_round: round });
      expect(getGame(client, GAME.game_id)!.current_round).toBe(round);
    }
  });
});
