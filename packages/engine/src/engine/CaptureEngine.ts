import { formatCard } from "../cards/Card";
import { formatGroups, splitIntoGroups } from "../cards/groups";
import type { GameState } from "../models/GameState";
import { getCaptureError } from "../rules/CaptureRules";
import { getPileCards } from "../rules/PileRules";
import { getLooseCards } from "../rules/TableRules";
import { addToCapturePile } from "./CapturePile";
import { IllegalMoveError } from "./IllegalMoveError";
import {
  addLogEntry,
  describeGroups,
  findCardInHand,
  getPlayer,
  takeCardFromHand,
  takeTableCards,
  takeTopCards,
} from "./stateHelpers";
import { endTurn } from "./TurnManager";

/**
 * CAPTURE: the player plays a card from their hand and takes loose table cards that add up to
 * it (in one group or several), any builds of the same value, and other players' top
 * capture-pile cards of the same value, which can only be taken together with something from
 * the floor (e.g. a 10 takes a 10 on the table and the 10 on top of an opponent's pile).
 *
 * Everything captured goes onto the player's capture pile in the order it lay, with the
 * capturing card on top. The player becomes the last capturer, and the turn ends.
 * Returns a new state; the state passed in is not changed.
 */
export function captureCards(
  state: GameState,
  playerId: string,
  cardId: string,
  tableCardIds: string[],
  buildIds: string[] = [],
  pileCardIds: string[] = [],
): GameState {
  const error = getCaptureError(state, playerId, cardId, tableCardIds, buildIds, pileCardIds);
  if (error) {
    throw new IllegalMoveError(error);
  }

  const player = getPlayer(state, playerId);
  const playedCard = findCardInHand(state, playerId, cardId)!;
  const looseCards = getLooseCards(state, tableCardIds);
  const pileCards = getPileCards(state, pileCardIds);
  // Loose cards form groups that add up; each top card matches the played card on its own.
  const looseGroups = looseCards.length > 0 ? splitIntoGroups(looseCards, playedCard.value)! : [];
  const groups = [...looseGroups, ...pileCards.map((card) => [card])];
  const capturedBuilds = state.builds.filter((build) => buildIds.includes(build.id));
  const buildCards = capturedBuilds.flatMap((build) => build.sets.flat());

  const afterTaking = takeTopCards(takeTableCards(takeCardFromHand(state, playerId, cardId), tableCardIds), pileCardIds);
  const afterCapture: GameState = {
    ...afterTaking,
    builds: state.builds.filter((build) => !buildIds.includes(build.id)),
    capturePiles: {
      ...afterTaking.capturePiles,
      [playerId]: addToCapturePile(
        afterTaking.capturePiles[playerId],
        [...buildCards, ...looseCards, ...pileCards],
        playedCard,
      ),
    },
    lastCapturePlayerId: playerId,
  };

  const capturedText = [
    ...capturedBuilds.map((build) => {
      const owner = build.ownerId === playerId ? "their" : `${getPlayer(state, build.ownerId).name}'s`;
      return `${owner} build of ${build.value} (${formatGroups(build.sets)})`;
    }),
    ...(groups.length > 0 ? [describeGroups(state, groups, pileCardIds)] : []),
  ].join(" and ");
  return endTurn(
    addLogEntry(afterCapture, `${player.name} captured ${capturedText} with ${formatCard(playedCard)}.`, playerId),
  );
}
