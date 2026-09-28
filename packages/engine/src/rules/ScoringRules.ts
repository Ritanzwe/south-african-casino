import type { Card, Rank, Suit } from "../cards/Card";

/** How many spades are in a pile of cards. */
export function countSpades(cards: readonly Card[]): number {
  return cards.filter((card) => card.suit === "spades").length;
}

/** How many Aces are in a pile of cards. */
export function countAces(cards: readonly Card[]): number {
  return cards.filter((card) => card.rank === "A").length;
}

/** Is this particular card in the pile? e.g. hasCard(pile, "10", "diamonds"). */
export function hasCard(cards: readonly Card[], rank: Rank, suit: Suit): boolean {
  return cards.some((card) => card.rank === rank && card.suit === suit);
}
