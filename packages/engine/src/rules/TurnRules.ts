import { findPlayer } from "../engine/stateHelpers";
import type { GameState } from "../models/GameState";

/**
 * Checks that apply to every move: the player is in the game, the game is in
 * progress, it is their turn and they still have cards.
 * Returns a message for the player, or null if all is well.
 */
export function getTurnError(state: GameState, playerId: string): string | null {
  const player = findPlayer(state, playerId);
  if (!player) {
    return "That player is not in this game.";
  }
  if (state.status !== "playing") {
    return "The game is not in progress.";
  }
  if (state.currentPlayerId !== playerId) {
    return "It's not your turn.";
  }
  if (player.hand.length === 0) {
    return "You have no cards left to play.";
  }
  return null;
}
