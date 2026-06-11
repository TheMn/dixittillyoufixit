import { ISheetsClient } from "../sheets/client";
import { GameRecord, updateGame } from "../sheets/games";
import { PlayerRecord, updatePlayer } from "../sheets/players";
import { RoundRecord, updateRound } from "../sheets/rounds";
import { getAvailableCards, updateCard } from "../sheets/cards";
import { getLeaderboardEntry, upsertLeaderboard } from "../sheets/leaderboard";
import { calculateScores } from "./scoring";
import { WIN_SCORE, HAND_SIZE } from "./engine";

export interface ProcessRoundEndResult {
  gameDone: boolean;
  winner: PlayerRecord | null;
  updatedPlayers: PlayerRecord[];
  nextStorytellerId: string;
  nextRoundNum: number;
}

export function processRoundEnd(
  client: ISheetsClient,
  gameRecord: GameRecord,
  roundRecord: RoundRecord,
  playerRecords: PlayerRecord[]
): ProcessRoundEndResult {
  const gameId = gameRecord.game_id;

  // Build scoring input — scoring.ts requires a different shape from sheets types
  const scoringRound = {
    storytellerId: roundRecord.storyteller_id,
    storytellerCardId: roundRecord.storyteller_card,
    players: playerRecords
      .filter(p => p.user_id !== roundRecord.storyteller_id)
      .map(p => ({
        id: p.user_id,
        submittedCardId: roundRecord.submissions[p.user_id] ?? "",
      })),
    votes: roundRecord.votes,
  };

  const { scores } = calculateScores(scoringRound);
  const scoreMap = new Map(scores.map(s => [s.playerId, s.points]));

  // Remove each player's submitted card from their hand and apply score delta
  const submittedCards = new Set([
    roundRecord.storyteller_card,
    ...Object.values(roundRecord.submissions),
  ]);

  const afterScoring = playerRecords.map(p => ({
    ...p,
    hand: p.hand.filter(c => !submittedCards.has(c)),
    score: p.score + (scoreMap.get(p.user_id) ?? 0),
  }));

  for (const p of afterScoring) {
    updatePlayer(client, gameId, p.user_id, { score: p.score, hand: p.hand });
  }

  // Replenish hands from available (not in-use) cards in the Cards sheet
  const available = getAvailableCards(client);
  let cursor = 0;

  const replenished = afterScoring.map(p => {
    const needed = HAND_SIZE - p.hand.length;
    const drawn: string[] = [];
    for (let i = 0; i < needed && cursor < available.length; i++, cursor++) {
      drawn.push(available[cursor].card_id);
      updateCard(client, available[cursor].card_id, { in_use: true });
    }
    const newHand = [...p.hand, ...drawn];
    if (drawn.length > 0) {
      updatePlayer(client, gameId, p.user_id, { hand: newHand });
    }
    return { ...p, hand: newHand };
  });

  // Mark round as done
  updateRound(client, roundRecord.round_id, { status: "done" });

  // Game ends when a player hits WIN_SCORE, or the deck couldn't fully replenish all hands
  const maxScore = Math.max(...replenished.map(p => p.score));
  const handsShort = replenished.some(p => p.hand.length < HAND_SIZE);
  const gameDone = maxScore >= WIN_SCORE || handsShort;

  // Determine next storyteller by rotating from the current one
  const playerIds = playerRecords.map(p => p.user_id);
  const currIdx = playerIds.indexOf(roundRecord.storyteller_id);
  const nextIdx = (currIdx + 1) % playerIds.length;
  const nextStorytellerId = playerIds[nextIdx];
  const nextRoundNum = gameRecord.current_round + 1;

  let winner: PlayerRecord | null = null;

  if (gameDone) {
    winner = replenished.reduce((best, p) => (p.score > best.score ? p : best));
    updateGame(client, gameId, { status: "ended" });

    const now = new Date().toISOString();
    for (const p of replenished) {
      const existing = getLeaderboardEntry(client, p.user_id);
      upsertLeaderboard(client, {
        user_id: p.user_id,
        username: p.username,
        total_games: (existing?.total_games ?? 0) + 1,
        total_wins: (existing?.total_wins ?? 0) + (p.user_id === winner!.user_id ? 1 : 0),
        total_score: (existing?.total_score ?? 0) + p.score,
        last_played: now,
      });
    }
  } else {
    updateGame(client, gameId, {
      current_round: nextRoundNum,
      storyteller_id: nextStorytellerId,
    });
  }

  return { gameDone, winner, updatedPlayers: replenished, nextStorytellerId, nextRoundNum };
}
