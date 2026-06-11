import { ISheetsClient, Row } from "./client";

export interface LeaderboardRecord {
  user_id: string;
  username: string;
  total_games: number;
  total_wins: number;
  total_score: number;
  last_played: string;
}

const SHEET = "Leaderboard";

function toRecord(row: Row): LeaderboardRecord {
  return {
    user_id: row.user_id,
    username: row.username ?? "",
    total_games: parseInt(row.total_games ?? "0", 10),
    total_wins: parseInt(row.total_wins ?? "0", 10),
    total_score: parseInt(row.total_score ?? "0", 10),
    last_played: row.last_played ?? "",
  };
}

function toRow(record: LeaderboardRecord): Row {
  return {
    user_id: record.user_id,
    username: record.username,
    total_games: String(record.total_games),
    total_wins: String(record.total_wins),
    total_score: String(record.total_score),
    last_played: record.last_played,
  };
}

export function upsertLeaderboard(
  client: ISheetsClient,
  record: LeaderboardRecord
): void {
  client.upsertRow(SHEET, "user_id", toRow(record));
}

export function getLeaderboardEntry(
  client: ISheetsClient,
  userId: string
): LeaderboardRecord | null {
  const row = client.findRow(SHEET, "user_id", userId);
  return row ? toRecord(row) : null;
}

export function getTopPlayers(
  client: ISheetsClient,
  limit: number
): LeaderboardRecord[] {
  return client
    .getRows(SHEET)
    .map(toRecord)
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, limit);
}

export function deleteLeaderboardEntry(
  client: ISheetsClient,
  userId: string
): void {
  client.deleteRow(SHEET, "user_id", userId);
}
