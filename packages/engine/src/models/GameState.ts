import type { Card } from "../cards/Card";
import type { PlayerCount } from "../rules/SouthAfricanCasinoRules";
import type { Build } from "./Build";
import type { Player } from "./Player";

export type GameStatus = "waiting" | "playing" | "finished";

/** One line in the game activity log, e.g. "Player 1 drifted 7♠." */
export interface GameLogEntry {
  id: number;
  message: string;
  /** The player the entry is about, if any. */
  playerId?: string;
}

export interface GameState {
  id: string;

  /** Players in seating order. Play goes clockwise: index 0 → 1 → 2 → … → back to 0. */
  players: Player[];
  playerCount: PlayerCount;

  /** Who dealt this game. */
  dealerId: string;
  /** Who was dealt first and plays first: the player to the dealer's left, or the previous loser. */
  startingPlayerId: string;
  /** The loser of the previous game in this session, if there was one. */
  previousLoserId?: string;
  /** Whose turn it is. */
  currentPlayerId: string;

  /** Cards not dealt yet. Only a 2-player game keeps cards here (for Phase 2). */
  deck: Card[];
  /** Loose cards lying face up on the table. */
  tableCards: Card[];
  builds: Build[];
  /** Each player's capture pile, keyed by player id. The LAST card in the array is the top card. */
  capturePiles: Record<string, Card[]>;

  /** Which game of the session this is: 1 for the first game, 2 after "Play again", and so on. */
  roundNumber: number;
  /** 2-player games have two deals (Phase 1 and Phase 2). 3- and 4-player games stay in Phase 1. */
  phase: 1 | 2;

  /** Who made the most recent capture. Drifting never changes this. */
  lastCapturePlayerId?: string;

  status: GameStatus;

  log: GameLogEntry[];
}
