import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../../src/sheets/client";

describe("MockSheetsClient", () => {
  let client: MockSheetsClient;

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  describe("getRows", () => {
    it("should return an empty array for an unknown sheet", () => {
      expect(client.getRows("Games")).toEqual([]);
    });

    it("should return all appended rows as key-value objects", () => {
      client.appendRow("Games", { game_id: "g1", status: "waiting" });
      client.appendRow("Games", { game_id: "g2", status: "active" });

      expect(client.getRows("Games")).toEqual([
        { game_id: "g1", status: "waiting" },
        { game_id: "g2", status: "active" },
      ]);
    });

    it("should preserve insertion order", () => {
      client.appendRow("Games", { game_id: "g3" });
      client.appendRow("Games", { game_id: "g1" });
      client.appendRow("Games", { game_id: "g2" });

      const ids = client.getRows("Games").map(r => r["game_id"]);
      expect(ids).toEqual(["g3", "g1", "g2"]);
    });
  });

  describe("findRow", () => {
    it("should return the matching row as a key-value object", () => {
      client.appendRow("Games", { game_id: "g1", chat_id: "c1", status: "waiting" });

      const row = client.findRow("Games", "game_id", "g1");

      expect(row).toEqual({ game_id: "g1", chat_id: "c1", status: "waiting" });
    });

    it("should return null when no row matches", () => {
      client.appendRow("Games", { game_id: "g1", status: "waiting" });

      expect(client.findRow("Games", "game_id", "g99")).toBeNull();
    });

    it("should return the first match when multiple rows share the same value", () => {
      client.appendRow("Players", { game_id: "g1", user_id: "u1" });
      client.appendRow("Players", { game_id: "g1", user_id: "u2" });

      const row = client.findRow("Players", "game_id", "g1");

      expect(row!["user_id"]).toBe("u1");
    });
  });

  describe("findRows", () => {
    it("should return all rows matching the column value", () => {
      client.appendRow("Players", { game_id: "g1", user_id: "u1" });
      client.appendRow("Players", { game_id: "g1", user_id: "u2" });
      client.appendRow("Players", { game_id: "g2", user_id: "u3" });

      const rows = client.findRows("Players", "game_id", "g1");

      expect(rows).toHaveLength(2);
      expect(rows.map(r => r["user_id"])).toEqual(["u1", "u2"]);
    });

    it("should return an empty array when nothing matches", () => {
      client.appendRow("Players", { game_id: "g1", user_id: "u1" });

      expect(client.findRows("Players", "game_id", "g99")).toEqual([]);
    });
  });

  describe("updateRow", () => {
    it("should merge partial data without overwriting unrelated fields", () => {
      client.appendRow("Games", { game_id: "g1", status: "waiting", chat_id: "c1" });

      client.updateRow("Games", "game_id", "g1", { status: "active" });

      expect(client.findRow("Games", "game_id", "g1")).toEqual({
        game_id: "g1",
        status: "active",
        chat_id: "c1",
      });
    });

    it("should only update the matched row and leave others unchanged", () => {
      client.appendRow("Games", { game_id: "g1", status: "waiting" });
      client.appendRow("Games", { game_id: "g2", status: "waiting" });

      client.updateRow("Games", "game_id", "g1", { status: "active" });

      expect(client.findRow("Games", "game_id", "g2")!["status"]).toBe("waiting");
    });

    it("should throw when no row matches the id", () => {
      expect(() =>
        client.updateRow("Games", "game_id", "g99", { status: "active" })
      ).toThrow('Row not found: Games[game_id="g99"]');
    });
  });

  describe("deleteRow", () => {
    it("should remove the matching row", () => {
      client.appendRow("Games", { game_id: "g1" });
      client.appendRow("Games", { game_id: "g2" });

      client.deleteRow("Games", "game_id", "g1");

      expect(client.getRows("Games")).toEqual([{ game_id: "g2" }]);
    });

    it("should throw when no row matches the id", () => {
      expect(() =>
        client.deleteRow("Games", "game_id", "g99")
      ).toThrow('Row not found: Games[game_id="g99"]');
    });
  });

  describe("upsertRow", () => {
    it("should insert when the id is not present", () => {
      client.upsertRow("Games", "game_id", { game_id: "g1", status: "waiting" });

      expect(client.getRows("Games")).toEqual([{ game_id: "g1", status: "waiting" }]);
    });

    it("should update (merge) when the id already exists", () => {
      client.appendRow("Games", { game_id: "g1", status: "waiting", chat_id: "c1" });

      client.upsertRow("Games", "game_id", { game_id: "g1", status: "active" });

      expect(client.findRow("Games", "game_id", "g1")).toEqual({
        game_id: "g1",
        status: "active",
        chat_id: "c1",
      });
    });

    it("should result in exactly one row when called twice with the same id", () => {
      client.upsertRow("Games", "game_id", { game_id: "g1", status: "waiting" });
      client.upsertRow("Games", "game_id", { game_id: "g1", status: "active" });

      expect(client.getRows("Games")).toHaveLength(1);
    });
  });

  describe("sheet isolation", () => {
    it("should store data for different sheet names independently", () => {
      client.appendRow("Games", { game_id: "g1" });
      client.appendRow("Players", { user_id: "u1" });

      expect(client.getRows("Games")).toEqual([{ game_id: "g1" }]);
      expect(client.getRows("Players")).toEqual([{ user_id: "u1" }]);
    });

    it("should not affect other sheets when a row is deleted", () => {
      client.appendRow("Games", { game_id: "g1" });
      client.appendRow("Players", { game_id: "g1", user_id: "u1" });

      client.deleteRow("Games", "game_id", "g1");

      expect(client.getRows("Games")).toEqual([]);
      expect(client.getRows("Players")).toHaveLength(1);
    });
  });
});
