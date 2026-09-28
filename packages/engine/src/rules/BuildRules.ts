import type { Card } from "../cards/Card";
import { findGroupsAddingUpTo, splitIntoGroups } from "../cards/groups";
import { findCardInHand, getPlayer } from "../engine/stateHelpers";
import type { Build } from "../models/Build";
import type { GameState } from "../models/GameState";
import { getPileCards, getPileCardsError } from "./PileRules";
import { SOUTH_AFRICAN_CASINO_RULES as RULES } from "./SouthAfricanCasinoRules";
import { getLooseCards, getLooseCardsError } from "./TableRules";
import { getTurnError } from "./TurnRules";

const STRONG_BUILD = "That build is strong, so it can't be changed. It can only be captured.";

/** "an Ace", "an 8", "a 7" and so on, for messages. */
export function valueWithArticle(value: number): string {
  if (value === 1) {
    return "an Ace";
  }
  return `${value === 8 ? "an" : "a"} ${value}`;
}

export function findBuild(state: GameState, buildId: string): Build | undefined {
  return state.builds.find((build) => build.id === buildId);
}

/** The build this player controls, if any. A player can own only one build at a time. */
export function getOwnedBuild(state: GameState, playerId: string): Build | undefined {
  return state.builds.find((build) => build.ownerId === playerId);
}

/**
 * Does this player own a build on the table?
 * A build owner normally can't drift: they must add to their build or capture something.
 */
export function ownsBuild(state: GameState, playerId: string): boolean {
  return getOwnedBuild(state, playerId) !== undefined;
}

/** A weak build is still its original single set. A strong build has two or more sets. */
export function isStrongBuild(build: Build): boolean {
  return build.sets.length > 1;
}

/**
 * A player owns one build at a time. They may still make or take over another build if it ends
 * up worth the same as the one they own: the two then join into one build.
 * Returns a message if the new build can't be theirs, or null if it can.
 */
function getSecondBuildError(state: GameState, playerId: string, newBuildValue: number): string | null {
  const own = getOwnedBuild(state, playerId);
  if (!own || own.value === newBuildValue) {
    return null;
  }
  return `You already own a build of ${own.value}. Another build must also be worth ${own.value}, and then the two join into one.`;
}

/** Will the player still hold a card of this value after playing `playedCardId`? */
function keepsValueAfterPlaying(hand: readonly Card[], playedCardId: string, value: number): boolean {
  return hand.some((card) => card.id !== playedCardId && card.value === value);
}

/**
 * The "keep a card" rule: a build owner must always hold a card of their build's value,
 * so they can capture it later. Playing their last such card is only allowed when the
 * move captures that build (listed in `capturedBuildIds`).
 */
export function getKeepCardError(
  state: GameState,
  playerId: string,
  playedCardId: string,
  capturedBuildIds: readonly string[] = [],
): string | null {
  const build = getOwnedBuild(state, playerId);
  if (!build || capturedBuildIds.includes(build.id)) {
    return null;
  }
  if (keepsValueAfterPlaying(getPlayer(state, playerId).hand, playedCardId, build.value)) {
    return null;
  }
  return `You must keep ${valueWithArticle(build.value)} in your hand to capture your build.`;
}

/**
 * Explains why this new build isn't allowed, or returns null if it is.
 * The hand card and the chosen loose table cards must form sets that each add up to `value`
 * (one set like 3 + 5, or several like 3 + 5 and 8), and the player must still hold a card
 * of that value afterwards to capture the build later. If the player already owns a build
 * of the same value, the new sets join it.
 *
 * Other players' top capture-pile cards (`pileCardIds`) can go in too, but only when the floor
 * already makes `value`: the chosen floor cards on their own, or a build of that value the
 * player owns. They can be a set on their own or part of a sum, e.g. floor 9 + your 4 + their
 * top 5 makes a strong build of 9; floor 6 + 4, their top 10 and your 10 make one of 10.
 */
export function getCreateBuildError(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: readonly string[],
  value: number,
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
  if (tableCardIds.length === 0) {
    return "Choose the table cards you want to build with.";
  }
  const looseError = getLooseCardsError(state, tableCardIds);
  if (looseError) {
    return looseError;
  }
  const pileError = getPileCardsError(state, playerId, pileCardIds);
  if (pileError) {
    return pileError;
  }
  if (!Number.isInteger(value) || value < RULES.minBuildValue || value > RULES.maxBuildValue) {
    return `A build must be worth between ${RULES.minBuildValue} and ${RULES.maxBuildValue}.`;
  }
  const secondBuildError = getSecondBuildError(state, playerId, value);
  if (secondBuildError) {
    return secondBuildError;
  }
  const looseCards = getLooseCards(state, tableCardIds);
  if (pileCardIds.length > 0) {
    // The floor must already make the value: either the chosen floor cards on their own, or a
    // build of that value the player already owns (the new sets then join it).
    const ownsBuildOfValue = getOwnedBuild(state, playerId)?.value === value;
    if (!ownsBuildOfValue && findGroupsAddingUpTo(looseCards, value).length === 0) {
      return `To use another player's top card, the floor cards must already make ${value} on their own (like a 9 on the floor for a build of 9).`;
    }
  }
  if (!splitIntoGroups([...looseCards, playedCard, ...getPileCards(state, pileCardIds)], value)) {
    return `Those cards don't make a build of ${value}. Every set in a build must add up to ${value}.`;
  }
  if (!keepsValueAfterPlaying(getPlayer(state, playerId).hand, cardId, value)) {
    return `You need to keep ${valueWithArticle(value)} in your hand to capture this build later.`;
  }
  return null;
}

export function canCreateBuild(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: readonly string[],
  value: number,
  pileCardIds: readonly string[] = [],
): boolean {
  return getCreateBuildError(state, playerId, cardId, tableCardIds, value, pileCardIds) === null;
}

/** Every value these cards could be built into, e.g. hand 2 + loose 2 → [2, 4] if you hold a 2 and a 4. */
export function getPossibleBuildValues(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: readonly string[],
  pileCardIds: readonly string[] = [],
): number[] {
  const values: number[] = [];
  for (let value = RULES.minBuildValue; value <= RULES.maxBuildValue; value++) {
    if (canCreateBuild(state, playerId, cardId, tableCardIds, value, pileCardIds)) {
      values.push(value);
    }
  }
  return values;
}

/**
 * Explains why these cards can't be added to the build, or returns null if they can.
 * The hand card (with any chosen loose cards) must form new sets that each add up to the
 * build's value. Only your own build can be added to: another player's build can only be
 * captured, or raised to a new value if it's weak.
 */
export function getAddToBuildError(
  state: GameState,
  playerId: string,
  cardId: string,
  buildId: string,
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
  const looseError = getLooseCardsError(state, tableCardIds);
  if (looseError) {
    return looseError;
  }
  return getNewSetsError(state, playerId, playedCard, build, getLooseCards(state, tableCardIds));
}

/**
 * Checks shared by ADD TO BUILD and STEAL: is it the player's own build, do the played card
 * and `newCards` make new sets of the build's value, and does the player still keep a card
 * of that value afterwards?
 */
export function getNewSetsError(
  state: GameState,
  playerId: string,
  playedCard: Card,
  build: Build,
  newCards: readonly Card[],
): string | null {
  // Another player's build can't have sets of the same value added to it: it can only be
  // captured, or (if it's weak and worth less than 10) raised to a new value.
  if (build.ownerId !== playerId) {
    if (isStrongBuild(build)) {
      return STRONG_BUILD;
    }
    return build.value < RULES.maxBuildValue
      ? "You can't add to another player's build. You can capture it, or raise it to a new value."
      : "You can't add to another player's build. You can only capture it.";
  }
  if (!splitIntoGroups([...newCards, playedCard], build.value)) {
    return `Every set you add to this build must add up to ${build.value}.`;
  }
  if (!keepsValueAfterPlaying(getPlayer(state, playerId).hand, playedCard.id, build.value)) {
    return `You need to keep ${valueWithArticle(build.value)} in your hand to capture this build.`;
  }
  return null;
}

export function canAddToBuild(
  state: GameState,
  playerId: string,
  cardId: string,
  buildId: string,
  tableCardIds: readonly string[],
): boolean {
  return getAddToBuildError(state, playerId, cardId, buildId, tableCardIds) === null;
}

/**
 * Explains why the player can't raise this build, or returns null if they can.
 * Only an opponent's weak build can be raised: with one card from the hand, plus any loose
 * table cards. The raiser takes the build over (joining it to their own build if that ends up
 * the same value), so they must hold a card of the new value.
 */
export function getRaiseBuildError(
  state: GameState,
  playerId: string,
  cardId: string,
  buildId: string,
  tableCardIds: readonly string[] = [],
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
  if (build.ownerId === playerId) {
    return "You can't raise your own build. You can add a set of the same value instead.";
  }
  if (isStrongBuild(build)) {
    return STRONG_BUILD;
  }
  const looseError = getLooseCardsError(state, tableCardIds);
  if (looseError) {
    return looseError;
  }
  const newValue = getRaisedValue(state, build, playedCard, tableCardIds);
  if (newValue > RULES.maxBuildValue) {
    return `That would make ${newValue}. A build can't be worth more than ${RULES.maxBuildValue}.`;
  }
  const secondBuildError = getSecondBuildError(state, playerId, newValue);
  if (secondBuildError) {
    return secondBuildError;
  }
  if (!keepsValueAfterPlaying(getPlayer(state, playerId).hand, cardId, newValue)) {
    return `You need to keep ${valueWithArticle(newValue)} in your hand to capture this build.`;
  }
  return null;
}

/** What a build would be worth after raising it with this hand card and these loose table cards. */
export function getRaisedValue(state: GameState, build: Build, playedCard: Card, tableCardIds: readonly string[]): number {
  const looseTotal = getLooseCards(state, tableCardIds).reduce((sum, card) => sum + card.value, 0);
  return build.value + playedCard.value + looseTotal;
}

export function canRaiseBuild(
  state: GameState,
  playerId: string,
  cardId: string,
  buildId: string,
  tableCardIds: readonly string[] = [],
): boolean {
  return getRaiseBuildError(state, playerId, cardId, buildId, tableCardIds) === null;
}
