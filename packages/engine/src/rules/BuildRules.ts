import type { Card } from "../cards/Card";
import { splitIntoGroups } from "../cards/groups";
import { findCardInHand, getPlayer } from "../engine/stateHelpers";
import type { Build } from "../models/Build";
import type { GameState } from "../models/GameState";
import { SOUTH_AFRICAN_CASINO_RULES as RULES } from "./SouthAfricanCasinoRules";
import { getLooseCards, getLooseCardsError } from "./TableRules";
import { getTurnError } from "./TurnRules";

const ONE_BUILD_ONLY = "You already own a build, and you can only own one at a time.";
const STRONG_BUILD = "That build is strong, so it can't be changed. It can only be captured.";

/** "an 8", "a 7" and so on, for messages. */
export function valueWithArticle(value: number): string {
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
 * of that value afterwards to capture the build later.
 */
export function getCreateBuildError(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: readonly string[],
  value: number,
): string | null {
  const turnError = getTurnError(state, playerId);
  if (turnError) {
    return turnError;
  }
  const playedCard = findCardInHand(state, playerId, cardId);
  if (!playedCard) {
    return "That card is not in your hand.";
  }
  if (ownsBuild(state, playerId)) {
    return ONE_BUILD_ONLY;
  }
  if (tableCardIds.length === 0) {
    return "Choose the table cards you want to build with.";
  }
  const looseError = getLooseCardsError(state, tableCardIds);
  if (looseError) {
    return looseError;
  }
  if (!Number.isInteger(value) || value < 2 || value > RULES.maxBuildValue) {
    return `A build must be worth between 2 and ${RULES.maxBuildValue}.`;
  }
  if (!splitIntoGroups([playedCard, ...getLooseCards(state, tableCardIds)], value)) {
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
): boolean {
  return getCreateBuildError(state, playerId, cardId, tableCardIds, value) === null;
}

/** Every value these cards could be built into, e.g. hand 2 + loose 2 → [2, 4] if you hold a 2 and a 4. */
export function getPossibleBuildValues(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: readonly string[],
): number[] {
  const values: number[] = [];
  for (let value = 2; value <= RULES.maxBuildValue; value++) {
    if (canCreateBuild(state, playerId, cardId, tableCardIds, value)) {
      values.push(value);
    }
  }
  return values;
}

/**
 * Explains why these cards can't be added to the build, or returns null if they can.
 * The hand card (with any chosen loose cards) must form new sets that each add up to the
 * build's value. You can add to your own build, or to an opponent's weak build, which you
 * then take over.
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
 * Checks shared by ADD TO BUILD and STEAL: may the player change this build, do the played
 * card and `newCards` make new sets of the build's value, and does the player still keep
 * a card of that value afterwards?
 */
export function getNewSetsError(
  state: GameState,
  playerId: string,
  playedCard: Card,
  build: Build,
  newCards: readonly Card[],
): string | null {
  if (build.ownerId !== playerId) {
    if (isStrongBuild(build)) {
      return STRONG_BUILD;
    }
    if (ownsBuild(state, playerId)) {
      return ONE_BUILD_ONLY;
    }
  }
  if (!splitIntoGroups([playedCard, ...newCards], build.value)) {
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
 * Only an opponent's weak build can be raised, with one card from the hand and no table cards.
 * The raiser takes the build over, so they must hold a card of the new value.
 */
export function getRaiseBuildError(state: GameState, playerId: string, cardId: string, buildId: string): string | null {
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
  if (ownsBuild(state, playerId)) {
    return ONE_BUILD_ONLY;
  }
  const newValue = build.value + playedCard.value;
  if (newValue > RULES.maxBuildValue) {
    return `A build can't be worth more than ${RULES.maxBuildValue}.`;
  }
  if (!keepsValueAfterPlaying(getPlayer(state, playerId).hand, cardId, newValue)) {
    return `You need to keep ${valueWithArticle(newValue)} in your hand to capture this build.`;
  }
  return null;
}

export function canRaiseBuild(state: GameState, playerId: string, cardId: string, buildId: string): boolean {
  return getRaiseBuildError(state, playerId, cardId, buildId) === null;
}
