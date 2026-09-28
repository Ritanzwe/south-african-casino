// The scenarios from the bug reports of 2026-09-28, kept as tests so they stay fixed.

import { describe, expect, it } from "vitest";
import {
  captureCards,
  createBuild,
  getCapturableCardIds,
  getCreateBuildError,
  getLegalMoves,
  getTopCard,
  isStrongBuild,
  parseMove,
  raiseBuild,
  stealIntoBuild,
} from "../src";
import { cards, ids, makeBuild, scenario, withPiles } from "./helpers";

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
      "To use another player's top card, the floor cards must already make 10 on their own (like 6 + 4 for a 10).",
    );
  });

  it("Example 4 still needs a 10 kept in hand to capture the build later", () => {
    const state = withPiles(scenario({ p1: "10S 4C" }, "6D 4H"), { p2: "10H" });
    expect(getCreateBuildError(state, "p1", "10-spades", ["6-diamonds", "4-hearts"], 10, ["10-hearts"])).toBe(
      "You need to keep a 10 in your hand to capture this build later.",
    );
  });

  it("only lets a top card into a build of its own value", () => {
    const state = withPiles(scenario({ p1: "10S 10C" }, "6D 4C"), { p2: "9H" });
    expect(getCreateBuildError(state, "p1", "10-spades", ["6-diamonds", "4-clubs"], 10, ["9-hearts"])).toBe(
      "Another player's top card can only go into a build of its own value.",
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
      "To use another player's top card, the floor cards must already make 10 on their own (like 6 + 4 for a 10).",
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

  it("accepts floor cards in a raise sent over the network", () => {
    expect(parseMove({ action: "RAISE_BUILD", cardId: "A-hearts", buildId: "build-p2", tableCardIds: ["2-clubs"] })).toEqual({
      action: "RAISE_BUILD",
      cardId: "A-hearts",
      buildId: "build-p2",
      tableCardIds: ["2-clubs"],
    });
  });
});
