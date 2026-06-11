export type RoundPhase =
  | "waiting_clue"
  | "waiting_submissions"
  | "waiting_votes"
  | "revealing"
  | "done";

export type RoundError =
  | "wrong_phase"
  | "not_storyteller"
  | "is_storyteller"
  | "player_not_in_round"
  | "already_submitted"
  | "already_voted"
  | "voted_own_card"
  | "storyteller_cannot_vote";

export interface RoundState {
  roundId: string;
  gameId: string;
  roundNum: number;
  phase: RoundPhase;
  storytellerId: string;
  playerIds: string[];
  clue: string | null;
  storytellerCardId: string | null;
  submissions: Record<string, string>; // non-storyteller playerId -> cardId
  votes: Record<string, string>;       // voterId -> cardId
}

export type RoundResult =
  | { ok: true; state: RoundState }
  | { ok: false; error: RoundError };

export function createRound(
  roundId: string,
  gameId: string,
  roundNum: number,
  storytellerId: string,
  playerIds: string[]
): RoundState {
  return {
    roundId,
    gameId,
    roundNum,
    phase: "waiting_clue",
    storytellerId,
    playerIds,
    clue: null,
    storytellerCardId: null,
    submissions: {},
    votes: {},
  };
}

export function submitClue(
  round: RoundState,
  playerId: string,
  clue: string,
  cardId: string
): RoundResult {
  if (round.phase !== "waiting_clue") {
    return { ok: false, error: "wrong_phase" };
  }
  if (playerId !== round.storytellerId) {
    return { ok: false, error: "not_storyteller" };
  }
  return {
    ok: true,
    state: {
      ...round,
      phase: "waiting_submissions",
      clue,
      storytellerCardId: cardId,
    },
  };
}

export function submitCard(
  round: RoundState,
  playerId: string,
  cardId: string
): RoundResult {
  if (round.phase !== "waiting_submissions") {
    return { ok: false, error: "wrong_phase" };
  }
  if (playerId === round.storytellerId) {
    return { ok: false, error: "is_storyteller" };
  }
  if (!round.playerIds.includes(playerId)) {
    return { ok: false, error: "player_not_in_round" };
  }
  if (round.submissions[playerId] !== undefined) {
    return { ok: false, error: "already_submitted" };
  }

  const submissions = { ...round.submissions, [playerId]: cardId };
  const nonStorytellers = round.playerIds.filter((id) => id !== round.storytellerId);
  const allSubmitted = nonStorytellers.every((id) => submissions[id] !== undefined);

  return {
    ok: true,
    state: {
      ...round,
      submissions,
      phase: allSubmitted ? "waiting_votes" : "waiting_submissions",
    },
  };
}

export function submitVote(
  round: RoundState,
  voterId: string,
  cardId: string
): RoundResult {
  if (round.phase !== "waiting_votes") {
    return { ok: false, error: "wrong_phase" };
  }
  if (voterId === round.storytellerId) {
    return { ok: false, error: "storyteller_cannot_vote" };
  }
  if (!round.playerIds.includes(voterId)) {
    return { ok: false, error: "player_not_in_round" };
  }
  if (round.votes[voterId] !== undefined) {
    return { ok: false, error: "already_voted" };
  }
  if (round.submissions[voterId] === cardId) {
    return { ok: false, error: "voted_own_card" };
  }

  const votes = { ...round.votes, [voterId]: cardId };
  const nonStorytellers = round.playerIds.filter((id) => id !== round.storytellerId);
  const allVoted = nonStorytellers.every((id) => votes[id] !== undefined);

  return {
    ok: true,
    state: {
      ...round,
      votes,
      phase: allVoted ? "revealing" : "waiting_votes",
    },
  };
}

export function revealRound(round: RoundState): RoundResult {
  if (round.phase !== "revealing") {
    return { ok: false, error: "wrong_phase" };
  }
  return {
    ok: true,
    state: { ...round, phase: "done" },
  };
}
