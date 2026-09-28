import { getTopCard } from "../engine/CapturePile";
import { findCardInHand } from "../engine/stateHelpers";
import type { GameState } from "../models/GameState";
import { findBuild, getNewSetsError } from "./BuildRules";
import { findCapturePileOwnerId, getStealCardError } from "./PileRules";
import { getLooseCards, getLooseCardsError } from "./TableRules";
import { getTurnError } from "./TurnRules";

/**
 * Explains why this steal isn't allowed, or returns null if it is.
 *
 * In one move the player plays `cardId` from their hand, takes the top card of another
 * player's capture pile (`stolenCardId`) and adds both, with any chosen loose table cards,
 * to their own build as new sets that each add up to the build's value (the stolen card may
 * be part of a sum, e.g. hand 7 + their top A added to a build of 8).
 */
export function getStealError(
  state: GameState,
  playerId: string,
  cardId: string,
  buildId: string,
  stolenCardId: string,
  tableCardIds: readonly string[],
): string | null {
  const turnError = getTurnError(state, playerId);
  if (turnError) {
    return turnError;
  }
  const playedCard = findCardInHand(state, playerId, cardId);
  if (!playedCard) {
    return "That card is not in your hand.";
  }
  const build = findBuild(state, buildId);
  if (!build) {
    return "That build is not on the table.";
  }
  const stealError = getStealCardError(state, playerId, stolenCardId);
  if (stealError) {
    return stealError;
  }
  const looseError = getLooseCardsError(state, tableCardIds);
  if (looseError) {
    return looseError;
  }
  const stolenCard = getTopCard(state.capturePiles[findCapturePileOwnerId(state, stolenCardId)!])!;
  return getNewSetsError(state, playerId, playedCard, build, [stolenCard, ...getLooseCards(state, tableCardIds)]);
}

export function canSteal(
  state: GameState,
  playerId: string,
  cardId: string,
  buildId: string,
  stolenCardId: string,
  tableCardIds: readonly string[],
): boolean {
  return getStealError(state, playerId, cardId, buildId, stolenCardId, tableCardIds) === null;
}
