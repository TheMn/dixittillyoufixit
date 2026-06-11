import { describe, it, expect, beforeEach } from "vitest";
import { MockSheetsClient } from "../../src/sheets/client";
import {
  createRound,
  submitClue,
  submitCard,
  submitVote,
  revealRound,
  RoundState,
} from "../../src/game/rounds";

// ---------------------------------------------------------------------------
// Serialisation helpers — maps RoundState <-> the Rounds sheet schema:
//   round_id, game_id, round_num, clue, storyteller_card,
//   submissions (JSON), votes (JSON), status
// ---------------------------------------------------------------------------

function saveRound(client: MockSheetsClient, round: RoundState): void {
  const row = {
    round_id: round.roundId,
    game_id: round.gameId,
    round_num: String(round.roundNum),
    clue: round.clue ?? "",
    storyteller_card: round.storytellerCardId ?? "",
    submissions: JSON.stringify(round.submissions),
    votes: JSON.stringify(round.votes),
    status: round.phase,
    player_ids: JSON.stringify(round.playerIds),
    storyteller_id: round.storytellerId,
  };
  client.upsertRow("Rounds", "round_id", row);
}

function loadRound(client: MockSheetsClient, roundId: string): RoundState {
  const row = client.findRow("Rounds", "round_id", roundId);
  if (!row) throw new Error(`Round not found: ${roundId}`);
  return {
    roundId: row["round_id"],
    gameId: row["game_id"],
    roundNum: Number(row["round_num"]),
    phase: row["status"] as RoundState["phase"],
    storytellerId: row["storyteller_id"],
    playerIds: JSON.parse(row["player_ids"]),
    clue: row["clue"] || null,
    storytellerCardId: row["storyteller_card"] || null,
    submissions: JSON.parse(row["submissions"]),
    votes: JSON.parse(row["votes"]),
  };
}

// ---------------------------------------------------------------------------

describe("game-flow integration — full round lifecycle with MockSheetsClient", () => {
  let client: MockSheetsClient;

  beforeEach(() => {
    client = new MockSheetsClient();
  });

  it("should persist and reload round state correctly through all phases", () => {
    const playerIds = ["p0", "p1", "p2"];

    // Create and persist the initial round
    const initial = createRound("r1", "g1", 1, "p0", playerIds);
    saveRound(client, initial);
    expect(loadRound(client, "r1").phase).toBe("waiting_clue");

    // Storyteller submits clue
    const afterClue = submitClue(loadRound(client, "r1"), "p0", "flying castle", "card-st");
    expect(afterClue.ok).toBe(true);
    if (!afterClue.ok) return;
    saveRound(client, afterClue.state);

    const reloaded1 = loadRound(client, "r1");
    expect(reloaded1.phase).toBe("waiting_submissions");
    expect(reloaded1.clue).toBe("flying castle");
    expect(reloaded1.storytellerCardId).toBe("card-st");

    // p1 submits card
    const afterP1 = submitCard(loadRound(client, "r1"), "p1", "card-p1");
    expect(afterP1.ok).toBe(true);
    if (!afterP1.ok) return;
    saveRound(client, afterP1.state);
    expect(loadRound(client, "r1").phase).toBe("waiting_submissions");

    // p2 submits card — triggers auto-advance to waiting_votes
    const afterP2 = submitCard(loadRound(client, "r1"), "p2", "card-p2");
    expect(afterP2.ok).toBe(true);
    if (!afterP2.ok) return;
    saveRound(client, afterP2.state);

    const reloaded2 = loadRound(client, "r1");
    expect(reloaded2.phase).toBe("waiting_votes");
    expect(reloaded2.submissions).toEqual({ p1: "card-p1", p2: "card-p2" });

    // p1 votes for storyteller's card
    const afterV1 = submitVote(loadRound(client, "r1"), "p1", "card-st");
    expect(afterV1.ok).toBe(true);
    if (!afterV1.ok) return;
    saveRound(client, afterV1.state);
    expect(loadRound(client, "r1").phase).toBe("waiting_votes");

    // p2 votes — triggers auto-advance to revealing
    const afterV2 = submitVote(loadRound(client, "r1"), "p2", "card-p1");
    expect(afterV2.ok).toBe(true);
    if (!afterV2.ok) return;
    saveRound(client, afterV2.state);

    const reloaded3 = loadRound(client, "r1");
    expect(reloaded3.phase).toBe("revealing");
    expect(reloaded3.votes).toEqual({ p1: "card-st", p2: "card-p1" });

    // Reveal the round
    const afterReveal = revealRound(loadRound(client, "r1"));
    expect(afterReveal.ok).toBe(true);
    if (!afterReveal.ok) return;
    saveRound(client, afterReveal.state);

    const final = loadRound(client, "r1");
    expect(final.phase).toBe("done");
    expect(final.clue).toBe("flying castle");
    expect(Object.keys(final.submissions)).toHaveLength(2);
    expect(Object.keys(final.votes)).toHaveLength(2);
  });

  it("should keep the Games row unaffected by round updates", () => {
    client.appendRow("Games", { game_id: "g1", status: "active" });

    const round = createRound("r1", "g1", 1, "p0", ["p0", "p1", "p2"]);
    saveRound(client, round);
    saveRound(client, { ...round, phase: "waiting_submissions", clue: "test", storytellerCardId: "c1" });

    expect(client.findRow("Games", "game_id", "g1")!["status"]).toBe("active");
  });

  it("should support multiple simultaneous rounds in different games", () => {
    const r1 = createRound("r1", "g1", 1, "p0", ["p0", "p1", "p2"]);
    const r2 = createRound("r2", "g2", 1, "q0", ["q0", "q1", "q2"]);
    saveRound(client, r1);
    saveRound(client, r2);

    // Advance r1 only
    const clueResult = submitClue(loadRound(client, "r1"), "p0", "clue for g1", "card-g1");
    if (!clueResult.ok) throw new Error();
    saveRound(client, clueResult.state);

    expect(loadRound(client, "r1").phase).toBe("waiting_submissions");
    expect(loadRound(client, "r2").phase).toBe("waiting_clue");
  });
});
