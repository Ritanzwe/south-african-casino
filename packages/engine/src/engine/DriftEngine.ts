import { formatCard } from "../cards/Card";
import type { GameState } from "../models/GameState";
import { getDriftError } from "../rules/DriftRules";
import { IllegalMoveError } from "./IllegalMoveError";
import { addLogEntry, findCardInHand, getPlayer, takeCardFromHand } from "./stateHelpers";
import { endTurn } from "./TurnManager";

/**
 * DRIFT: the player plays a card from their hand face up onto the table without capturing.
 *
 * Checks the move is legal, moves the card from the hand to the table, logs it and
 * ends the turn. Returns a new state; the state passed in is not changed.
 * A drift is never a capture, so lastCapturePlayerId stays as it was.
 */
export function drift(state: GameState, playerId: string, cardId: string): GameState {
  const error = getDriftError(state, playerId, cardId);
  if (error) {
    throw new IllegalMoveError(error);
  }

  const player = getPlayer(state, playerId);
  const card = findCardInHand(state, playerId, cardId)!;
  const afterDrift: GameState = {
    ...takeCardFromHand(state, playerId, cardId),
    tableCards: [...state.tableCards, card],
  };

  return endTurn(addLogEntry(afterDrift, `${player.name} drifted ${formatCard(card)}.`, playerId));
}
