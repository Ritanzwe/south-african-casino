import { formatCard, type Card } from "../cards/Card";
import type { Build } from "../models/Build";
import type { GameLogEntry, GameState } from "../models/GameState";
import { findCapturePileOwnerId } from "../rules/PileRules";
import type { Player } from "../models/Player";

/** Finds a player by id. Returns undefined if they are not in the game. */
export function findPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

/** Finds a player by id. Throws if they are not in the game. */
export function getPlayer(state: GameState, playerId: string): Player {
  const player = findPlayer(state, playerId);
  if (!player) {
    throw new Error(`There is no player with id "${playerId}" in this game.`);
  }
  return player;
}

/**
 * The id of the player `seats` places to the left (clockwise) of the given player.
 * Use 1 for the next player to play, and -1 for the player on the right.
 */
export function getPlayerIdAfter(players: readonly Player[], playerId: string, seats = 1): string {
  const index = players.findIndex((player) => player.id === playerId);
  if (index === -1) {
    throw new Error(`There is no player with id "${playerId}" in this game.`);
  }
  const count = players.length;
  const nextIndex = (((index + seats) % count) + count) % count;
  return players[nextIndex].id;
}

/** The card with this id in the player's hand, if they hold it. */
export function findCardInHand(state: GameState, playerId: string, cardId: string): Card | undefined {
  return findPlayer(state, playerId)?.hand.find((card) => card.id === cardId);
}

/** Returns a copy of the state with the card removed from the player's hand. */
export function takeCardFromHand(state: GameState, playerId: string, cardId: string): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, hand: player.hand.filter((card) => card.id !== cardId) } : player,
    ),
  };
}

/** Returns a copy of the state without these loose table cards. */
export function takeTableCards(state: GameState, tableCardIds: readonly string[]): GameState {
  return { ...state, tableCards: state.tableCards.filter((card) => !tableCardIds.includes(card.id)) };
}

/** Returns a copy of the state with one build swapped for its updated version. */
export function replaceBuild(state: GameState, updated: Build): GameState {
  return { ...state, builds: state.builds.map((build) => (build.id === updated.id ? updated : build)) };
}

/** Returns a copy of the state with these top cards taken off the capture piles they were on. */
export function takeTopCards(state: GameState, cardIds: readonly string[]): GameState {
  if (cardIds.length === 0) {
    return state;
  }
  const capturePiles = { ...state.capturePiles };
  for (const cardId of cardIds) {
    const ownerId = findCapturePileOwnerId(state, cardId)!;
    capturePiles[ownerId] = capturePiles[ownerId].filter((card) => card.id !== cardId);
  }
  return { ...state, capturePiles };
}

/**
 * Text for groups of cards, saying whose capture pile any of them came from,
 * e.g. "6♦ + 4♣ and 10♥ from Ben's pile".
 */
export function describeGroups(
  state: GameState,
  groups: readonly (readonly Card[])[],
  pileCardIds: readonly string[] = [],
): string {
  const describe = (card: Card) => {
    if (!pileCardIds.includes(card.id)) {
      return formatCard(card);
    }
    const ownerName = getPlayer(state, findCapturePileOwnerId(state, card.id)!).name;
    return `${formatCard(card)} from ${ownerName}'s pile`;
  };
  return groups.map((group) => group.map(describe).join(" + ")).join(" and ");
}

/** Returns a copy of the state with a new line added to the game log. */
export function addLogEntry(state: GameState, message: string, playerId?: string): GameState {
  const entry: GameLogEntry = { id: state.log.length + 1, message };
  if (playerId) {
    entry.playerId = playerId;
  }
  return { ...state, log: [...state.log, entry] };
}
