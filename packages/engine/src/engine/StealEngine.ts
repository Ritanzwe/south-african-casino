import { formatCard } from "../cards/Card";
import { formatGroups, splitIntoGroups } from "../cards/groups";
import type { GameState } from "../models/GameState";
import { findBuild } from "../rules/BuildRules";
import { findCapturePileOwnerId, getStealError } from "../rules/StealRules";
import { getLooseCards } from "../rules/TableRules";
import { getTopCard } from "./CapturePile";
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
 * STEAL: in one move the player takes the top card of another player's capture pile and
 * adds it to a build together with a card from their hand (and any loose table cards),
 * as new sets of the build's value. e.g. hand 7 + stolen A♠ added to a build of 8.
 *
 * Stealing into an opponent's weak build takes it over. A steal is not a capture,
 * so lastCapturePlayerId stays as it was.
 */
export function stealIntoBuild(
  state: GameState,
  playerId: string,
  cardId: string,
  buildId: string,
  stolenCardId: string,
  tableCardIds: string[],
): GameState {
  const error = getStealError(state, playerId, cardId, buildId, stolenCardId, tableCardIds);
  if (error) {
    throw new IllegalMoveError(error);
  }

  const player = getPlayer(state, playerId);
  const build = findBuild(state, buildId)!;
  const playedCard = findCardInHand(state, playerId, cardId)!;
  const victimId = findCapturePileOwnerId(state, stolenCardId)!;
  const stolenCard = getTopCard(state.capturePiles[victimId])!;
  const newSets = splitIntoGroups([playedCard, stolenCard, ...getLooseCards(state, tableCardIds)], build.value)!;

  const afterSteal: GameState = {
    ...replaceBuild(takeTableCards(takeCardFromHand(state, playerId, cardId), tableCardIds), {
      ...build,
      sets: [...build.sets, ...newSets],
      ownerId: playerId,
    }),
    capturePiles: { ...state.capturePiles, [victimId]: state.capturePiles[victimId].slice(0, -1) },
  };

  const isOwnBuild = build.ownerId === playerId;
  const buildText = isOwnBuild
    ? `their build of ${build.value}`
    : `${getPlayer(state, build.ownerId).name}'s build of ${build.value} and took it over`;
  const message = `${player.name} stole ${formatCard(stolenCard)} from ${getPlayer(state, victimId).name}'s capture pile and added ${formatGroups(newSets)} to ${buildText}.`;
  return endTurn(addLogEntry(afterSteal, message, playerId));
}
