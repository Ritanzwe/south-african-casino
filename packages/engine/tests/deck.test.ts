import { describe, expect, it } from "vitest";
import {
  RANKS,
  SOUTH_AFRICAN_CASINO_RULES as RULES,
  SUITS,
  createDeck,
  createSeededRandom,
  formatCard,
  shuffleDeck,
  type Card,
} from "../src";
import { card } from "./helpers";

const ids = (cards: Card[]) => cards.map((c) => c.id);

describe("createDeck", () => {
  it("has exactly 40 cards", () => {
    expect(createDeck()).toHaveLength(40);
    expect(createDeck()).toHaveLength(RULES.deckSize);
  });

  it("has no Jacks, Queens or Kings", () => {
    const ranks: string[] = createDeck().map((c) => c.rank);
    expect(ranks).not.toContain("J");
    expect(ranks).not.toContain("Q");
    expect(ranks).not.toContain("K");
  });

  it("has four suits with 10 cards each", () => {
    const deck = createDeck();
    expect(new Set(deck.map((c) => c.suit))).toEqual(new Set(["hearts", "diamonds", "clubs", "spades"]));
    for (const suit of SUITS) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(10);
    }
  });

  it("has the ten ranks A to 10 once in every suit", () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      const ranksInSuit = deck.filter((c) => c.suit === suit).map((c) => c.rank);
      expect(ranksInSuit).toHaveLength(10);
      expect(new Set(ranksInSuit)).toEqual(new Set(RANKS));
    }
  });

  it("values an Ace as 1 and every other card as its number", () => {
    for (const c of createDeck()) {
      expect(c.value).toBe(c.rank === "A" ? 1 : Number(c.rank));
    }
  });

  it("gives every card a unique id", () => {
    expect(new Set(ids(createDeck())).size).toBe(40);
  });
});

describe("shuffleDeck", () => {
  it("keeps the same 40 cards", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, createSeededRandom(42));
    expect(shuffled).toHaveLength(40);
    expect(new Set(ids(shuffled))).toEqual(new Set(ids(deck)));
  });

  it("does not change the deck passed in", () => {
    const deck = createDeck();
    const orderBefore = ids(deck);
    shuffleDeck(deck, createSeededRandom(42));
    expect(ids(deck)).toEqual(orderBefore);
  });

  it("changes the order of the cards", () => {
    const deck = createDeck();
    expect(ids(shuffleDeck(deck, createSeededRandom(42)))).not.toEqual(ids(deck));
  });

  it("gives the same order for the same seed", () => {
    const first = shuffleDeck(createDeck(), createSeededRandom(7));
    const second = shuffleDeck(createDeck(), createSeededRandom(7));
    expect(ids(first)).toEqual(ids(second));
  });

  it("gives a different order for a different seed", () => {
    const first = shuffleDeck(createDeck(), createSeededRandom(7));
    const second = shuffleDeck(createDeck(), createSeededRandom(8));
    expect(ids(first)).not.toEqual(ids(second));
  });

  it("uses Math.random when no random function is given", () => {
    expect(shuffleDeck(createDeck())).toHaveLength(40);
  });
});

describe("createSeededRandom", () => {
  it("returns numbers from 0 up to (but not including) 1", () => {
    const random = createSeededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const n = random();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe("formatCard", () => {
  it("shows the rank and the suit symbol", () => {
    expect(formatCard(card("7", "spades"))).toBe("7♠");
    expect(formatCard(card("10", "diamonds"))).toBe("10♦");
    expect(formatCard(card("A", "hearts"))).toBe("A♥");
    expect(formatCard(card("2", "clubs"))).toBe("2♣");
  });
});
