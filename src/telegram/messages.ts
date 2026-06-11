import { t } from "../i18n/index";

type Lang = "en" | "fa";

export function roundStartMessage(round: number, lang: Lang): string {
  return t("round.start", lang, { round });
}

export function storytellerPromptMessage(username: string, lang: Lang): string {
  return t("round.give_clue", lang, { username });
}

export function submitCardPromptMessage(clue: string, lang: Lang): string {
  return t("round.submit_card", lang, { clue });
}

export function waitingSubmissionsMessage(count: number, lang: Lang): string {
  return t("round.waiting_submissions", lang, { count });
}

export function votePromptMessage(lang: Lang): string {
  return t("round.vote", lang);
}

export interface RoundScoreEntry {
  username: string;
  delta: number;
  total: number;
}

export function revealMessage(entries: RoundScoreEntry[], lang: Lang): string {
  const lines = [t("round.reveal", lang), t("round.scores", lang)];
  for (const e of entries) {
    lines.push(`${e.username}: +${e.delta} → ${e.total}`);
  }
  return lines.join("\n");
}

export function nextRoundMessage(lang: Lang): string {
  return t("round.next", lang);
}

export function gameOverMessage(
  winner: { username: string; score: number },
  lang: Lang
): string {
  return [
    t("game.ended", lang),
    t("game.winner", lang, { username: winner.username, score: winner.score }),
  ].join("\n");
}
