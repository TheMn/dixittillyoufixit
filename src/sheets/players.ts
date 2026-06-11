import { ISheetsClient, Row } from "./client";

export interface PlayerRecord {
  game_id: string;
  user_id: string;
  username: string;
  hand: string[];
  score: number;
  lang: string;
}

const SHEET = "Players";

// Compound primary key: game_id:user_id — needed because the same Telegram user
// may appear in multiple (historical) game rows.
function playerKey(gameId: string, userId: string): string {
  return `${gameId}:${userId}`;
}

function toRecord(row: Row): PlayerRecord {
  return {
    game_id: row.game_id,
    user_id: row.user_id,
    username: row.username ?? "",
    hand: JSON.parse(row.hand || "[]") as string[],
    score: parseInt(row.score ?? "0", 10),
    lang: row.lang ?? "en",
  };
}

function toRow(record: PlayerRecord): Row {
  return {
    player_key: playerKey(record.game_id, record.user_id),
    game_id: record.game_id,
    user_id: record.user_id,
    username: record.username,
    hand: JSON.stringify(record.hand),
    score: String(record.score),
    lang: record.lang,
  };
}

export function createPlayer(client: ISheetsClient, record: PlayerRecord): void {
  client.appendRow(SHEET, toRow(record));
}

export function getPlayer(
  client: ISheetsClient,
  gameId: string,
  userId: string
): PlayerRecord | null {
  const row = client.findRow(SHEET, "player_key", playerKey(gameId, userId));
  return row ? toRecord(row) : null;
}

export function getGamePlayers(
  client: ISheetsClient,
  gameId: string
): PlayerRecord[] {
  return client.findRows(SHEET, "game_id", gameId).map(toRecord);
}

export function updatePlayer(
  client: ISheetsClient,
  gameId: string,
  userId: string,
  patch: Partial<Omit<PlayerRecord, "game_id" | "user_id">>
): void {
  const raw: Partial<Row> = {};
  if (patch.username !== undefined) raw.username = patch.username;
  if (patch.hand !== undefined) raw.hand = JSON.stringify(patch.hand);
  if (patch.score !== undefined) raw.score = String(patch.score);
  if (patch.lang !== undefined) raw.lang = patch.lang;
  client.updateRow(SHEET, "player_key", playerKey(gameId, userId), raw);
}

export function deletePlayer(
  client: ISheetsClient,
  gameId: string,
  userId: string
): void {
  client.deleteRow(SHEET, "player_key", playerKey(gameId, userId));
}
