import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../../src/sheets/client";
import {
  createCard,
  getCard,
  getAvailableCards,
  updateCard,
  deleteCard,
  type CardRecord,
} from "../../../src/sheets/cards";

const BASE: CardRecord = {
  card_id: "card1",
  file_id: "file_abc123",
  drive_url: "https://drive.google.com/file/card1",
  in_use: false,
};

describe("cards sheet module", () => {
  let client: MockSheetsClient;

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  describe("createCard / getCard", () => {
    it("should create a record that can be read back correctly", () => {
      createCard(client, BASE);
      expect(getCard(client, "card1")).toEqual(BASE);
    });

    it("should deserialise in_use as a boolean false", () => {
      createCard(client, { ...BASE, in_use: false });
      expect(getCard(client, "card1")!.in_use).toBe(false);
    });

    it("should deserialise in_use as a boolean true", () => {
      createCard(client, { ...BASE, in_use: true });
      expect(getCard(client, "card1")!.in_use).toBe(true);
    });

    it("should return null for a non-existent card_id", () => {
      expect(getCard(client, "card99")).toBeNull();
    });
  });

  describe("getAvailableCards", () => {
    it("should return only cards where in_use is false", () => {
      createCard(client, { ...BASE, card_id: "c1", in_use: false });
      createCard(client, { ...BASE, card_id: "c2", in_use: true });
      createCard(client, { ...BASE, card_id: "c3", in_use: false });

      const available = getAvailableCards(client);
      expect(available).toHaveLength(2);
      expect(available.map(c => c.card_id)).toEqual(["c1", "c3"]);
    });

    it("should return an empty array when all cards are in use", () => {
      createCard(client, { ...BASE, in_use: true });
      expect(getAvailableCards(client)).toEqual([]);
    });

    it("should return an empty array when no cards exist", () => {
      expect(getAvailableCards(client)).toEqual([]);
    });
  });

  describe("updateCard", () => {
    it("should persist marking a card as in_use", () => {
      createCard(client, BASE);
      updateCard(client, "card1", { in_use: true });
      expect(getCard(client, "card1")!.in_use).toBe(true);
    });

    it("should persist marking a card as no longer in_use", () => {
      createCard(client, { ...BASE, in_use: true });
      updateCard(client, "card1", { in_use: false });
      expect(getCard(client, "card1")!.in_use).toBe(false);
    });

    it("should persist a file_id change", () => {
      createCard(client, BASE);
      updateCard(client, "card1", { file_id: "new_file_xyz" });
      expect(getCard(client, "card1")!.file_id).toBe("new_file_xyz");
    });

    it("should not overwrite unpatched fields", () => {
      createCard(client, BASE);
      updateCard(client, "card1", { in_use: true });
      const updated = getCard(client, "card1")!;
      expect(updated.file_id).toBe("file_abc123");
      expect(updated.drive_url).toBe("https://drive.google.com/file/card1");
    });

    it("should throw when card_id does not exist", () => {
      expect(() => updateCard(client, "card99", { in_use: true })).toThrow();
    });
  });

  describe("deleteCard", () => {
    it("should remove the card so it is no longer returned", () => {
      createCard(client, BASE);
      deleteCard(client, "card1");
      expect(getCard(client, "card1")).toBeNull();
    });

    it("should not affect other cards when one is deleted", () => {
      createCard(client, BASE);
      createCard(client, { ...BASE, card_id: "card2" });
      deleteCard(client, "card1");
      expect(getCard(client, "card2")).not.toBeNull();
    });

    it("should also remove the card from getAvailableCards results", () => {
      createCard(client, BASE);
      createCard(client, { ...BASE, card_id: "card2" });
      deleteCard(client, "card1");
      const available = getAvailableCards(client);
      expect(available.map(c => c.card_id)).not.toContain("card1");
    });

    it("should throw when card_id does not exist", () => {
      expect(() => deleteCard(client, "card99")).toThrow();
    });
  });
});
