// The scenarios from the bug reports of 2026-09-28, kept as tests so they stay fixed.

import { describe, expect, it } from "vitest";
import {
  captureCards,
  createBuild,
  getCapturableCardIds,
  getCreateBuildError,
  getLegalMoves,
  getRaiseBuildError,
  getTopCard,
  isStrongBuild,
  parseMove,
  raiseBuild,
  stealIntoBuild,
} from "../src";
import { cards, driftTurns, ids, makeBuild, scenario, withPiles } from "./helpers";

// In these tests p1 is "Player B" (whose turn it is) and p2 is "Player A".

describe("Bug 1 / Test 1: taking an opponent's build", () => {
  it("lets Player B raise Player A's weak 9 to 10 with an A from their hand", () => {
    const state = { ...scenario({ p1: "AH 10S 3C" }, ""), builds: [makeBuild("p2", ["4D 5D"])] };
    const next = raiseBuild(state, "p1", "A-hearts", "build-p2");
    expect(next.builds).toEqual([{ id: "build-p2", value: 10, ownerId: "p1", sets: [cards("4D 5D AH")] }]);
  });

  it("joins it to Player B's own build of 10, making one strong build", () => {
    const state = {
      ...scenario({ p1: "AH 10S 3C" }, ""),
      builds: [makeBuild("p2", ["4D 5D"]), makeBuild("p1", ["6C 4C"])],
    };
    const next = raiseBuild(state, "p1", "A-hearts", "build-p2");

    expect(next.builds).toEqual([{ id: "build-p1", value: 10, ownerId: "p1", sets: [cards("6C 4C"), cards("4D 5D AH")] }]);
    expect(isStrongBuild(next.builds[0])).toBe(true);
    expect(next.log.at(-1)?.message).toBe(
      "Player 1 raised Player 2's build from 9 to 10 with A♥ and joined it to their own build of 10.",
    );
  });

  it("still won't give a player two builds of different values", () => {
    const state = {
      ...scenario({ p1: "AH 10S 7C" }, ""),
      builds: [makeBuild("p2", ["4D 5D"]), makeBuild("p1", ["4C 3C"])],
    };
    expect(() => raiseBuild(state, "p1", "A-hearts", "build-p2")).toThrow(
      "You already own a build of 7. Another build must also be worth 7, and then the two join into one.",
    );
  });

  it("still won't raise a strong build", () => {
    const state = { ...scenario({ p1: "AH 10S" }, ""), builds: [makeBuild("p2", ["4D 5D", "8D AD"])] };
    expect(() => raiseBuild(state, "p1", "A-hearts", "build-p2")).toThrow("That build is strong");
  });
});

describe("Bug 2 / Test 2: building from floor cards", () => {
  it("builds 9 from a hand 3 and floor 5 + A, keeping the cards in the order they lay", () => {
    const next = createBuild(scenario({ p1: "3H 9S 4C" }, "5C 2D AS"), "p1", "3-hearts", ["5-clubs", "A-spades"], 9);
    expect(next.builds[0].sets).toEqual([cards("5C AS 3H")]);
    expect(ids(next.tableCards)).toEqual(["2-diamonds"]);
  });

  it("explains that a 9 has to be kept when the player doesn't hold one", () => {
    const state = scenario({ p1: "3H 4C 6C" }, "5C 2D AS");
    expect(getCreateBuildError(state, "p1", "3-hearts", ["5-clubs", "A-spades"], 9)).toBe(
      "You need to keep a 9 in your hand to capture this build later.",
    );
  });

  it("joins a new build to the player's own build of the same value", () => {
    const state = { ...scenario({ p1: "4H 9S 9C" }, "5C"), builds: [makeBuild("p1", ["6D 3D"])] };
    const next = createBuild(state, "p1", "4-hearts", ["5-clubs"], 9);
    expect(next.builds).toEqual([{ id: "build-p1", value: 9, ownerId: "p1", sets: [cards("6D 3D"), cards("5C 4H")] }]);
    expect(next.log.at(-1)?.message).toBe("Player 1 added 5♣ + 4♥ to their build of 9.");
  });
});

describe("Bug 3 / Test 3: capturing a build that was built up", () => {
  // The build was made as 4 + 5 = 9, then 8 + A was added on top.
  const state = { ...scenario({ p1: "9S 3C" }, ""), builds: [makeBuild("p1", ["4D 5D", "8D AD"])] };

  it("keeps the build's order in the capture pile, with the capturing 9 on top", () => {
    const next = captureCards(state, "p1", "9-spades", [], ["build-p1"]);
    expect(ids(next.capturePiles.p1)).toEqual(["4-diamonds", "5-diamonds", "8-diamonds", "A-diamonds", "9-spades"]);
    expect(getTopCard(next.capturePiles.p1)?.id).toBe("9-spades");
  });

  it("doesn't leave the capturing 9 on the table", () => {
    const next = captureCards(state, "p1", "9-spades", [], ["build-p1"]);
    expect(next.tableCards).toEqual([]);
    expect(next.builds).toEqual([]);
  });
});

describe("Test 4: several floor cards and builds", () => {
  it("captures a build and several groups of floor cards in one move", () => {
    const state = { ...scenario({ p1: "8S 2C" }, "6D 2H 5C 3S 9D"), builds: [makeBuild("p2", ["7H AH"])] };
    const next = captureCards(state, "p1", "8-spades", ["6-diamonds", "2-hearts", "5-clubs", "3-spades"], ["build-p2"]);
    expect(ids(next.tableCards)).toEqual(["9-diamonds"]);
    expect(next.builds).toEqual([]);
    expect(next.capturePiles.p1).toHaveLength(7);
  });
});

// "Capturing an opponent's card requires a floor build": another player's top card N can only be
// used together with floor cards that already make N (or a build of N).
describe("Top cards need a matching floor build", () => {
  it("Example 1: a 5 can't eat another player's top 5 when nothing on the floor makes 5", () => {
    const state = withPiles(scenario({ p1: "5S 9C" }, "8D"), { p2: "5H" });
    expect(() => captureCards(state, "p1", "5-spades", [], [], ["5-hearts"])).toThrow(
      "You can't take another player's top card on its own.",
    );
    expect(getLegalMoves(state, "p1").some((move) => move.action === "CAPTURE")).toBe(false);
    expect(getCapturableCardIds(state, 5, "p1")).toEqual(new Set());
  });

  it("Example 2: floor 5 + their top 5 + your 5 is a legal capture", () => {
    const state = withPiles(scenario({ p1: "5S 9C" }, "5D"), { p2: "5H" });
    const next = captureCards(state, "p1", "5-spades", ["5-diamonds"], [], ["5-hearts"]);
    expect(ids(next.capturePiles.p1)).toEqual(["5-diamonds", "5-hearts", "5-spades"]);
    expect(next.capturePiles.p2).toEqual([]);
  });

  it("Example 3: floor 6 + 4 makes 10, so your 10 can take it and their top 10", () => {
    const state = withPiles(scenario({ p1: "10S 9C" }, "6D 4C"), { p2: "10H" });
    const next = captureCards(state, "p1", "10-spades", ["6-diamonds", "4-clubs"], [], ["10-hearts"]);
    expect(ids(next.capturePiles.p1)).toEqual(["6-diamonds", "4-clubs", "10-hearts", "10-spades"]);
    expect(next.log.at(-1)?.message).toBe("Player 1 captured 6♦ + 4♣ and 10♥ from Player 2's pile with 10♠.");
  });

  it("Example 4: floor 6 + 4, their top 10 and your 10 make a stronger build of 10 to capture later", () => {
    const state = withPiles(scenario({ p1: "10S 10C" }, "6D 4C"), { p2: "3S 10H" });
    const next = createBuild(state, "p1", "10-spades", ["6-diamonds", "4-clubs"], 10, ["10-hearts"]);

    expect(next.builds).toEqual([
      { id: "build-10-spades", value: 10, ownerId: "p1", sets: [cards("6D 4C"), cards("10S"), cards("10H")] },
    ]);
    expect(isStrongBuild(next.builds[0])).toBe(true);
    expect(ids(next.capturePiles.p2)).toEqual(["3-spades"]);
    expect(next.log.at(-1)?.message).toBe(
      "Player 1 made a build of 10 (6♦ + 4♣ and 10♠ and 10♥ from Player 2's pile).",
    );
  });

  it("Example 4 needs the floor cards to make the value on their own", () => {
    // Floor 7 only makes 10 with the hand's 3, so their top 10 can't come in.
    const state = withPiles(scenario({ p1: "3S 10C" }, "7D"), { p2: "10H" });
    expect(getCreateBuildError(state, "p1", "3-spades", ["7-diamonds"], 10, ["10-hearts"])).toBe(
      "To use another player's top card, the floor cards must already make 10 on their own (like a 9 on the floor for a build of 9).",
    );
  });

  it("Example 4 still needs a 10 kept in hand to capture the build later", () => {
    const state = withPiles(scenario({ p1: "10S 4C" }, "6D 4H"), { p2: "10H" });
    expect(getCreateBuildError(state, "p1", "10-spades", ["6-diamonds", "4-hearts"], 10, ["10-hearts"])).toBe(
      "You need to keep a 10 in your hand to capture this build later.",
    );
  });

  it("needs every set, the top card's included, to add up to the build's value", () => {
    const state = withPiles(scenario({ p1: "10S 10C" }, "6D 4C"), { p2: "9H" });
    expect(getCreateBuildError(state, "p1", "10-spades", ["6-diamonds", "4-clubs"], 10, ["9-hearts"])).toBe(
      "Those cards don't make a build of 10. Every set in a build must add up to 10.",
    );
  });

  it("screenshot: floor 9, your 4 + their top 5 make a strong build of 9 (you keep your 9 to capture it)", () => {
    const state = withPiles(scenario({ p1: "AH 3H 4C 9D 10H" }, "9C 10C 7C"), { p2: "2C 5C" });
    const next = createBuild(state, "p1", "4-clubs", ["9-clubs"], 9, ["5-clubs"]);

    expect(next.builds).toEqual([
      { id: "build-4-clubs", value: 9, ownerId: "p1", sets: [cards("9C"), cards("4C 5C")] },
    ]);
    expect(ids(next.tableCards)).toEqual(["10-clubs", "7-clubs"]);
    expect(ids(next.capturePiles.p2)).toEqual(["2-clubs"]);
    expect(next.log.at(-1)?.message).toBe("Player 1 made a build of 9 (9♣ and 4♣ + 5♣ from Player 2's pile).");
    expect(getLegalMoves(state, "p1")).toContainEqual({
      action: "BUILD",
      cardId: "4-clubs",
      tableCardIds: ["9-clubs"],
      value: 9,
      pileCardIds: ["5-clubs"],
    });
  });

  it("still won't use a top card in a sum when the floor doesn't already make the value", () => {
    // Floor 6 and their top A don't let a 7 build (or capture) 7: nothing on the floor makes 7.
    const state = withPiles(scenario({ p1: "7S 6H 7C" }, "6D"), { p2: "AH" });
    expect(getCreateBuildError(state, "p1", "6-hearts", ["6-diamonds"], 7, ["A-hearts"])).toBe(
      "To use another player's top card, the floor cards must already make 7 on their own (like a 9 on the floor for a build of 9).",
    );
  });

  it("offers the Example 4 build among the legal moves", () => {
    const state = withPiles(scenario({ p1: "10S 10C" }, "6D 4C"), { p2: "10H" });
    expect(getLegalMoves(state, "p1")).toContainEqual({
      action: "BUILD",
      cardId: "10-spades",
      tableCardIds: ["6-diamonds", "4-clubs"],
      value: 10,
      pileCardIds: ["10-hearts"],
    });
  });
});

// "Build continuation": a player with an active build keeps strengthening it over several turns,
// using any loose floor cards (whoever played them) and other players' top cards.
describe("Continuing your own build", () => {
  it("grows a strong build of 10 with a 5 another player drifted and your 5", () => {
    const state = { ...scenario({ p1: "5H 10S" }, "5C"), builds: [makeBuild("p1", ["6D 4D", "10D"])] };
    const next = createBuild(state, "p1", "5-hearts", ["5-clubs"], 10);
    expect(next.builds).toEqual([
      { id: "build-p1", value: 10, ownerId: "p1", sets: [cards("6D 4D"), cards("10D"), cards("5C 5H")] },
    ]);
    expect(next.capturePiles.p1).toEqual([]);
  });

  it("uses their top 10 because your build of 10 is already on the floor", () => {
    // Floor 5 alone doesn't make 10, but your own build of 10 is the floor build that allows it.
    const state = withPiles({ ...scenario({ p1: "5H 10S" }, "5C"), builds: [makeBuild("p1", ["6D 4D"])] }, { p2: "10C" });
    const next = createBuild(state, "p1", "5-hearts", ["5-clubs"], 10, ["10-clubs"]);
    expect(next.builds[0].sets).toEqual([cards("6D 4D"), cards("5C 5H"), cards("10C")]);
    expect(next.capturePiles.p2).toEqual([]);
  });

  it("can also steal their top 10 into your build with your second 10", () => {
    const state = withPiles({ ...scenario({ p1: "10H 10S" }, ""), builds: [makeBuild("p1", ["6D 4D"])] }, { p2: "10C" });
    const next = stealIntoBuild(state, "p1", "10-hearts", "build-p1", "10-clubs", []);
    expect(next.builds[0].sets).toEqual([cards("6D 4D"), cards("10H"), cards("10C")]);
  });

  it("still needs a build or floor cards making the value when you own no build", () => {
    const state = withPiles(scenario({ p1: "10H 10S" }, "5C"), { p2: "10C" });
    expect(getCreateBuildError(state, "p1", "10-hearts", ["5-clubs"], 10, ["10-clubs"])).toBe(
      "To use another player's top card, the floor cards must already make 10 on their own (like a 9 on the floor for a build of 9).",
    );
  });
});

describe("Test 5: an opponent's build plus floor cards", () => {
  // Player A owns a weak 6 (2 + 4). Player B holds an A and a 9; a 2 and a 7 lie on the floor.
  const state = { ...scenario({ p1: "AH 9S" }, "2C 7D"), builds: [makeBuild("p2", ["2S 4S"])] };

  it("raises the build with a hand card and floor cards together", () => {
    const next = raiseBuild(state, "p1", "A-hearts", "build-p2", ["2-clubs"]);
    expect(next.builds).toEqual([{ id: "build-p2", value: 9, ownerId: "p1", sets: [cards("2S 4S 2C AH")] }]);
    expect(ids(next.tableCards)).toEqual(["7-diamonds"]);
    expect(next.log.at(-1)?.message).toBe("Player 1 raised Player 2's build from 6 to 9 with 2♣ + A♥ and took it over.");
  });

  it("won't raise a build past 10", () => {
    expect(() => raiseBuild(state, "p1", "A-hearts", "build-p2", ["7-diamonds"])).toThrow(
      "A build can't be worth more than 10.",
    );
  });

  it("lists raises that use floor cards among the legal moves", () => {
    expect(getLegalMoves(state, "p1")).toContainEqual({
      action: "RAISE_BUILD",
      cardId: "A-hearts",
      buildId: "build-p2",
      tableCardIds: ["2-clubs"],
    });
  });

  it("says what the build would be worth when it's over 10", () => {
    expect(getRaiseBuildError(state, "p1", "A-hearts", "build-p2", ["7-diamonds"])).toBe(
      "That would make 14. A build can't be worth more than 10.",
    );
  });

  it("accepts floor cards in a raise sent over the network", () => {
    expect(parseMove({ action: "RAISE_BUILD", cardId: "A-hearts", buildId: "build-p2", tableCardIds: ["2-clubs"] })).toEqual({
      action: "RAISE_BUILD",
      cardId: "A-hearts",
      buildId: "build-p2",
      tableCardIds: ["2-clubs"],
    });
  });
});

// The two screenshots sent later that day.
describe("Screenshot 1: a top card in a sum, captured with your build", () => {
  // Your strong build of 9 (9♦, 9♥), floor 5♠ and 6♠, Player 2's top 3♠, and your last 9♣.
  const state = withPiles({ ...scenario({ p1: "9C" }, "5S 6S"), builds: [makeBuild("p1", ["9D", "9H"])] }, { p2: "7C 3S" });

  it("takes your build of 9, and the floor 6 with their top 3 (6 + 3 = 9), with your 9", () => {
    const next = captureCards(state, "p1", "9-clubs", ["6-spades"], ["build-p1"], ["3-spades"]);
    expect(ids(next.capturePiles.p1)).toEqual(["9-diamonds", "9-hearts", "6-spades", "3-spades", "9-clubs"]);
    expect(ids(next.capturePiles.p2)).toEqual(["7-clubs"]);
    expect(ids(next.tableCards)).toEqual(["5-spades"]);
    expect(next.builds).toEqual([]);
  });

  it("lists that capture among the legal moves and lights up the 6 and the 3", () => {
    expect(getLegalMoves(state, "p1")).toContainEqual({
      action: "CAPTURE",
      cardId: "9-clubs",
      tableCardIds: ["6-spades"],
      buildIds: ["build-p1"],
      pileCardIds: ["3-spades"],
    });
    expect(getCapturableCardIds(state, 9, "p1")).toEqual(new Set(["6-spades", "3-spades"]));
  });

  it("still won't take the 6 and their 3 without a build or floor cards making 9", () => {
    const noBuild = withPiles(scenario({ p1: "9C 2H" }, "5S 6S"), { p2: "7C 3S" });
    expect(() => captureCards(noBuild, "p1", "9-clubs", ["6-spades"], [], ["3-spades"])).toThrow(
      "You can't take another player's top card on its own.",
    );
    expect(getCapturableCardIds(noBuild, 9, "p1")).toEqual(new Set());
  });

  it("won't light up a sum that needs the only floor cards making 9", () => {
    // Floor 6 + 3 makes 9, but 6 + their 3 would leave nothing on the floor making 9.
    const shared = withPiles(scenario({ p1: "9C 2H" }, "6S 3H"), { p2: "7C 3S" });
    expect(getCapturableCardIds(shared, 9, "p1")).toEqual(new Set(["6-spades", "3-hearts"]));
    expect(() => captureCards(shared, "p1", "9-clubs", ["6-spades"], [], ["3-spades"])).toThrow(
      "You can't take another player's top card on its own.",
    );
  });
});

describe("Screenshot 2: their build of 4 and a floor 4 made into one build", () => {
  // Player 2's weak build of 4 (3♦ + A♥) and a 4♦ on the floor.
  const state = {
    ...scenario({ p1: "AS 2D 4H 8H 9H 9D 9C 10D 10S" }, "4D"),
    builds: [makeBuild("p2", ["3D AH"])],
  };

  it("raises it to 9 with your A (you hold 9s)", () => {
    const next = raiseBuild(state, "p1", "A-spades", "build-p2", ["4-diamonds"]);
    expect(next.builds).toEqual([{ id: "build-p2", value: 9, ownerId: "p1", sets: [cards("3D AH 4D AS")] }]);
    expect(next.tableCards).toEqual([]);
  });

  it("raises it to 10 with your 2 (you hold 10s)", () => {
    const next = raiseBuild(state, "p1", "2-diamonds", "build-p2", ["4-diamonds"]);
    expect(next.builds).toEqual([{ id: "build-p2", value: 10, ownerId: "p1", sets: [cards("3D AH 4D 2D")] }]);
  });

  it("captures both with your 4 instead", () => {
    const next = captureCards(state, "p1", "4-hearts", ["4-diamonds"], ["build-p2"]);
    expect(ids(next.capturePiles.p1)).toEqual(["3-diamonds", "A-hearts", "4-diamonds", "4-hearts"]);
  });

  it("explains why the 8 can't be used: 4 + 4 + 8 is over 10", () => {
    expect(getRaiseBuildError(state, "p1", "8-hearts", "build-p2", ["4-diamonds"])).toBe(
      "That would make 16. A build can't be worth more than 10.",
    );
  });
});

describe("Cards of the same value under a top card", () => {
  // Player 2's pile ends 8♠, 8♥ (8♥ on top). An 8♦ lies on the floor and you hold 8♣.
  const state = withPiles(scenario({ p1: "8C 3H" }, "8D 5C"), { p2: "2D 8S 8H" });

  it("your 8 eats the floor 8, their top 8 and the 8 under it at the same time", () => {
    const next = captureCards(state, "p1", "8-clubs", ["8-diamonds"], [], ["8-hearts", "8-spades"]);
    expect(ids(next.capturePiles.p1)).toEqual(["8-diamonds", "8-spades", "8-hearts", "8-clubs"]);
    expect(ids(next.capturePiles.p2)).toEqual(["2-diamonds"]);
    expect(ids(next.tableCards)).toEqual(["5-clubs"]);
  });

  it("lists that capture among the legal moves", () => {
    expect(getLegalMoves(state, "p1")).toContainEqual({
      action: "CAPTURE",
      cardId: "8-clubs",
      tableCardIds: ["8-diamonds"],
      pileCardIds: ["8-hearts", "8-spades"],
    });
    expect(getCapturableCardIds(state, 8, "p1")).toEqual(new Set(["8-diamonds", "8-hearts", "8-spades"]));
  });

  it("works for every value (3s, with a floor 2 + A making 3)", () => {
    const threes = withPiles(scenario({ p1: "3C 9H" }, "2D AS"), { p2: "7C 3S 3H" });
    const next = captureCards(threes, "p1", "3-clubs", ["2-diamonds", "A-spades"], [], ["3-hearts", "3-spades"]);
    expect(ids(next.capturePiles.p2)).toEqual(["7-clubs"]);
  });

  it("never takes the card under the top card without the top card", () => {
    expect(() => captureCards(state, "p1", "8-clubs", ["8-diamonds"], [], ["8-spades"])).toThrow(
      "Only the top card of a capture pile can be captured, together with any cards of the same value right under it.",
    );
  });

  it("only takes cards lying directly under the top card", () => {
    // 8♥ on top, then 2♦, then 8♠: the 2 is in the way.
    const blocked = withPiles(scenario({ p1: "8C 3H" }, "8D"), { p2: "8S 2D 8H" });
    expect(() => captureCards(blocked, "p1", "8-clubs", ["8-diamonds"], [], ["8-hearts", "8-spades"])).toThrow(
      "Only the top card of a capture pile can be captured, together with any cards of the same value right under it.",
    );
  });

  it("only when the top card is the same value as your card (a 9 taking their top 8 in a sum leaves the 8 under it)", () => {
    const sum = withPiles(scenario({ p1: "9C 3H" }, "9D AC"), { p2: "8S 8H" });
    expect(() => captureCards(sum, "p1", "9-clubs", ["9-diamonds", "A-clubs"], [], ["8-hearts", "8-spades"])).toThrow(
      "Only the top card of a capture pile can be captured, together with any cards of the same value right under it.",
    );
    const next = captureCards(sum, "p1", "9-clubs", ["9-diamonds", "A-clubs"], [], ["8-hearts"]);
    expect(ids(next.capturePiles.p2)).toEqual(["8-spades"]);
  });

  it("still needs an 8 (or cards making 8, or a build of 8) on the floor", () => {
    const noFloor = withPiles(scenario({ p1: "8C 3H" }, "5C"), { p2: "8S 8H" });
    expect(() => captureCards(noFloor, "p1", "8-clubs", [], [], ["8-hearts", "8-spades"])).toThrow(
      "You can't take another player's top card on its own.",
    );
  });

  it("building still only uses the top card", () => {
    const build = withPiles(scenario({ p1: "5S 5C" }, "3D 2D"), { p2: "5H 5D" });
    expect(getCreateBuildError(build, "p1", "5-spades", ["3-diamonds", "2-diamonds"], 5, ["5-diamonds", "5-hearts"])).toBe(
      "Only the top card of a capture pile can be captured.",
    );
  });
});

describe("Screenshot 3: topping up Aces", () => {
  // Floor 8♥ and A♠. You hold A♥, A♣ and more.
  const state = scenario({ p1: "AH AC 3D 3C 5C 6D 7H 7S 9D 10S" }, "8H AS");

  it("puts your A♣ on the floor A♠ as your strong build of Aces, keeping A♥ to capture it", () => {
    const next = createBuild(state, "p1", "A-clubs", ["A-spades"], 1);
    expect(next.builds).toEqual([{ id: "build-A-clubs", value: 1, ownerId: "p1", sets: [cards("AS"), cards("AC")] }]);
    expect(isStrongBuild(next.builds[0])).toBe(true);
    expect(ids(next.tableCards)).toEqual(["8-hearts"]);
  });

  it("lists it among the legal moves", () => {
    expect(getLegalMoves(state, "p1")).toContainEqual({ action: "BUILD", cardId: "A-clubs", tableCardIds: ["A-spades"], value: 1 });
  });

  it("is captured later with your other Ace", () => {
    const built = driftTurns(createBuild(state, "p1", "A-clubs", ["A-spades"], 1), 1);
    const next = captureCards(built, "p1", "A-hearts", [], ["build-A-clubs"]);
    expect(ids(next.capturePiles.p1)).toEqual(["A-spades", "A-clubs", "A-hearts"]);
  });

  it("needs another Ace in your hand", () => {
    const lastAce = scenario({ p1: "AC 10S" }, "8H AS");
    expect(getCreateBuildError(lastAce, "p1", "A-clubs", ["A-spades"], 1)).toBe(
      "You need to keep an Ace in your hand to capture this build later.",
    );
  });

  it("only pairs Aces: a build of 1 can't hold anything else", () => {
    expect(getCreateBuildError(state, "p1", "A-clubs", ["8-hearts"], 1)).toBe(
      "Those cards don't make a build of 1. Every set in a build must add up to 1.",
    );
  });
});
