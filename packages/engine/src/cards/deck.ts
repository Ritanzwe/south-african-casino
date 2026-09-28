import { randomInt, type RandomFn } from "../utils/random";
import { RANKS, SUITS, createCard, type Card } from "./Card";

/**
 * Creates the 40-card South African Casino deck: A to 10 in each of the four suits.
 * The cards come out in a fixed order (suit by suit). Use shuffleDeck to mix them.
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(rank, suit));
    }
  }
  return deck;
}

/**
 * Returns a shuffled copy of the deck using the Fisher–Yates shuffle.
 * The deck passed in is not changed.
 *
 * Pass a seeded random function (see createSeededRandom) to get the same order
 * every time.
 */
export function shuffleDeck(deck: readonly Card[], random: RandomFn = Math.random): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, random);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
