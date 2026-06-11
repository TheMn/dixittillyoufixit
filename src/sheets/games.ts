import { ISheetsClient, Row } from "./client";
import type { GameStatus } from "../game/state";

export interface GameRecord {
  game_id: string;
  chat_id: string;
  status: GameStatus;
  current_round: number;
  storyteller_id: string;
  created_at: string;
}

const SHEET = "Games";

function toRecord(row: Row): GameRecord {
  return {
    game_id: row.game_id,
    chat_id: row.chat_id,
    status: row.status as GameStatus,
    current_round: parseInt(row.current_round ?? "0", 10),
    storyteller_id: row.storyteller_id ?? "",
    created_at: row.created_at ?? "",
  };
}

function toRow(record: GameRecord): Row {
  return {
    game_id: record.game_id,
    chat_id: record.chat_id,
    status: record.status,
    current_round: String(record.current_round),
    storyteller_id: record.storyteller_id,
    created_at: record.created_at,
  };
}

export function createGame(client: ISheetsClient, record: GameRecord): void {
  client.appendRow(SHEET, toRow(record));
}

export function getGame(client: ISheetsClient, gameId: string): GameRecord | null {
  const row = client.findRow(SHEET, "game_id", gameId);
  return row ? toRecord(row) : null;
}

export function getActiveGameByChat(
  client: ISheetsClient,
  chatId: string
): GameRecord | null {
  const rows = client.findRows(SHEET, "chat_id", chatId);
  const active = rows.find(r => r.status === "lobby" || r.status === "active");
  return active ? toRecord(active) : null;
}

export function updateGame(
  client: ISheetsClient,
  gameId: string,
  patch: Partial<Omit<GameRecord, "game_id">>
): void {
  const raw: Partial<Row> = {};
  if (patch.status !== undefined) raw.status = patch.status;
  if (patch.current_round !== undefined) raw.current_round = String(patch.current_round);
  if (patch.storyteller_id !== undefined) raw.storyteller_id = patch.storyteller_id;
  if (patch.chat_id !== undefined) raw.chat_id = patch.chat_id;
  if (patch.created_at !== undefined) raw.created_at = patch.created_at;
  client.updateRow(SHEET, "game_id", gameId, raw);
}

export function deleteGame(client: ISheetsClient, gameId: string): void {
  client.deleteRow(SHEET, "game_id", gameId);
}
