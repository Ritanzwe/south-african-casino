// The scenarios from the bug report of 2026-09-28, kept as tests so they stay fixed.

import { describe, expect, it } from "vitest";
import {
  captureCards,
  createBuild,
  getCreateBuildError,
  getLegalMoves,
  getTopCard,
  isStrongBuild,
  parseMove,
  raiseBuild,
} from "../src";
import { cards, ids, makeBuild, scenario } from "./helpers";

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
