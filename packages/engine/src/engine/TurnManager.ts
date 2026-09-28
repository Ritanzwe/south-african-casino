import type { GameState } from "../models/GameState";
import { canDealSecondPhase, dealSecondPhase } from "./DealEngine";
import { finishGame } from "./EndOfHandEngine";
import { getPlayerIdAfter } from "./stateHelpers";

/** True when the game is in progress and it is this player's turn. */
export function isPlayersTurn(state: GameState, playerId: string): boolean {
  return state.status === "playing" && state.currentPlayerId === playerId;
}

/** The player who plays after the given player (the next seat clockwise). */
export function getNextPlayerId(state: GameState, playerId: string): string {
  return getPlayerIdAfter(state.players, playerId, 1);
}

/**
 * Finishes the current turn. Every action calls this once it is done.
 *
 * - Players still have cards: the next player (clockwise) takes their turn.
 * - Every hand is empty in Phase 1 of a 2-player game: Phase 2 is dealt.
 * - Every hand is empty and the deck is used up: the game is finished (see finishGame).
 */
export function endTurn(state: GameState): GameState {
  const everyHandIsEmpty = state.players.every((player) => player.hand.length === 0);

  if (!everyHandIsEmpty) {
    return { ...state, currentPlayerId: getNextPlayerId(state, state.currentPlayerId) };
  }

  if (canDealSecondPhase(state)) {
    return dealSecondPhase(state);
  }

  return finishGame(state);
}
