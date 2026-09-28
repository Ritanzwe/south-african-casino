import { formatCard } from "../cards/Card";
import { formatGroups, splitIntoGroups } from "../cards/groups";
import type { Build } from "../models/Build";
import type { GameState } from "../models/GameState";
import {
  findBuild,
  getAddToBuildError,
  getCreateBuildError,
  getOwnedBuild,
  getRaiseBuildError,
  getRaisedValue,
} from "../rules/BuildRules";
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
 * Stores a build that the player now controls. If they already owned another build (which
 * the rules only allow when it has the same value), the two join into one: the player's own
 * build gets the new sets, and the other build disappears from the table.
 */
export function claimBuild(state: GameState, playerId: string, claimed: Build): GameState {
  const own = state.builds.find((build) => build.ownerId === playerId && build.id !== claimed.id);
  if (!own) {
    return replaceBuild(state, claimed);
  }
  return {
    ...state,
    builds: state.builds
      .filter((build) => build.id !== claimed.id)
      .map((build) => (build.id === own.id ? { ...own, sets: [...own.sets, ...claimed.sets] } : build)),
  };
}

/** How a log message ends when someone takes a build: taking it over, or joining it to their own. */
export function describeTakeOver(state: GameState, playerId: string, buildId: string): string {
  const own = getOwnedBuild(state, playerId);
  return own && own.id !== buildId ? `and joined it to their own build of ${own.value}` : "and took it over";
}

/**
 * BUILD: the player combines a card from their hand with loose table cards into a build worth
 * `value`, e.g. table 5 + hand 3 → a build of 8. If they already own a build of that value,
 * the new sets join it; otherwise it becomes their new build.
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
  // The table cards were there first; the played card goes on top of them.
  const sets = splitIntoGroups([...getLooseCards(state, tableCardIds), playedCard], value)!;
  const own = getOwnedBuild(state, playerId);
  const afterPlay = takeTableCards(takeCardFromHand(state, playerId, cardId), tableCardIds);

  if (own) {
    const joined = replaceBuild(afterPlay, { ...own, sets: [...own.sets, ...sets] });
    return endTurn(addLogEntry(joined, `${player.name} added ${formatGroups(sets)} to their build of ${value}.`, playerId));
  }
  const build: Build = { id: `build-${playedCard.id}`, sets, value, ownerId: playerId };
  const afterBuild: GameState = { ...afterPlay, builds: [...afterPlay.builds, build] };
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
  const newSets = splitIntoGroups([...getLooseCards(state, tableCardIds), playedCard], build.value)!;

  const afterAdd = claimBuild(takeTableCards(takeCardFromHand(state, playerId, cardId), tableCardIds), playerId, {
    ...build,
    sets: [...build.sets, ...newSets],
    ownerId: playerId,
  });
  const message =
    build.ownerId === playerId
      ? `${player.name} added ${formatGroups(newSets)} to their build of ${build.value}.`
      : `${player.name} added ${formatGroups(newSets)} to ${getPlayer(state, build.ownerId).name}'s build of ${build.value} ${describeTakeOver(state, playerId, buildId)}.`;
  return endTurn(addLogEntry(afterAdd, message, playerId));
}

/**
 * RAISE: the player adds a card from their hand, plus any loose table cards, to an opponent's
 * weak build, raising its value, and takes it over. The build is still one set, so it stays
 * weak (unless it joins the player's own build of the same value).
 */
export function raiseBuild(
  state: GameState,
  playerId: string,
  cardId: string,
  buildId: string,
  tableCardIds: string[] = [],
): GameState {
  const error = getRaiseBuildError(state, playerId, cardId, buildId, tableCardIds);
  if (error) {
    throw new IllegalMoveError(error);
  }

  const player = getPlayer(state, playerId);
  const build = findBuild(state, buildId)!;
  const playedCard = findCardInHand(state, playerId, cardId)!;
  const looseCards = getLooseCards(state, tableCardIds);
  const newValue = getRaisedValue(state, build, playedCard, tableCardIds);

  const afterRaise = claimBuild(takeTableCards(takeCardFromHand(state, playerId, cardId), tableCardIds), playerId, {
    ...build,
    sets: [[...build.sets[0], ...looseCards, playedCard]],
    value: newValue,
    ownerId: playerId,
  });
  const ownerName = getPlayer(state, build.ownerId).name;
  const withCards = [...looseCards, playedCard].map(formatCard).join(" + ");
  return endTurn(
    addLogEntry(
      afterRaise,
      `${player.name} raised ${ownerName}'s build from ${build.value} to ${newValue} with ${withCards} ${describeTakeOver(state, playerId, buildId)}.`,
      playerId,
    ),
  );
}
