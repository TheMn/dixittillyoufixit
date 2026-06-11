export interface Player {
  id: string;
  submittedCardId: string;
}

export interface Round {
  storytellerId: string;
  storytellerCardId: string;
  players: Player[];
  votes: Record<string, string>; // voterId -> cardId voted for
}

export interface PlayerScore {
  playerId: string;
  points: number;
}

export interface ScoreResult {
  scores: PlayerScore[];
}

export interface VoteValidationError {
  voterId: string;
  reason: "voted_own_card" | "storyteller_voted";
}

export function validateVotes(round: Round): VoteValidationError[] {
  const errors: VoteValidationError[] = [];
  const submissionMap: Record<string, string> = {};

  for (const player of round.players) {
    submissionMap[player.id] = player.submittedCardId;
  }
  submissionMap[round.storytellerId] = round.storytellerCardId;

  for (const [voterId, cardId] of Object.entries(round.votes)) {
    if (voterId === round.storytellerId) {
      errors.push({ voterId, reason: "storyteller_voted" });
      continue;
    }
    if (submissionMap[voterId] === cardId) {
      errors.push({ voterId, reason: "voted_own_card" });
    }
  }

  return errors;
}

export function calculateScores(round: Round): ScoreResult {
  const nonStorytellers = round.players.filter(
    (p) => p.id !== round.storytellerId
  );

  const correctGuessers = nonStorytellers.filter(
    (p) => round.votes[p.id] === round.storytellerCardId
  );

  const allGuessedCorrectly = correctGuessers.length === nonStorytellers.length;
  const noneGuessedCorrectly = correctGuessers.length === 0;

  const scores: Record<string, number> = {};
  for (const p of round.players) {
    scores[p.id] = 0;
  }
  scores[round.storytellerId] = 0;

  if (allGuessedCorrectly || noneGuessedCorrectly) {
    // Storyteller gets 0; all non-storytellers get 2
    for (const p of nonStorytellers) {
      scores[p.id] = (scores[p.id] ?? 0) + 2;
    }
  } else {
    // Storyteller and correct guessers each get 3
    scores[round.storytellerId] = 3;
    for (const p of correctGuessers) {
      scores[p.id] = (scores[p.id] ?? 0) + 3;
    }
  }

  // Vote bonuses: each non-storyteller card earns +1 per vote it received
  for (const votedCardId of Object.values(round.votes)) {
    if (votedCardId === round.storytellerCardId) continue;
    const owner = nonStorytellers.find((p) => p.submittedCardId === votedCardId);
    if (owner) {
      scores[owner.id] = (scores[owner.id] ?? 0) + 1;
    }
  }

  return {
    scores: Object.entries(scores).map(([playerId, points]) => ({
      playerId,
      points,
    })),
  };
}
