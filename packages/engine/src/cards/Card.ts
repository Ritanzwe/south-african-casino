export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";

export interface Card {
  /** Unique id, e.g. "7-spades". The deck has exactly one of each card. */
  id: string;
  suit: Suit;
  rank: Rank;
  /** The number used for capturing and building: A = 1, 2 = 2 … 10 = 10. */
  value: number;
}

export const SUITS: readonly Suit[] = ["hearts", "diamonds", "clubs", "spades"];

/** Casino is played without Jacks, Queens and Kings, so the ranks stop at 10. */
export const RANKS: readonly Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export const RANK_VALUES: Record<Rank, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export function createCard(rank: Rank, suit: Suit): Card {
  return { id: `${rank}-${suit}`, suit, rank, value: RANK_VALUES[rank] };
}

/**
 * Orders cards from lowest to highest: by value, then by suit (hearts, diamonds,
 * clubs, spades) when the values are equal. Use it to sort: cards.sort(compareCards).
 */
export function compareCards(a: Card, b: Card): number {
  return a.value - b.value || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
}

/** Short text for a card, e.g. "7♠" or "10♦". Used in the game log. */
export function formatCard(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}
