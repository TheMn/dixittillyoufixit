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

const BASE: GameRecord = {
  game_id: "g1",
  chat_id: "c100",
  status: "lobby",
  current_round: 0,
  storyteller_id: "",
  created_at: "2026-06-11T10:00:00Z",
};

describe("games sheet module", () => {
  let client: MockSheetsClient;

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  describe("createGame / getGame", () => {
    it("should create a record that can be read back correctly", () => {
      createGame(client, BASE);
      expect(getGame(client, "g1")).toEqual(BASE);
    });

    it("should return null for a non-existent game_id", () => {
      expect(getGame(client, "g99")).toBeNull();
    });

    it("should serialise current_round as a number", () => {
      createGame(client, { ...BASE, current_round: 3 });
      expect(getGame(client, "g1")!.current_round).toBe(3);
    });
  });

  describe("getActiveGameByChat", () => {
    it("should return a lobby game for the given chat", () => {
      createGame(client, BASE);
      expect(getActiveGameByChat(client, "c100")).toEqual(BASE);
    });

    it("should return an active game for the given chat", () => {
      createGame(client, { ...BASE, status: "active" });
      expect(getActiveGameByChat(client, "c100")!.status).toBe("active");
    });

    it("should return null when the only game for the chat has ended", () => {
      createGame(client, { ...BASE, status: "ended" });
      expect(getActiveGameByChat(client, "c100")).toBeNull();
    });

    it("should return null when no game exists for the chat", () => {
      expect(getActiveGameByChat(client, "c999")).toBeNull();
    });

    it("should ignore ended games and return the active one", () => {
      createGame(client, { ...BASE, game_id: "g0", status: "ended" });
      createGame(client, { ...BASE, game_id: "g1", status: "active" });
      expect(getActiveGameByChat(client, "c100")!.game_id).toBe("g1");
    });
  });

  describe("updateGame", () => {
    it("should persist a status change", () => {
      createGame(client, BASE);
      updateGame(client, "g1", { status: "active" });
      expect(getGame(client, "g1")!.status).toBe("active");
    });

    it("should persist a current_round change", () => {
      createGame(client, BASE);
      updateGame(client, "g1", { current_round: 2 });
      expect(getGame(client, "g1")!.current_round).toBe(2);
    });

    it("should persist a storyteller_id change", () => {
      createGame(client, BASE);
      updateGame(client, "g1", { storyteller_id: "u42" });
      expect(getGame(client, "g1")!.storyteller_id).toBe("u42");
    });

    it("should not overwrite unpatched fields", () => {
      createGame(client, BASE);
      updateGame(client, "g1", { status: "active" });
      const updated = getGame(client, "g1")!;
      expect(updated.chat_id).toBe("c100");
      expect(updated.created_at).toBe("2026-06-11T10:00:00Z");
    });

    it("should throw when the game_id does not exist", () => {
      expect(() => updateGame(client, "g99", { status: "active" })).toThrow();
    });
  });

  describe("deleteGame", () => {
    it("should remove the game so it is no longer returned", () => {
      createGame(client, BASE);
      deleteGame(client, "g1");
      expect(getGame(client, "g1")).toBeNull();
    });

    it("should not affect other games when deleted", () => {
      createGame(client, BASE);
      createGame(client, { ...BASE, game_id: "g2", chat_id: "c200" });
      deleteGame(client, "g1");
      expect(getGame(client, "g2")).not.toBeNull();
    });

    it("should throw when the game_id does not exist", () => {
      expect(() => deleteGame(client, "g99")).toThrow();
    });
  });
});
