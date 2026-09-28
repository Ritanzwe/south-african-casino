import { formatCard } from "../cards/Card";
import { formatGroups, splitIntoGroups } from "../cards/groups";
import type { Build } from "../models/Build";
import type { GameState } from "../models/GameState";
import { findBuild, getAddToBuildError, getCreateBuildError, getRaiseBuildError } from "../rules/BuildRules";
import { getLooseCards } from "../rules/TableRules";
import { IllegalMoveError } from "./IllegalMoveError";
import {
  addLogEntry,
  findCardInHand,
  getPlayer,
  replaceBuild,
  takeCardFromHand,
  takeTableCards,
} from "./stateHelpers";
import { endTurn } from "./TurnManager";

/**
 * BUILD: the player combines a card from their hand with loose table cards into a new
 * build worth `value`, which they then own. e.g. hand 3 + table 5 → a build of 8.
 */
export function createBuild(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: string[],
  value: number,
): GameState {
  const error = getCreateBuildError(state, playerId, cardId, tableCardIds, value);
  if (error) {
    throw new IllegalMoveError(error);
  }

  const player = getPlayer(state, playerId);
  const playedCard = findCardInHand(state, playerId, cardId)!;
  const sets = splitIntoGroups([playedCard, ...getLooseCards(state, tableCardIds)], value)!;
  const build: Build = { id: `build-${playedCard.id}`, sets, value, ownerId: playerId };

  const afterBuild: GameState = {
    ...takeTableCards(takeCardFromHand(state, playerId, cardId), tableCardIds),
    builds: [...state.builds, build],
  };
  return endTurn(addLogEntry(afterBuild, `${player.name} made a build of ${value} (${formatGroups(sets)}).`, playerId));
}

/**
 * ADD TO BUILD: the player adds new sets of the same value to a build: their own, or an
 * opponent's weak build, which they then take over. The build becomes strong.
 */
export function addToBuild(
  state: GameState,
  playerId: string,
  cardId: string,
  buildId: string,
  tableCardIds: string[],
): GameState {
  const error = getAddToBuildError(state, playerId, cardId, buildId, tableCardIds);
  if (error) {
    throw new IllegalMoveError(error);
  }

  const player = getPlayer(state, playerId);
  const build = findBuild(state, buildId)!;
  const playedCard = findCardInHand(state, playerId, cardId)!;
  const newSets = splitIntoGroups([playedCard, ...getLooseCards(state, tableCardIds)], build.value)!;

  const afterAdd = replaceBuild(takeTableCards(takeCardFromHand(state, playerId, cardId), tableCardIds), {
    ...build,
    sets: [...build.sets, ...newSets],
    ownerId: playerId,
  });
  const message =
    build.ownerId === playerId
      ? `${player.name} added ${formatGroups(newSets)} to their build of ${build.value}.`
      : `${player.name} added ${formatGroups(newSets)} to ${getPlayer(state, build.ownerId).name}'s build of ${build.value} and took it over.`;
  return endTurn(addLogEntry(afterAdd, message, playerId));
}

/**
 * RAISE: the player adds one card from their hand to an opponent's weak build, raising
 * its value, and takes it over. The build is still one set, so it stays weak.
 */
export function raiseBuild(state: GameState, playerId: string, cardId: string, buildId: string): GameState {
  const error = getRaiseBuildError(state, playerId, cardId, buildId);
  if (error) {
    throw new IllegalMoveError(error);
  }

  const player = getPlayer(state, playerId);
  const build = findBuild(state, buildId)!;
  const playedCard = findCardInHand(state, playerId, cardId)!;
  const newValue = build.value + playedCard.value;

  const afterRaise = replaceBuild(takeCardFromHand(state, playerId, cardId), {
    ...build,
    sets: [[...build.sets[0], playedCard]],
    value: newValue,
    ownerId: playerId,
  });
  const ownerName = getPlayer(state, build.ownerId).name;
  return endTurn(
    addLogEntry(
      afterRaise,
      `${player.name} raised ${ownerName}'s build from ${build.value} to ${newValue} with ${formatCard(playedCard)} and took it over.`,
      playerId,
    ),
  );
}
