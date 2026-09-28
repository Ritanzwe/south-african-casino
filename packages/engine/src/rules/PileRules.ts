import type { Card } from "../cards/Card";
import { getTopCard } from "../engine/CapturePile";
import type { GameState } from "../models/GameState";

// Which capture-pile cards a player may reach. Only the top card of another player's pile,
// and only as part of a capture, a build or a steal that the rules allow (see CaptureRules,
// BuildRules and StealRules).

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

/** The capture-pile cards with these ids (check them with getStealCardError first). */
export function getPileCards(state: GameState, cardIds: readonly string[]): Card[] {
  return cardIds.map((cardId) => {
    const ownerId = findCapturePileOwnerId(state, cardId)!;
    return state.capturePiles[ownerId].find((card) => card.id === cardId)!;
  });
}

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
    return "Only the top card of a capture pile can be captured.";
  }
  return null;
}

/** Could the player reach this card? Only the top card of another player's capture pile can be reached. */
export function canStealCapturePileCard(state: GameState, playerId: string, cardId: string): boolean {
  return getStealCardError(state, playerId, cardId) === null;
}

/**
 * Checks top cards chosen for a capture or a build: all different, each the top card of
 * another player's pile. Returns a message, or null if they are fine.
 */
export function getPileCardsError(state: GameState, playerId: string, cardIds: readonly string[]): string | null {
  if (new Set(cardIds).size !== cardIds.length) {
    return "You chose the same card twice.";
  }
  for (const cardId of cardIds) {
    const error = getStealCardError(state, playerId, cardId);
    if (error) {
      return error;
    }
  }
  return null;
}
