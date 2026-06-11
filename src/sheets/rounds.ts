import { ISheetsClient, Row } from "./client";
import type { RoundPhase } from "../game/rounds";

export interface RoundRecord {
  round_id: string;
  game_id: string;
  round_num: number;
  clue: string;
  storyteller_card: string;
  submissions: Record<string, string>;
  votes: Record<string, string>;
  status: RoundPhase;
}

const SHEET = "Rounds";

function toRecord(row: Row): RoundRecord {
  return {
    round_id: row.round_id,
    game_id: row.game_id,
    round_num: parseInt(row.round_num ?? "0", 10),
    clue: row.clue ?? "",
    storyteller_card: row.storyteller_card ?? "",
    submissions: JSON.parse(row.submissions || "{}") as Record<string, string>,
    votes: JSON.parse(row.votes || "{}") as Record<string, string>,
    status: row.status as RoundPhase,
  };
}

function toRow(record: RoundRecord): Row {
  return {
    round_id: record.round_id,
    game_id: record.game_id,
    round_num: String(record.round_num),
    clue: record.clue,
    storyteller_card: record.storyteller_card,
    submissions: JSON.stringify(record.submissions),
    votes: JSON.stringify(record.votes),
    status: record.status,
  };
}

export function createRound(client: ISheetsClient, record: RoundRecord): void {
  client.appendRow(SHEET, toRow(record));
}

export function getRound(
  client: ISheetsClient,
  roundId: string
): RoundRecord | null {
  const row = client.findRow(SHEET, "round_id", roundId);
  return row ? toRecord(row) : null;
}

export function getRoundsForGame(
  client: ISheetsClient,
  gameId: string
): RoundRecord[] {
  return client.findRows(SHEET, "game_id", gameId).map(toRecord);
}

export function getCurrentRound(
  client: ISheetsClient,
  gameId: string
): RoundRecord | null {
  const rows = client.findRows(SHEET, "game_id", gameId);
  const active = rows.find(r => r.status !== "done");
  return active ? toRecord(active) : null;
}

export function updateRound(
  client: ISheetsClient,
  roundId: string,
  patch: Partial<Omit<RoundRecord, "round_id" | "game_id">>
): void {
  const raw: Partial<Row> = {};
  if (patch.clue !== undefined) raw.clue = patch.clue;
  if (patch.storyteller_card !== undefined) raw.storyteller_card = patch.storyteller_card;
  if (patch.submissions !== undefined) raw.submissions = JSON.stringify(patch.submissions);
  if (patch.votes !== undefined) raw.votes = JSON.stringify(patch.votes);
  if (patch.status !== undefined) raw.status = patch.status;
  if (patch.round_num !== undefined) raw.round_num = String(patch.round_num);
  client.updateRow(SHEET, "round_id", roundId, raw);
}

export function deleteRound(client: ISheetsClient, roundId: string): void {
  client.deleteRow(SHEET, "round_id", roundId);
}
