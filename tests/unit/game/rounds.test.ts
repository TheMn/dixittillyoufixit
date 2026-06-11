import { describe, it, expect } from "vitest";
import {
  createRound,
  submitClue,
  submitCard,
  submitVote,
  revealRound,
  RoundState,
} from "../../../src/game/rounds";

function makeRound(playerCount = 3): RoundState {
  const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i}`);
  return createRound("r1", "g1", 1, "p0", playerIds);
}

function withClue(round: RoundState, cardId = "card-st"): RoundState {
  const result = submitClue(round, "p0", "mysterious island", cardId);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function withAllSubmissions(round: RoundState): RoundState {
  const nonStorytellers = round.playerIds.filter((id) => id !== round.storytellerId);
  let state = round;
  for (const id of nonStorytellers) {
    const result = submitCard(state, id, `card-${id}`);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
  return state;
}

function withAllVotes(round: RoundState, targetCard = "card-st"): RoundState {
  const nonStorytellers = round.playerIds.filter((id) => id !== round.storytellerId);
  let state = round;
  for (const id of nonStorytellers) {
    const result = submitVote(state, id, targetCard);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
  return state;
}

// ---------------------------------------------------------------------------

describe("createRound", () => {
  it("should produce a waiting_clue round with the given storyteller and players", () => {
    const round = makeRound(4);
    expect(round.phase).toBe("waiting_clue");
    expect(round.storytellerId).toBe("p0");
    expect(round.playerIds).toHaveLength(4);
    expect(round.clue).toBeNull();
    expect(round.storytellerCardId).toBeNull();
    expect(round.submissions).toEqual({});
    expect(round.votes).toEqual({});
  });
});

// ---------------------------------------------------------------------------

describe("submitClue", () => {
  it("should transition to waiting_submissions and record clue and card", () => {
    const round = makeRound();
    const result = submitClue(round, "p0", "dreamy forest", "card-42");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("waiting_submissions");
    expect(result.state.clue).toBe("dreamy forest");
    expect(result.state.storytellerCardId).toBe("card-42");
  });

  it("should reject when a non-storyteller submits the clue", () => {
    const round = makeRound();
    const result = submitClue(round, "p1", "dreamy forest", "card-42");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not_storyteller");
  });

  it("should reject when not in waiting_clue phase", () => {
    const round = withClue(makeRound()); // now in waiting_submissions
    const result = submitClue(round, "p0", "another clue", "card-99");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("wrong_phase");
  });
});

// ---------------------------------------------------------------------------

describe("submitCard", () => {
  it("should record the card and stay in waiting_submissions until all players submit", () => {
    const round = withClue(makeRound(4));
    const result = submitCard(round, "p1", "card-p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("waiting_submissions");
    expect(result.state.submissions["p1"]).toBe("card-p1");
  });

  it("should auto-advance to waiting_votes when all non-storytellers have submitted", () => {
    const round = withClue(makeRound(3));
    // p1 submits
    const r1 = submitCard(round, "p1", "card-p1");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.state.phase).toBe("waiting_submissions"); // p2 still pending
    // p2 submits — all done
    const r2 = submitCard(r1.state, "p2", "card-p2");
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.state.phase).toBe("waiting_votes");
  });

  it("should reject when the storyteller tries to submit a card", () => {
    const round = withClue(makeRound());
    const result = submitCard(round, "p0", "card-p0");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("is_storyteller");
  });

  it("should reject a duplicate card submission from the same player", () => {
    const round = withClue(makeRound(4));
    const r1 = submitCard(round, "p1", "card-p1");
    if (!r1.ok) throw new Error();
    const r2 = submitCard(r1.state, "p1", "card-p1-again");
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.error).toBe("already_submitted");
  });

  it("should reject a player who is not in the round", () => {
    const round = withClue(makeRound(3));
    const result = submitCard(round, "stranger", "card-x");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("player_not_in_round");
  });

  it("should reject when not in waiting_submissions phase", () => {
    const round = makeRound(); // still waiting_clue
    const result = submitCard(round, "p1", "card-p1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("wrong_phase");
  });
});

// ---------------------------------------------------------------------------

describe("submitVote", () => {
  it("should record a vote and stay in waiting_votes until all players vote", () => {
    const round = withAllSubmissions(withClue(makeRound(4)));
    const result = submitVote(round, "p1", "card-st");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("waiting_votes"); // p2, p3 still pending
    expect(result.state.votes["p1"]).toBe("card-st");
  });

  it("should auto-advance to revealing when all non-storytellers have voted", () => {
    const round = withAllSubmissions(withClue(makeRound(3)));
    const r1 = submitVote(round, "p1", "card-st");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.state.phase).toBe("waiting_votes"); // p2 still pending
    const r2 = submitVote(r1.state, "p2", "card-st");
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.state.phase).toBe("revealing");
  });

  it("should reject voting before all cards are submitted (wrong phase)", () => {
    const round = withClue(makeRound(3)); // still in waiting_submissions
    const result = submitVote(round, "p1", "card-st");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("wrong_phase");
  });

  it("should reject the storyteller voting", () => {
    const round = withAllSubmissions(withClue(makeRound(3)));
    const result = submitVote(round, "p0", "card-p1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("storyteller_cannot_vote");
  });

  it("should reject a player voting for their own submitted card", () => {
    const round = withAllSubmissions(withClue(makeRound(3)));
    const result = submitVote(round, "p1", "card-p1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("voted_own_card");
  });

  it("should reject a duplicate vote from the same player", () => {
    const round = withAllSubmissions(withClue(makeRound(4)));
    const r1 = submitVote(round, "p1", "card-st");
    if (!r1.ok) throw new Error();
    const r2 = submitVote(r1.state, "p1", "card-p2");
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.error).toBe("already_voted");
  });

  it("should reject a voter not in the round", () => {
    const round = withAllSubmissions(withClue(makeRound(3)));
    const result = submitVote(round, "stranger", "card-st");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("player_not_in_round");
  });
});

// ---------------------------------------------------------------------------

describe("revealRound", () => {
  it("should transition from revealing to done", () => {
    const round = withAllVotes(withAllSubmissions(withClue(makeRound(3))));
    expect(round.phase).toBe("revealing");
    const result = revealRound(round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("done");
  });

  it("should reject when not in revealing phase", () => {
    const notRevealing = withAllSubmissions(withClue(makeRound(3)));
    const result = revealRound(notRevealing);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("wrong_phase");
  });
});

// ---------------------------------------------------------------------------

describe("full phase transition sequence", () => {
  it.each([3, 4, 5, 6] as const)(
    "should complete a full round with %d players without errors",
    (count) => {
      let round = makeRound(count);
      expect(round.phase).toBe("waiting_clue");

      round = withClue(round);
      expect(round.phase).toBe("waiting_submissions");

      round = withAllSubmissions(round);
      expect(round.phase).toBe("waiting_votes");

      round = withAllVotes(round);
      expect(round.phase).toBe("revealing");

      const result = revealRound(round);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.phase).toBe("done");
    }
  );

  it("should preserve all state (clue, submissions, votes) after reveal", () => {
    let round = makeRound(3);
    round = withClue(round, "card-st");
    round = withAllSubmissions(round);
    round = withAllVotes(round, "card-st");
    const result = revealRound(round);
    if (!result.ok) throw new Error();
    expect(result.state.clue).toBe("mysterious island");
    expect(result.state.storytellerCardId).toBe("card-st");
    expect(Object.keys(result.state.submissions)).toHaveLength(2);
    expect(Object.keys(result.state.votes)).toHaveLength(2);
  });
});
