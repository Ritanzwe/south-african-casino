import type { Card } from "../cards/Card";
import { getTopCard } from "../engine/CapturePile";
import { findCardInHand } from "../engine/stateHelpers";
import type { GameState } from "../models/GameState";
import { findBuild, getNewSetsError } from "./BuildRules";
import { getLooseCards, getLooseCardsError } from "./TableRules";
import { getTurnError } from "./TurnRules";

/** Whose capture pile a card is in, if it is in one. */
export function findCapturePileOwnerId(state: GameState, cardId: string): string | undefined {
  return Object.keys(state.capturePiles).find((playerId) =>
    state.capturePiles[playerId].some((card) => card.id === cardId),
  );
}

/**
 * The top cards of the other players' capture piles: the only capture-pile cards this player
 * can take, by capturing them or stealing them into a build.
 */
export function getStealableCards(state: GameState, playerId: string): Card[] {
  return state.players
    .filter((player) => player.id !== playerId)
    .map((player) => getTopCard(state.capturePiles[player.id]))
    .filter((card): card is Card => card !== undefined);
}

/** The capture-pile cards with these ids (check them with getStealCardError first). */
export function getPileCards(state: GameState, cardIds: readonly string[]): Card[] {
  return cardIds.map((cardId) => {
    const ownerId = findCapturePileOwnerId(state, cardId)!;
    return state.capturePiles[ownerId].find((card) => card.id === cardId)!;
  });
}

/**
 * Checks that a capture-pile card may be taken: it has to be the top card of another player's
 * capture pile. Returns a message for the player, or null if it can be taken.
 */
export function getStealCardError(state: GameState, playerId: string, cardId: string): string | null {
  const ownerId = findCapturePileOwnerId(state, cardId);
  if (ownerId === undefined) {
    return "That card isn't in a capture pile.";
  }
  if (ownerId === playerId) {
    return "You can't take cards from your own capture pile.";
  }
  if (getTopCard(state.capturePiles[ownerId])?.id !== cardId) {
    return "Only the top card of a capture pile can be captured.";
  }
  return null;
}

/** Could the player take this card? Only the top card of another player's capture pile can be taken. */
export function canStealCapturePileCard(state: GameState, playerId: string, cardId: string): boolean {
  return getStealCardError(state, playerId, cardId) === null;
}

/**
 * Explains why this steal isn't allowed, or returns null if it is.
 *
 * In one move the player plays `cardId` from their hand, takes the top card of another
 * player's capture pile (`stolenCardId`) and adds both, with any chosen loose table cards,
 * to a build as new sets that each add up to the build's value. The build must be their
 * own, or an opponent's weak build, which they then take over.
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
