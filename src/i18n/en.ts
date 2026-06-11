export const en: Record<string, string> = {
  // player
  "player.welcome": "Welcome to Dixit Bot! Use /newgame to start a game.",
  "player.joined": "{{username}} joined the game!",
  "player.full": "The game is full (6 players max).",
  "player.already_joined": "You are already in this game.",
  "player.lang_set": "Language set to English.",

  // game
  "game.created": "Game created! Others can join with /join.",
  "game.started": "The game has started!",
  "game.not_found": "No active game found in this chat.",
  "game.already_active": "A game is already active in this chat.",
  "game.not_enough_players": "Need at least 3 players to start.",
  "game.ended": "Game over!",
  "game.winner": "Winner: {{username}} with {{score}} points!",

  // round
  "round.start": "Round {{round}} begins!",
  "round.give_clue": "{{username}}, you are the storyteller. Send a clue for your card.",
  "round.submit_card": "Choose a card that fits the clue: {{clue}}",
  "round.waiting_submissions": "Waiting for {{count}} more player(s) to submit a card.",
  "round.vote": "All cards are in! Vote for the storyteller's card.",
  "round.reveal": "Revealing results...",
  "round.scores": "Scores this round:",
  "round.next": "Next round starting soon...",

  // scoring
  "scoring.storyteller_zero": "Storyteller gets 0 — all or none guessed correctly!",
  "scoring.correct_guess": "+3 for {{username}} (correct guess)",
  "scoring.bonus_vote": "+{{votes}} bonus vote(s) for {{username}}",

  // callback responses
  "callback.card_selected": "Card selected!",
  "callback.vote_recorded": "Vote recorded!",
  "callback.already_submitted": "You have already submitted a card.",
  "callback.already_voted": "You have already voted.",
  "callback.game_ended": "This game has already ended.",

  // error
  "error.generic": "Something went wrong. Please try again.",
  "error.unknown_command": "Unknown command. Use /help for available commands.",

  // leaderboard
  "leaderboard.title": "Leaderboard",
  "leaderboard.entry": "{{rank}}. {{username}} — {{score}} pts ({{wins}} wins)",
  "leaderboard.empty": "No games have been played yet.",
};
