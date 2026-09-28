import {
  IllegalMoveError,
  applyMove,
  createGame,
  type BotLevel,
  type GameState,
  type Move,
} from "@sa-casino/engine";

export type MoveResult = { ok: true; state: GameState } | { ok: false; error: string };

/** One seat at the table: a person, or a bot of some level. */
export interface SeatSetup {
  name: string;
  bot?: BotLevel;
}

/** Starts a new game on this device. */
export function startLocalGame(seats: SeatSetup[]): GameState {
  return createGame({
    players: seats.map((seat, i) => ({ id: `p${i + 1}`, name: seat.name, bot: seat.bot })),
  });
}

/** Starts the next game with the same players. The loser of the last game is dealt first and starts. */
export function startNextGame(previous: GameState, loserId: string): GameState {
  return createGame({
    players: previous.players.map(({ id, name, bot }) => ({ id, name, bot })),
    previousLoserId: loserId,
    roundNumber: previous.roundNumber + 1,
  });
}

/**
 * Asks the engine to play a move. In a local game the engine runs in the browser.
 * Online games (Stage 17) will send the same move to the server instead, and the
 * server will run the same engine to decide whether it is legal.
 */
export function playMove(state: GameState, playerId: string, move: Move): MoveResult {
  try {
    return { ok: true, state: applyMove(state, playerId, move) };
  } catch (error) {
    if (error instanceof IllegalMoveError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
