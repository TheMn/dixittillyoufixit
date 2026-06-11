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

describe.skipIf(!process.env["TEST_SPREADSHEET_ID"])(
  "cards — real sheet (TEST_SPREADSHEET_ID)",
  () => {
    it.todo("create a card and read it back from the real test sheet");
    it.todo("mark a card in_use and verify it no longer appears in available cards");
    it.todo("delete a card and confirm it is gone");
  }
);

describe("cards — multi-step integration flows (MockSheetsClient)", () => {
  let client: MockSheetsClient;

  const makeCard = (id: string, inUse = false): CardRecord => ({
    card_id: id,
    file_id: `file_${id}`,
    drive_url: `https://drive.google.com/file/${id}`,
    in_use: inUse,
  });

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  it("should complete a full CRUD lifecycle", () => {
    createCard(client, makeCard("c1"));
    expect(getCard(client, "c1")).toMatchObject({ card_id: "c1", in_use: false });

    updateCard(client, "c1", { in_use: true });
    expect(getCard(client, "c1")!.in_use).toBe(true);

    deleteCard(client, "c1");
    expect(getCard(client, "c1")).toBeNull();
  });

  it("should simulate dealing cards: mark cards in_use, then return them", () => {
    for (let i = 1; i <= 10; i++) createCard(client, makeCard(`c${i}`));

    const available = getAvailableCards(client);
    expect(available).toHaveLength(10);

    // Deal 6 cards to a player
    const hand = available.slice(0, 6);
    hand.forEach(c => updateCard(client, c.card_id, { in_use: true }));

    expect(getAvailableCards(client)).toHaveLength(4);

    // Return cards after round
    hand.forEach(c => updateCard(client, c.card_id, { in_use: false }));
    expect(getAvailableCards(client)).toHaveLength(10);
  });

  it("should report 0 available cards when the entire deck is in use", () => {
    for (let i = 1; i <= 5; i++) createCard(client, makeCard(`c${i}`, true));
    expect(getAvailableCards(client)).toHaveLength(0);
  });

  it("should not return a deleted card in getAvailableCards", () => {
    createCard(client, makeCard("c1"));
    createCard(client, makeCard("c2"));
    deleteCard(client, "c1");
    const available = getAvailableCards(client);
    expect(available.map(c => c.card_id)).not.toContain("c1");
    expect(available.map(c => c.card_id)).toContain("c2");
  });
});
