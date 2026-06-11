import { describe, it, expect } from "vitest";
import {
  calculateScores,
  validateVotes,
  Round,
  Player,
} from "../../../src/game/scoring";

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    storytellerId: "s1",
    storytellerCardId: "card-s",
    players: [],
    votes: {},
    ...overrides,
  };
}

function scoreOf(result: ReturnType<typeof calculateScores>, id: string): number {
  return result.scores.find((s) => s.playerId === id)?.points ?? 0;
}

// ─── All players guess correctly ───────────────────────────────────────────

describe("when ALL non-storyteller players guess the storyteller's card", () => {
  it("gives storyteller 0 points", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
      ],
      votes: { p1: "card-s", p2: "card-s" },
    });
    expect(scoreOf(calculateScores(round), "s1")).toBe(0);
  });

  it("gives each non-storyteller 2 points", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
      ],
      votes: { p1: "card-s", p2: "card-s" },
    });
    const result = calculateScores(round);
    expect(scoreOf(result, "p1")).toBe(2);
    expect(scoreOf(result, "p2")).toBe(2);
  });
});

// ─── No player guesses correctly ───────────────────────────────────────────

describe("when NO non-storyteller player guesses the storyteller's card", () => {
  it("gives storyteller 0 points", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
      ],
      votes: { p1: "card-2", p2: "card-1" },
    });
    expect(scoreOf(calculateScores(round), "s1")).toBe(0);
  });

  it("gives each non-storyteller 2 points base", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
      ],
      votes: { p1: "card-2", p2: "card-1" },
    });
    const result = calculateScores(round);
    // base 2 + 1 vote bonus each
    expect(scoreOf(result, "p1")).toBe(3);
    expect(scoreOf(result, "p2")).toBe(3);
  });

  it("does not give storyteller the base 2 points", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
      ],
      votes: { p1: "card-2", p2: "card-1" },
    });
    expect(scoreOf(calculateScores(round), "s1")).toBe(0);
  });
});

// ─── Some players guess correctly ──────────────────────────────────────────

describe("when SOME (but not all) players guess the storyteller's card", () => {
  it("gives storyteller 3 points", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
        { id: "p3", submittedCardId: "card-3" },
      ],
      votes: { p1: "card-s", p2: "card-3", p3: "card-1" },
    });
    expect(scoreOf(calculateScores(round), "s1")).toBe(3);
  });

  it("gives correct guesser 3 points (no vote bonus on their card)", () => {
    // votes arranged so p1's card receives 0 votes, isolating the base 3 pts
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
        { id: "p3", submittedCardId: "card-3" },
      ],
      votes: { p1: "card-s", p2: "card-3", p3: "card-2" },
    });
    expect(scoreOf(calculateScores(round), "p1")).toBe(3);
  });

  it("gives wrong guessers 0 base points (only vote bonuses possible)", () => {
    // p1 correct; p2 and p3 wrong — each gets only whatever vote bonus they earn
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
        { id: "p3", submittedCardId: "card-3" },
      ],
      votes: { p1: "card-s", p2: "card-3", p3: "card-2" },
    });
    const result = calculateScores(round);
    // p2: 0 base + 1 (p3 voted card-2) = 1
    expect(scoreOf(result, "p2")).toBe(1);
    // p3: 0 base + 1 (p2 voted card-3) = 1
    expect(scoreOf(result, "p3")).toBe(1);
  });
});

// ─── Vote bonus ─────────────────────────────────────────────────────────────

describe("vote bonuses", () => {
  it("gives +1 per vote received on a non-storyteller card", () => {
    const round2 = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
        { id: "p3", submittedCardId: "card-3" },
        { id: "p4", submittedCardId: "card-4" },
      ],
      votes: {
        p1: "card-2",
        p2: "card-s",
        p3: "card-2",
        p4: "card-s",
      },
    });
    const result = calculateScores(round2);
    // p2 and p4 guessed correctly → storyteller 3, p2 3, p4 3
    // p1 and p3 voted for card-2 (p2's) → p2 gets +2 vote bonus
    expect(scoreOf(result, "p2")).toBe(3 + 2);
  });

  it("does not award vote bonus to storyteller card", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "card-1" },
        { id: "p2", submittedCardId: "card-2" },
      ],
      votes: { p1: "card-s", p2: "card-s" },
    });
    // All guessed correctly → storyteller 0, others 2 each; no bonus for storyteller
    expect(scoreOf(calculateScores(round), "s1")).toBe(0);
  });
});

// ─── Player counts ──────────────────────────────────────────────────────────

describe("3-player game (storyteller + 2 others)", () => {
  it("handles all correct", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "c1" },
        { id: "p2", submittedCardId: "c2" },
      ],
      votes: { p1: "card-s", p2: "card-s" },
    });
    const r = calculateScores(round);
    expect(scoreOf(r, "s1")).toBe(0);
    expect(scoreOf(r, "p1")).toBe(2);
    expect(scoreOf(r, "p2")).toBe(2);
  });

  it("handles partial correct", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "c1" },
        { id: "p2", submittedCardId: "c2" },
      ],
      votes: { p1: "card-s", p2: "c1" },
    });
    const r = calculateScores(round);
    expect(scoreOf(r, "s1")).toBe(3);
    expect(scoreOf(r, "p1")).toBe(3 + 1); // correct + p2 voted for c1
    expect(scoreOf(r, "p2")).toBe(0);
  });
});

describe("4-player game (storyteller + 3 others)", () => {
  it("handles none correct", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "c1" },
        { id: "p2", submittedCardId: "c2" },
        { id: "p3", submittedCardId: "c3" },
      ],
      votes: { p1: "c2", p2: "c3", p3: "c1" },
    });
    const r = calculateScores(round);
    expect(scoreOf(r, "s1")).toBe(0);
    // base 2 each + 1 vote bonus each
    expect(scoreOf(r, "p1")).toBe(3);
    expect(scoreOf(r, "p2")).toBe(3);
    expect(scoreOf(r, "p3")).toBe(3);
  });
});

describe("5-player game (storyteller + 4 others)", () => {
  it("handles mixed voting", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "c1" },
        { id: "p2", submittedCardId: "c2" },
        { id: "p3", submittedCardId: "c3" },
        { id: "p4", submittedCardId: "c4" },
      ],
      votes: { p1: "card-s", p2: "card-s", p3: "c1", p4: "c2" },
    });
    const r = calculateScores(round);
    // 2 of 4 guessed correctly → storyteller 3, p1 3, p2 3
    expect(scoreOf(r, "s1")).toBe(3);
    expect(scoreOf(r, "p1")).toBe(3 + 1); // correct + p3 voted c1
    expect(scoreOf(r, "p2")).toBe(3 + 1); // correct + p4 voted c2
    expect(scoreOf(r, "p3")).toBe(0);
    expect(scoreOf(r, "p4")).toBe(0);
  });
});

describe("6-player game (storyteller + 5 others)", () => {
  it("handles all correct", () => {
    const players: Player[] = [
      { id: "p1", submittedCardId: "c1" },
      { id: "p2", submittedCardId: "c2" },
      { id: "p3", submittedCardId: "c3" },
      { id: "p4", submittedCardId: "c4" },
      { id: "p5", submittedCardId: "c5" },
    ];
    const round = makeRound({
      players,
      votes: {
        p1: "card-s",
        p2: "card-s",
        p3: "card-s",
        p4: "card-s",
        p5: "card-s",
      },
    });
    const r = calculateScores(round);
    expect(scoreOf(r, "s1")).toBe(0);
    for (const p of players) {
      expect(scoreOf(r, p.id)).toBe(2);
    }
  });
});

// ─── Vote validation ─────────────────────────────────────────────────────────

describe("validateVotes", () => {
  it("returns no errors for valid votes", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "c1" },
        { id: "p2", submittedCardId: "c2" },
      ],
      votes: { p1: "c2", p2: "c1" },
    });
    expect(validateVotes(round)).toHaveLength(0);
  });

  it("flags the storyteller voting", () => {
    const round = makeRound({
      players: [{ id: "p1", submittedCardId: "c1" }],
      votes: { s1: "c1" },
    });
    const errors = validateVotes(round);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ voterId: "s1", reason: "storyteller_voted" });
  });

  it("flags a player voting for their own submitted card", () => {
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "c1" },
        { id: "p2", submittedCardId: "c2" },
      ],
      votes: { p1: "c1", p2: "c1" },
    });
    const errors = validateVotes(round);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ voterId: "p1", reason: "voted_own_card" });
  });

  it("flags multiple violations simultaneously", () => {
    // s1 votes (storyteller_voted) + p1 votes their own card (voted_own_card)
    // p2 votes c1 (p1's card) — valid, should not produce an error
    const round = makeRound({
      players: [
        { id: "p1", submittedCardId: "c1" },
        { id: "p2", submittedCardId: "c2" },
      ],
      votes: { s1: "c1", p1: "c1", p2: "c1" },
    });
    const errors = validateVotes(round);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.reason)).toContain("storyteller_voted");
    expect(errors.map((e) => e.reason)).toContain("voted_own_card");
  });
});
