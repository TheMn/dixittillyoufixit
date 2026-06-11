import type { InlineKeyboardMarkup } from "grammy/types";

// callback_data format: "select_card:{gameId}:{cardId}"
export function cardSelectionKeyboard(gameId: string, cardIds: string[]): InlineKeyboardMarkup {
  return {
    inline_keyboard: cardIds.map(cardId => [
      { text: `🃏 ${cardId}`, callback_data: `select_card:${gameId}:${cardId}` },
    ]),
  };
}

// callback_data format: "vote_card:{gameId}:{cardId}" — cards labeled by position (1, 2, 3…)
export function votingKeyboard(gameId: string, cardIds: string[]): InlineKeyboardMarkup {
  return {
    inline_keyboard: cardIds.map((cardId, i) => [
      { text: String(i + 1), callback_data: `vote_card:${gameId}:${cardId}` },
    ]),
  };
}

// callback_data format: "set_lang:{gameId}:{lang}"
export function langSwitcherKeyboard(gameId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "English 🇬🇧", callback_data: `set_lang:${gameId}:en` },
      { text: "فارسی 🇮🇷", callback_data: `set_lang:${gameId}:fa` },
    ]],
  };
}
