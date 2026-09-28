import type { Card } from "../cards/Card";
import { getTopCard } from "../engine/CapturePile";
import type { GameState } from "../models/GameState";

// Which capture-pile cards a player may reach. Only the top card of another player's pile,
// and only as part of a capture, a build or a steal that the rules allow (see CaptureRules,
// BuildRules and StealRules). A capture that takes a top card with a card of the same value
// also takes the cards of that value lying directly under it.

/** Whose capture pile a card is in, if it is in one. */
export function findCapturePileOwnerId(state: GameState, cardId: string): string | undefined {
  return Object.keys(state.capturePiles).find((playerId) =>
    state.capturePiles[playerId].some((card) => card.id === cardId),
  );
}

/** The top cards of the other players' capture piles: the only capture-pile cards this player can reach. */
export function getStealableCards(state: GameState, playerId: string): Card[] {
  return state.players
    .filter((player) => player.id !== playerId)
    .map((player) => getTopCard(state.capturePiles[player.id]))
    .filter((card): card is Card => card !== undefined);
}

/**
 * The capture-pile cards with these ids (check them with getPileCardsError first), pile by pile
 * in the order they lie there, bottom first.
 */
export function getPileCards(state: GameState, cardIds: readonly string[]): Card[] {
  const ownerIds = [...new Set(cardIds.map((cardId) => findCapturePileOwnerId(state, cardId)!))];
  return ownerIds.flatMap((ownerId) => state.capturePiles[ownerId].filter((card) => cardIds.includes(card.id)));
}

/**
 * The cards of the same value lying directly under a top card, nearest first: e.g. the 8♠ under
 * another player's top 8♥. Empty when the card isn't the top card of a pile.
 */
export function getSameValueCardsBelow(state: GameState, topCardId: string): Card[] {
  const ownerId = findCapturePileOwnerId(state, topCardId);
  const pile = ownerId === undefined ? [] : state.capturePiles[ownerId];
  const topCard = getTopCard(pile);
  if (topCard?.id !== topCardId) {
    return [];
  }
  const below: Card[] = [];
  for (let i = pile.length - 2; i >= 0 && pile[i].value === topCard.value; i--) {
    below.push(pile[i]);
  }
  return below;
}

/**
 * These top cards plus, under each one worth `value`, the cards of that value lying directly under
 * it: what a capture with a card of `value` takes from the piles (their 8♥ and the 8♠ under it).
 */
export function addSameValueCardsBelow(state: GameState, pileCardIds: readonly string[], value: number): string[] {
  const below = pileCardIds.flatMap((cardId) =>
    getSameValueCardsBelow(state, cardId)
      .filter((card) => card.value === value)
      .map((card) => card.id),
  );
  return [...pileCardIds, ...below.filter((cardId) => !pileCardIds.includes(cardId))];
}

const ONLY_TOP_CARD = "Only the top card of a capture pile can be captured.";

/**
 * Checks that a capture-pile card may be reached: it has to be the top card of another player's
 * capture pile. Returns a message for the player, or null if it can be reached.
 */
export function getStealCardError(state: GameState, playerId: string, cardId: string): string | null {
  const ownerId = findCapturePileOwnerId(state, cardId);
  if (ownerId === undefined) {
    return "That card isn't in a capture pile.";
  }
  if (ownerId === playerId) {
    return "You can't take cards from your own capture pile.";
  }
  if (getTopCard(state.capturePiles[ownerId])?.id !== cardId) {
    return ONLY_TOP_CARD;
  }
  return null;
}

/** Could the player reach this card? Only the top card of another player's capture pile can be reached. */
export function canStealCapturePileCard(state: GameState, playerId: string, cardId: string): boolean {
  return getStealCardError(state, playerId, cardId) === null;
}

/**
 * Checks capture-pile cards chosen for a capture or a build: all different, each the top card of
 * another player's pile. A capture with a card worth `captureValue` may also take the cards of that
 * value lying directly under a top card of that value it takes. Returns a message, or null if they are fine.
 */
export function getPileCardsError(
  state: GameState,
  playerId: string,
  cardIds: readonly string[],
  captureValue?: number,
): string | null {
  if (new Set(cardIds).size !== cardIds.length) {
    return "You chose the same card twice.";
  }
  for (const cardId of cardIds) {
    const error = getStealCardError(state, playerId, cardId);
    if (error === ONLY_TOP_CARD && captureValue !== undefined) {
      if (!isTakenWithTopCard(state, cardId, cardIds, captureValue)) {
        return "Only the top card of a capture pile can be captured, together with any cards of the same value right under it.";
      }
    } else if (error) {
      return error;
    }
  }
  return null;
}

/**
 * Is this card (under the top card of another player's pile) one of the cards of `value` lying
 * directly under a top card of `value`, with that top card and every card between them chosen too?
 */
function isTakenWithTopCard(state: GameState, cardId: string, cardIds: readonly string[], value: number): boolean {
  const ownerId = findCapturePileOwnerId(state, cardId)!;
  const topCard = getTopCard(state.capturePiles[ownerId])!;
  const below = topCard.value === value ? getSameValueCardsBelow(state, topCard.id) : [];
  const depth = below.findIndex((card) => card.id === cardId);
  return depth >= 0 && [topCard, ...below.slice(0, depth)].every((card) => cardIds.includes(card.id));
}
