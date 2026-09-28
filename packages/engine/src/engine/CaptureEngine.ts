import { formatCard, type Card } from "../cards/Card";
import { formatGroups, splitIntoGroups } from "../cards/groups";
import type { GameState } from "../models/GameState";
import { getCaptureError } from "../rules/CaptureRules";
import { findCapturePileOwnerId, getPileCards } from "../rules/StealRules";
import { getLooseCards } from "../rules/TableRules";
import { addToCapturePile } from "./CapturePile";
import { IllegalMoveError } from "./IllegalMoveError";
import { addLogEntry, findCardInHand, getPlayer, takeCardFromHand, takeTableCards } from "./stateHelpers";
import { endTurn } from "./TurnManager";

/**
 * CAPTURE: the player plays a card from their hand and takes cards that add up to it, in one
 * group or several: loose table cards and the top cards of other players' capture piles
 * (e.g. a 10 takes a 10 on the table and the 10 on top of an opponent's pile). It can also take
 * any builds of the same value.
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
  const groupCards = [...looseCards, ...pileCards];
  const groups = groupCards.length > 0 ? splitIntoGroups(groupCards, playedCard.value)! : [];
  const capturedBuilds = state.builds.filter((build) => buildIds.includes(build.id));
  const buildCards = capturedBuilds.flatMap((build) => build.sets.flat());

  // Take each top card off the pile it came from, then add everything to the capturer's pile.
  const pileOwners = new Map(pileCardIds.map((id) => [id, findCapturePileOwnerId(state, id)!]));
  const capturePiles = { ...state.capturePiles };
  for (const ownerId of pileOwners.values()) {
    capturePiles[ownerId] = capturePiles[ownerId].slice(0, -1);
  }
  capturePiles[playerId] = addToCapturePile(capturePiles[playerId], [...buildCards, ...groupCards], playedCard);

  const afterCapture: GameState = {
    ...takeTableCards(takeCardFromHand(state, playerId, cardId), tableCardIds),
    builds: state.builds.filter((build) => !buildIds.includes(build.id)),
    capturePiles,
    lastCapturePlayerId: playerId,
  };

  /** "10♦", or "10♦ from Ben's pile" for a card taken from someone's capture pile. */
  const describe = (card: Card) => {
    const ownerId = pileOwners.get(card.id);
    return ownerId ? `${formatCard(card)} from ${getPlayer(state, ownerId).name}'s pile` : formatCard(card);
  };
  const capturedText = [
    ...capturedBuilds.map((build) => {
      const owner = build.ownerId === playerId ? "their" : `${getPlayer(state, build.ownerId).name}'s`;
      return `${owner} build of ${build.value} (${formatGroups(build.sets)})`;
    }),
    ...groups.map((group) => group.map(describe).join(" + ")),
  ].join(" and ");
  return endTurn(
    addLogEntry(afterCapture, `${player.name} captured ${capturedText} with ${formatCard(playedCard)}.`, playerId),
  );
}
