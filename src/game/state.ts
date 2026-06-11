export type GameStatus = "lobby" | "active" | "ended";

export interface GamePlayer {
  id: string;
  username: string;
  hand: string[]; // card IDs
  score: number;
}

export interface GameState {
  gameId: string;
  chatId: string;
  status: GameStatus;
  players: GamePlayer[];
  deck: string[]; // remaining card IDs not in any hand
  currentRound: number;
  storytellerIndex: number; // index into players array
  createdAt: number;
}

export function isLobby(state: GameState): boolean {
  return state.status === "lobby";
}

export function isActive(state: GameState): boolean {
  return state.status === "active";
}

export function isEnded(state: GameState): boolean {
  return state.status === "ended";
}

export function currentStoryteller(state: GameState): GamePlayer {
  return state.players[state.storytellerIndex];
}
