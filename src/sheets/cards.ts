import { ISheetsClient, Row } from "./client";

export interface CardRecord {
  card_id: string;
  file_id: string;
  drive_url: string;
  in_use: boolean;
}

const SHEET = "Cards";

function toRecord(row: Row): CardRecord {
  return {
    card_id: row.card_id,
    file_id: row.file_id ?? "",
    drive_url: row.drive_url ?? "",
    in_use: row.in_use === "true",
  };
}

function toRow(record: CardRecord): Row {
  return {
    card_id: record.card_id,
    file_id: record.file_id,
    drive_url: record.drive_url,
    in_use: String(record.in_use),
  };
}

export function createCard(client: ISheetsClient, record: CardRecord): void {
  client.appendRow(SHEET, toRow(record));
}

export function getCard(
  client: ISheetsClient,
  cardId: string
): CardRecord | null {
  const row = client.findRow(SHEET, "card_id", cardId);
  return row ? toRecord(row) : null;
}

export function getAvailableCards(client: ISheetsClient): CardRecord[] {
  return client
    .getRows(SHEET)
    .filter(r => r.in_use !== "true")
    .map(toRecord);
}

export function updateCard(
  client: ISheetsClient,
  cardId: string,
  patch: Partial<Omit<CardRecord, "card_id">>
): void {
  const raw: Partial<Row> = {};
  if (patch.file_id !== undefined) raw.file_id = patch.file_id;
  if (patch.drive_url !== undefined) raw.drive_url = patch.drive_url;
  if (patch.in_use !== undefined) raw.in_use = String(patch.in_use);
  client.updateRow(SHEET, "card_id", cardId, raw);
}

export function deleteCard(client: ISheetsClient, cardId: string): void {
  client.deleteRow(SHEET, "card_id", cardId);
}
