import { formatCard } from "../cards/Card";
import { formatGroups, splitIntoGroups } from "../cards/groups";
import type { GameState } from "../models/GameState";
import { getCaptureError } from "../rules/CaptureRules";
import { getLooseCards } from "../rules/TableRules";
import { addToCapturePile } from "./CapturePile";
import { IllegalMoveError } from "./IllegalMoveError";
import { addLogEntry, findCardInHand, getPlayer, takeCardFromHand, takeTableCards } from "./stateHelpers";
import { endTurn } from "./TurnManager";

/**
 * CAPTURE: the player plays a card from their hand and takes loose table cards that add up
 * to it (in one group or several, e.g. an 8 takes 8 and 5 + 3) and/or builds of the same value.
 *
 * Everything captured goes onto the player's capture pile in the order it lay on the table,
 * with the capturing card on top. The player becomes the last capturer, and the turn ends.
 * Returns a new state; the state passed in is not changed.
 */
export function captureCards(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: string[],
  buildIds: string[] = [],
): GameState {
  const error = getCaptureError(state, playerId, cardId, tableCardIds, buildIds);
  if (error) {
    throw new IllegalMoveError(error);
  }

  const player = getPlayer(state, playerId);
  const playedCard = findCardInHand(state, playerId, cardId)!;
  const looseCards = getLooseCards(state, tableCardIds);
  const looseGroups = looseCards.length > 0 ? splitIntoGroups(looseCards, playedCard.value)! : [];
  const capturedBuilds = state.builds.filter((build) => buildIds.includes(build.id));
  const buildCards = capturedBuilds.flatMap((build) => build.sets.flat());

  const afterCapture: GameState = {
    ...takeTableCards(takeCardFromHand(state, playerId, cardId), tableCardIds),
    builds: state.builds.filter((build) => !buildIds.includes(build.id)),
    capturePiles: {
      ...state.capturePiles,
      [playerId]: addToCapturePile(state.capturePiles[playerId], [...buildCards, ...looseCards], playedCard),
    },
    lastCapturePlayerId: playerId,
  };

  const capturedText = [
    ...capturedBuilds.map((build) => {
      const owner = build.ownerId === playerId ? "their" : `${getPlayer(state, build.ownerId).name}'s`;
      return `${owner} build of ${build.value} (${formatGroups(build.sets)})`;
    }),
    ...(looseGroups.length > 0 ? [formatGroups(looseGroups)] : []),
  ].join(" and ");
  return endTurn(
    addLogEntry(afterCapture, `${player.name} captured ${capturedText} with ${formatCard(playedCard)}.`, playerId),
  );
}
