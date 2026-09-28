import type { Card } from "../cards/Card";
import type { GameState } from "../models/GameState";
import type { Player } from "../models/Player";
import { SOUTH_AFRICAN_CASINO_RULES as RULES } from "../rules/SouthAfricanCasinoRules";
import { addLogEntry, getPlayer, getPlayerIdAfter } from "./stateHelpers";

export interface DealResult {
  /** The cards dealt to each player, keyed by player id. */
  hands: Record<string, Card[]>;
  /** Cards dealt face up to the table. */
  tableCards: Card[];
  /** The cards still left in the deck. */
  deck: Card[];
}

/** Player ids in the order they receive cards: the starting player first, then clockwise. */
export function getDealOrder(players: readonly Player[], startingPlayerId: string): string[] {
  return players.map((_, seat) => getPlayerIdAfter(players, startingPlayerId, seat));
}

/**
 * Deals cards from the top of the deck (the start of the array).
 *
 * Cards go out one at a time, round the players in `dealOrder`, until everyone
 * has `cardsPerPlayer` cards. Then `faceUpCount` cards are placed face up on the table.
 * The deck passed in is not changed.
 */
export function dealCards(
  deck: readonly Card[],
  dealOrder: readonly string[],
  cardsPerPlayer: number,
  faceUpCount = 0,
): DealResult {
  const cardsNeeded = dealOrder.length * cardsPerPlayer + faceUpCount;
  if (deck.length < cardsNeeded) {
    throw new Error(`Not enough cards to deal: ${cardsNeeded} needed, but the deck has ${deck.length}.`);
  }

  const hands: Record<string, Card[]> = {};
  for (const playerId of dealOrder) {
    hands[playerId] = [];
  }

  let nextCard = 0;
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (const playerId of dealOrder) {
      hands[playerId].push(deck[nextCard]);
      nextCard++;
    }
  }

  const tableCards = deck.slice(nextCard, nextCard + faceUpCount);
  return { hands, tableCards, deck: deck.slice(nextCard + faceUpCount) };
}

/**
 * True when a 2-player game is ready for its second deal: both players have
 * played all their Phase 1 cards and the deck still has cards.
 */
export function canDealSecondPhase(state: GameState): boolean {
  return (
    RULES.secondDealForTwoPlayers &&
    state.playerCount === 2 &&
    state.phase === 1 &&
    state.deck.length > 0 &&
    state.players.every((player) => player.hand.length === 0)
  );
}

/**
 * Deals Phase 2 of a 2-player game: another 10 cards to each player.
 * No cards are dealt to the table, and the starting player plays first again.
 */
export function dealSecondPhase(state: GameState): GameState {
  if (!canDealSecondPhase(state)) {
    throw new Error("The second deal only happens in a 2-player game, once both players' hands are empty.");
  }

  const cardsPerPlayer = RULES.cardsPerPlayer[state.playerCount];
  const dealOrder = getDealOrder(state.players, state.startingPlayerId);
  const { hands, deck } = dealCards(state.deck, dealOrder, cardsPerPlayer);

  const dealt: GameState = {
    ...state,
    phase: 2,
    deck,
    players: state.players.map((player) => ({ ...player, hand: hands[player.id] })),
    currentPlayerId: state.startingPlayerId,
  };
  const startingName = getPlayer(state, state.startingPlayerId).name;
  return addLogEntry(dealt, `Phase 2: ${cardsPerPlayer} more cards dealt to each player. ${startingName} plays first.`);
}
