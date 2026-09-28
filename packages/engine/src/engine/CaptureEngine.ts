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
 * capture-pile cards, which can only be taken together with a floor build of the value
 * (e.g. a 10 takes a 10 on the table and the 10 on top of an opponent's pile, or a 9 takes a
 * build of 9 and a floor 6 with the 3 on top of an opponent's pile). A matching top card can
 * bring the cards of the same value lying directly under it (their top 8♥ and the 8♠ under it).
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
  // Loose cards and any top cards form groups that each add up to the played card.
  const groupCards = [...looseCards, ...pileCards];
  const groups = groupCards.length > 0 ? splitIntoGroups(groupCards, playedCard.value)! : [];
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
