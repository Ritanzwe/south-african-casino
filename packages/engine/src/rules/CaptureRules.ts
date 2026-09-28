import type { Card } from "../cards/Card";
import { findGroupsAddingUpTo, splitIntoGroups } from "../cards/groups";
import { findCardInHand } from "../engine/stateHelpers";
import type { GameState } from "../models/GameState";
import { findBuild, getKeepCardError, valueWithArticle } from "./BuildRules";
import { getLooseCards, getLooseCardsError } from "./TableRules";
import { getTurnError } from "./TurnRules";

/** The groups of loose table cards that a card of this value could capture. */
export function getCaptureGroups(state: GameState, cardValue: number): Card[][] {
  return findGroupsAddingUpTo(state.tableCards, cardValue);
}

/** Ids of the loose table cards a card of this value could capture, e.g. to highlight them. */
export function getCapturableCardIds(state: GameState, cardValue: number): Set<string> {
  return new Set(getCaptureGroups(state, cardValue).flatMap((group) => group.map((card) => card.id)));
}

/** Ids of the builds a card of this value could capture (any build with the same value). */
export function getCapturableBuildIds(state: GameState, cardValue: number): Set<string> {
  return new Set(state.builds.filter((build) => build.value === cardValue).map((build) => build.id));
}

/**
 * Explains why this capture isn't allowed, or returns null if it is.
 * `cardId` is the card played from the hand. It can take loose table cards (in one group
 * or several, each adding up to the card) and any builds worth the same as the card.
 */
export function getCaptureError(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: readonly string[],
  buildIds: readonly string[] = [],
): string | null {
  const turnError = getTurnError(state, playerId);
  if (turnError) {
    return turnError;
  }
  const playedCard = findCardInHand(state, playerId, cardId);
  if (!playedCard) {
    return "That card is not in your hand.";
  }
  if (tableCardIds.length === 0 && buildIds.length === 0) {
    return "Choose the cards or builds you want to capture.";
  }

  const looseError = getLooseCardsError(state, tableCardIds);
  if (looseError) {
    return looseError;
  }
  if (new Set(buildIds).size !== buildIds.length) {
    return "You chose the same build twice.";
  }
  for (const buildId of buildIds) {
    const build = findBuild(state, buildId);
    if (!build) {
      return "That build is not on the table.";
    }
    if (build.value !== playedCard.value) {
      return `That build is worth ${build.value}, so it can only be captured with ${valueWithArticle(build.value)}.`;
    }
  }

  const looseCards = getLooseCards(state, tableCardIds);
  if (looseCards.length > 0 && !splitIntoGroups(looseCards, playedCard.value)) {
    return `Those cards don't add up to ${playedCard.value}. Each group you capture must add up to ${playedCard.value}.`;
  }
  return getKeepCardError(state, playerId, cardId, buildIds);
}

/** Can the player capture these loose table cards and builds with this card from their hand? */
export function canCapture(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: readonly string[],
  buildIds: readonly string[] = [],
): boolean {
  return getCaptureError(state, playerId, cardId, tableCardIds, buildIds) === null;
}
