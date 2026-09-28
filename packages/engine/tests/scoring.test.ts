import { describe, expect, it } from "vitest";
import { calculateScore, calculateScores, createDeck, createSeededRandom, getLoserId, getWinnerIds } from "../src";
import { cards, newGame, withPiles } from "./helpers";

const NO_POINTS = { cardsMajority: 0, spadesBonus: 0, twoOfSpades: 0, tenOfDiamonds: 0, aces: 0, total: 0 };

describe("most cards", () => {
  it("gives 2 points to the player with the most cards", () => {
    const most = cards("3H 4H 5H");
    const fewer = cards("6H 7H");
    expect(calculateScore(most, [most, fewer]).cardsMajority).toBe(2);
    expect(calculateScore(fewer, [most, fewer]).cardsMajority).toBe(0);
  });

  it("gives 1 point each when players tie for the most (20 cards each)", () => {
    const deck = createDeck();
    const first = deck.slice(0, 20);
    const second = deck.slice(20);
    expect(calculateScore(first, [first, second]).cardsMajority).toBe(1);
    expect(calculateScore(second, [first, second]).cardsMajority).toBe(1);
  });

  it("gives nothing to a player outside a tie for the most", () => {
    const a = cards("3H 4H");
    const b = cards("6H 7H");
    const c = cards("8H");
    expect(calculateScore(c, [a, b, c]).cardsMajority).toBe(0);
  });

  it("gives nobody the points when nobody captured anything", () => {
    expect(calculateScore([], [[], []]).cardsMajority).toBe(0);
  });
});

describe("five or more spades", () => {
  it.each([
    [4, 0],
    [5, 1],
    [7, 1],
  ])("%i spades scores %i", (spadeCount, points) => {
    const pile = cards("3S 4S 5S 6S 7S 8S 9S").slice(0, spadeCount);
    expect(calculateScore(pile, [pile]).spadesBonus).toBe(points);
  });
});

describe("special cards", () => {
  it("gives 1 point for the 2♠", () => {
    const pile = cards("2S 9H");
    expect(calculateScore(pile, [pile]).twoOfSpades).toBe(1);
  });

  it("gives 2 points for the 10♦", () => {
    const pile = cards("10D 9H");
    expect(calculateScore(pile, [pile]).tenOfDiamonds).toBe(2);
  });

  it("gives 1 point for each Ace, so 4 for all four", () => {
    const one = cards("AH 5C");
    const all = cards("AH AD AC AS");
    expect(calculateScore(one, [one]).aces).toBe(1);
    expect(calculateScore(all, [all]).aces).toBe(4);
  });

  it("counts the 2♠ separately from the five-spades bonus", () => {
    const pile = cards("2S 3S 4S 5S 6S");
    expect(calculateScore(pile, [pile])).toMatchObject({ spadesBonus: 1, twoOfSpades: 1 });
  });
});

describe("combined score", () => {
  it("adds every category together (most cards 2 + spades 1 + 2♠ 1 + 10♦ 2 + three Aces 3 = 9)", () => {
    const a = cards("2S 3S 4S 5S 6S 10D AH AD AC 7H 8H");
    const b = cards("AS 9H");
    expect(calculateScore(a, [a, b])).toEqual({
      cardsMajority: 2,
      spadesBonus: 1,
      twoOfSpades: 1,
      tenOfDiamonds: 2,
      aces: 3,
      total: 9,
    });
    expect(calculateScore(b, [a, b])).toEqual({ ...NO_POINTS, aces: 1, total: 1 });
  });

  it("scores every player from their capture pile", () => {
    const state = withPiles(newGame(2), { p1: "10D AH 3C", p2: "2S" });
    expect(calculateScores(state)).toEqual({
      p1: { ...NO_POINTS, cardsMajority: 2, tenOfDiamonds: 2, aces: 1, total: 5 },
      p2: { ...NO_POINTS, twoOfSpades: 1, total: 1 },
    });
  });
});

describe("winners and losers", () => {
  it("names the player with the most points as the winner", () => {
    const state = withPiles(newGame(2), { p1: "10D AH", p2: "3C" });
    expect(getWinnerIds(state)).toEqual(["p1"]);
    expect(getLoserId(state)).toBe("p2");
  });

  it("shares the win when players tie on points", () => {
    const state = withPiles(newGame(2), { p1: "AH", p2: "AD" });
    expect(getWinnerIds(state)).toEqual(["p1", "p2"]);
  });

  it("picks the loser at random when players tie for the fewest points", () => {
    const state = withPiles(newGame(3), { p1: "10D AH", p2: "AD", p3: "AC" });
    const losers = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      losers.add(getLoserId(state, createSeededRandom(seed)));
    }
    expect(losers).toEqual(new Set(["p2", "p3"]));
  });
});
