import type { Card } from "../cards/Card";
import { findGroupsAddingUpTo, splitIntoGroups } from "../cards/groups";
import { findCardInHand } from "../engine/stateHelpers";
import type { GameState } from "../models/GameState";
import { findBuild, getKeepCardError, valueWithArticle } from "./BuildRules";
import {
  addSameValueCardsBelow,
  findCapturePileOwnerId,
  getPileCards,
  getPileCardsError,
  getStealableCards,
} from "./PileRules";
import { getLooseCards, getLooseCardsError } from "./TableRules";
import { getTurnError } from "./TurnRules";

/** The groups of loose table cards that a card of this value could capture. */
export function getCaptureGroups(state: GameState, cardValue: number): Card[][] {
  return findGroupsAddingUpTo(state.tableCards, cardValue);
}

/**
 * Ids of the cards a card of this value could capture, e.g. to highlight them: loose table cards
 * and, when `playerId` is given, the groups with other players' top cards (see getTopCardGroups),
 * plus the cards of the same value lying directly under those top cards.
 */
export function getCapturableCardIds(state: GameState, cardValue: number, playerId?: string): Set<string> {
  const ids = new Set(getCaptureGroups(state, cardValue).flatMap((group) => group.map((card) => card.id)));
  if (playerId) {
    const topGroupIds = getTopCardGroups(state, playerId, cardValue).flatMap((group) => group.map((card) => card.id));
    const topCardIds = topGroupIds.filter((cardId) => findCapturePileOwnerId(state, cardId) !== undefined);
    for (const cardId of [...topGroupIds, ...addSameValueCardsBelow(state, topCardIds, cardValue)]) {
      ids.add(cardId);
    }
  }
  return ids;
}

/**
 * The groups with other players' top capture-pile cards that a card of this value could capture:
 * a top card of the same value, or top cards adding up to it with loose table cards. A top card is
 * only taken together with a floor build of the value (see getCaptureError), so a group is only
 * listed when a build of the value, or a group of loose cards it doesn't use, is left for that.
 */
export function getTopCardGroups(state: GameState, playerId: string, cardValue: number): Card[][] {
  const topCards = getStealableCards(state, playerId);
  const hasBuild = state.builds.some((build) => build.value === cardValue);
  const floorGroups = getCaptureGroups(state, cardValue);
  return findGroupsAddingUpTo([...state.tableCards, ...topCards], cardValue).filter(
    (group) =>
      group.some((card) => topCards.includes(card)) &&
      (hasBuild || floorGroups.some((floorGroup) => floorGroup.every((card) => !group.includes(card)))),
  );
}

/** Ids of the builds a card of this value could capture (any build with the same value). */
export function getCapturableBuildIds(state: GameState, cardValue: number): Set<string> {
  return new Set(state.builds.filter((build) => build.value === cardValue).map((build) => build.id));
}

/**
 * Explains why this capture isn't allowed, or returns null if it is.
 * `cardId` is the card played from the hand. It can take loose table cards (in one group or
 * several, each adding up to the card), any builds worth the same as the card, and other
 * players' top capture-pile cards (`pileCardIds`). A top card is never taken on its own: the
 * same capture must take a floor build of the card's value (a build of it, or floor cards that
 * make it on their own). Then the top card can match the card, or be part of a group that adds
 * up to it (your 9 takes your build of 9 plus a floor 6 with their top 3). A top card that matches
 * can bring the cards of the same value lying directly under it (your 8 takes a floor 8, their
 * top 8♥ and the 8♠ under it).
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
  const pileError = getPileCardsError(state, playerId, pileCardIds, playedCard.value);
  if (pileError) {
    return pileError;
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
  if (pileCardIds.length > 0) {
    // Another player's top card needs a floor build of this value in the same capture.
    const takesFloorBuild = buildIds.length > 0 || findGroupsAddingUpTo(looseCards, playedCard.value).length > 0;
    if (!takesFloorBuild) {
      return `You can't take another player's top card on its own. There must be ${valueWithArticle(playedCard.value)} on the floor (a card, cards that add up to it, or a build) that you capture with it.`;
    }
  }
  const groupCards = [...looseCards, ...getPileCards(state, pileCardIds)];
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
