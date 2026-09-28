import type { Card } from "../cards/Card";
import { findGroupsAddingUpTo, splitIntoGroups } from "../cards/groups";
import { findCardInHand } from "../engine/stateHelpers";
import type { GameState } from "../models/GameState";
import { findBuild, getKeepCardError, valueWithArticle } from "./BuildRules";
import { getPileCards, getStealCardError, getStealableCards } from "./StealRules";
import { getLooseCards, getLooseCardsError } from "./TableRules";
import { getTurnError } from "./TurnRules";

/** The groups of loose table cards that a card of this value could capture. */
export function getCaptureGroups(state: GameState, cardValue: number): Card[][] {
  return findGroupsAddingUpTo(state.tableCards, cardValue);
}

/**
 * Ids of the cards a card of this value could capture, e.g. to highlight them: loose table cards
 * and, when `playerId` is given, the top cards of the other players' capture piles.
 */
export function getCapturableCardIds(state: GameState, cardValue: number, playerId?: string): Set<string> {
  const pool = playerId ? [...state.tableCards, ...getStealableCards(state, playerId)] : state.tableCards;
  return new Set(findGroupsAddingUpTo(pool, cardValue).flatMap((group) => group.map((card) => card.id)));
}

/** Ids of the builds a card of this value could capture (any build with the same value). */
export function getCapturableBuildIds(state: GameState, cardValue: number): Set<string> {
  return new Set(state.builds.filter((build) => build.value === cardValue).map((build) => build.id));
}

/**
 * Explains why this capture isn't allowed, or returns null if it is.
 * `cardId` is the card played from the hand. It can take loose table cards and the top cards of
 * other players' capture piles (`pileCardIds`), in one group or several, each adding up to the
 * card, plus any builds worth the same as the card.
 */
export function getCaptureError(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: readonly string[],
  buildIds: readonly string[] = [],
  pileCardIds: readonly string[] = [],
): string | null {
  const turnError = getTurnError(state, playerId);
  if (turnError) {
    return turnError;
  }
  const playedCard = findCardInHand(state, playerId, cardId);
  if (!playedCard) {
    return "That card is not in your hand.";
  }
  if (tableCardIds.length === 0 && buildIds.length === 0 && pileCardIds.length === 0) {
    return "Choose the cards or builds you want to capture.";
  }

  const looseError = getLooseCardsError(state, tableCardIds);
  if (looseError) {
    return looseError;
  }
  if (new Set(pileCardIds).size !== pileCardIds.length) {
    return "You chose the same card twice.";
  }
  for (const pileCardId of pileCardIds) {
    const pileError = getStealCardError(state, playerId, pileCardId);
    if (pileError) {
      return pileError;
    }
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

  const groupCards = [...getLooseCards(state, tableCardIds), ...getPileCards(state, pileCardIds)];
  if (groupCards.length > 0 && !splitIntoGroups(groupCards, playedCard.value)) {
    return `Those cards don't add up to ${playedCard.value}. Each group you capture must add up to ${playedCard.value}.`;
  }
  return getKeepCardError(state, playerId, cardId, buildIds);
}

/** Can the player capture these cards and builds with this card from their hand? */
export function canCapture(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: readonly string[],
  buildIds: readonly string[] = [],
  pileCardIds: readonly string[] = [],
): boolean {
  return getCaptureError(state, playerId, cardId, tableCardIds, buildIds, pileCardIds) === null;
}
