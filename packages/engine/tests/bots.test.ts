import { describe, expect, it } from "vitest";
import {
  applyMove,
  calculateScores,
  cardWorth,
  chooseBotMove,
  createGame,
  createSeededRandom,
  getMoveError,
  getPlayer,
  type BotLevel,
} from "../src";
import { cards, newGame, scenario } from "./helpers";

const LEVELS: BotLevel[] = ["easy", "medium", "hard"];

/** Plays a whole 2-player game between two bot levels and returns [p1 points, p2 points]. */
function playBots(p1: BotLevel, p2: BotLevel, seed: number): [number, number] {
  const random = createSeededRandom(seed * 31);
  let state = createGame({
    players: [
      { id: "p1", name: "One", bot: p1 },
      { id: "p2", name: "Two", bot: p2 },
    ],
    random: createSeededRandom(seed),
  });
  while (state.status === "playing") {
    const id = state.currentPlayerId;
    state = applyMove(state, id, chooseBotMove(state, id, getPlayer(state, id).bot!, random));
  }
  const scores = calculateScores(state);
  return [scores.p1.total, scores.p2.total];
}

/** How many of `games` games level `a` wins against level `b`, swapping seats every game. */
function winsFor(a: BotLevel, b: BotLevel, games: number): number {
  let wins = 0;
  for (let seed = 1; seed <= games; seed++) {
    const aSitsFirst = seed % 2 === 1;
    const [first, second] = aSitsFirst ? playBots(a, b, seed) : playBots(b, a, seed);
    const [aPoints, bPoints] = aSitsFirst ? [first, second] : [second, first];
    if (aPoints > bPoints) wins++;
  }
  return wins;
}

describe("bots", () => {
  it.each(LEVELS)("only ever choose legal moves and finish the game (%s)", (level) => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 5; seed++) {
        const random = createSeededRandom(seed);
        let state = newGame(playerCount, { seed });
        while (state.status === "playing") {
          const move = chooseBotMove(state, state.currentPlayerId, level, random);
          expect(getMoveError(state, state.currentPlayerId, move)).toBeNull();
          state = applyMove(state, state.currentPlayerId, move);
        }
        expect(state.players.every((player) => player.hand.length === 0)).toBe(true);
      }
    }
  });

  it("refuse to move when it isn't their turn", () => {
    const state = newGame(2, { previousLoserId: "p1" });
    expect(() => chooseBotMove(state, "p2", "easy")).toThrow("The bot has no legal move.");
  });
});

describe.each(["medium", "hard"] as BotLevel[])("a %s bot", (level) => {
  it("captures the 10♦ when it can", () => {
    const move = chooseBotMove(scenario({ p1: "10S 4C" }, "10D 3H"), "p1", level);
    expect(move).toMatchObject({ action: "CAPTURE", cardId: "10-spades", tableCardIds: ["10-diamonds"] });
  });

  it("takes every group it can in one capture (8 and 5 + 3 with an 8)", () => {
    const move = chooseBotMove(scenario({ p1: "8S 2C" }, "8H 5C 3D 9S"), "p1", level);
    expect(move.action).toBe("CAPTURE");
    expect(move.cardId).toBe("8-spades");
    expect(move.action === "CAPTURE" && [...move.tableCardIds].sort()).toEqual(["3-diamonds", "5-clubs", "8-hearts"]);
  });

  it("doesn't throw away a valuable card when it has to drift", () => {
    // Nothing can be captured or built, so every move is a drift.
    const move = chooseBotMove(scenario({ p1: "2H 10D 7C" }, "9S"), "p1", level);
    expect(move.action).toBe("DRIFT");
    expect(move.cardId).not.toBe("10-diamonds");
  });
});

describe("bot strength", () => {
  it("medium beats easy most of the time", () => {
    expect(winsFor("medium", "easy", 20)).toBeGreaterThanOrEqual(15);
  });

  it("hard beats medium more often than not", () => {
    expect(winsFor("hard", "medium", 20)).toBeGreaterThan(10);
  });
});

describe("cardWorth", () => {
  it("rates the scoring cards above ordinary ones", () => {
    const [ordinary, spade, ace, twoOfSpades, tenOfDiamonds] = cards("7H 7S AH 2S 10D").map(cardWorth);
    expect(spade).toBeGreaterThan(ordinary);
    expect(ace).toBeGreaterThan(spade);
    expect(twoOfSpades).toBeGreaterThan(ace);
    expect(tenOfDiamonds).toBeGreaterThan(twoOfSpades);
  });
});
