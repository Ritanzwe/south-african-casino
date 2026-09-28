import { describe, expect, it } from "vitest";
import {
  IllegalMoveError,
  addToBuild,
  applyMove,
  captureCards,
  createBuild,
  getLegalMoves,
  getMoveError,
  getPlayer,
  getPossibleBuildValues,
  isStrongBuild,
  raiseBuild,
  type Move,
} from "../src";
import { cards, ids, makeBuild, scenario, withHand } from "./helpers";

describe("creating a build", () => {
  it("combines a hand card with a loose card (hand 3 + table 5 = 8, holding an 8)", () => {
    const state = scenario({ p1: "3H 8S" }, "5C 9D");
    const next = createBuild(state, "p1", "3-hearts", ["5-clubs"], 8);

    expect(next.builds).toEqual([{ id: "build-3-hearts", sets: [cards("5C 3H")], value: 8, ownerId: "p1" }]);
    expect(ids(next.tableCards)).toEqual(["9-diamonds"]);
    expect(ids(getPlayer(next, "p1").hand)).toEqual(["8-spades"]);
    expect(next.currentPlayerId).toBe("p2");
    expect(next.log.at(-1)?.message).toBe("Player 1 made a build of 8 (5♣ + 3♥).");
  });

  it("starts out weak, with a single set", () => {
    const next = createBuild(scenario({ p1: "3H 8S" }, "5C"), "p1", "3-hearts", ["5-clubs"], 8);
    expect(isStrongBuild(next.builds[0])).toBe(false);
  });

  it("can pair equal cards: a hand 2 on a loose 2 is a strong build of 2", () => {
    const next = createBuild(scenario({ p1: "2H 2S" }, "2C"), "p1", "2-hearts", ["2-clubs"], 2);
    expect(next.builds[0].sets).toEqual([cards("2C"), cards("2H")]);
    expect(isStrongBuild(next.builds[0])).toBe(true);
  });

  it("can make the same cards a build of 4 instead, for a player holding a 4", () => {
    const next = createBuild(scenario({ p1: "2H 4S" }, "2C"), "p1", "2-hearts", ["2-clubs"], 4);
    expect(next.builds[0].sets).toEqual([cards("2C 2H")]);
  });

  it("lists every value the chosen cards could be built into", () => {
    const state = scenario({ p1: "2H 2S 4D" }, "2C");
    expect(getPossibleBuildValues(state, "p1", "2-hearts", ["2-clubs"])).toEqual([2, 4]);
  });

  it("is strong from the start when it has two sets (3 + 5, and 8)", () => {
    const next = createBuild(scenario({ p1: "3H 8S" }, "5C 8D"), "p1", "3-hearts", ["5-clubs", "8-diamonds"], 8);
    expect(next.builds[0].sets).toEqual([cards("5C 3H"), cards("8D")]);
    expect(isStrongBuild(next.builds[0])).toBe(true);
  });

  it.each([
    {
      reason: "the player doesn't hold a card of the build's value",
      hand: "3H 9S",
      cardId: "3-hearts",
      tableCardIds: ["5-clubs"],
      value: 8,
      message: "You need to keep an 8 in your hand to capture this build later.",
    },
    {
      reason: "their only card of that value is the one being played",
      hand: "5H 9S",
      cardId: "5-hearts",
      tableCardIds: ["5-clubs"],
      value: 5,
      message: "You need to keep a 5 in your hand to capture this build later.",
    },
    {
      reason: "the cards don't add up to the value",
      hand: "3H 9S",
      cardId: "3-hearts",
      tableCardIds: ["5-clubs"],
      value: 9,
      message: "Those cards don't make a build of 9. Every set in a build must add up to 9.",
    },
    {
      reason: "no table cards are chosen",
      hand: "3H 8S",
      cardId: "3-hearts",
      tableCardIds: [],
      value: 8,
      message: "Choose the table cards you want to build with.",
    },
    {
      reason: "the value is over 10",
      hand: "6H 8S",
      cardId: "6-hearts",
      tableCardIds: ["5-clubs"],
      value: 11,
      message: "A build must be worth between 2 and 10.",
    },
  ])("is not allowed when $reason", ({ hand, cardId, tableCardIds, value, message }) => {
    const state = scenario({ p1: hand }, "5C");
    expect(() => createBuild(state, "p1", cardId, tableCardIds, value)).toThrow(IllegalMoveError);
    expect(() => createBuild(state, "p1", cardId, tableCardIds, value)).toThrow(message);
  });

  it("is not allowed when the player already owns a build of another value", () => {
    const state = { ...scenario({ p1: "3H 8S 9C" }, "5C"), builds: [makeBuild("p1", ["6D 3S"])] };
    expect(() => createBuild(state, "p1", "3-hearts", ["5-clubs"], 8)).toThrow(
      "You already own a build of 9. Another build must also be worth 9, and then the two join into one.",
    );
  });
});

describe("adding to your own build", () => {
  // p1 owns a weak build of 8 (5 + 3) and holds two 8s.
  const state = { ...scenario({ p1: "6H 2S 8D 8C" }, "2C 9H"), builds: [makeBuild("p1", ["5S 3S"])] };

  it("adds a new set of a hand card and a loose card (6 + 2), making the build strong", () => {
    const next = addToBuild(state, "p1", "6-hearts", "build-p1", ["2-clubs"]);
    expect(next.builds[0].sets).toEqual([cards("5S 3S"), cards("2C 6H")]);
    expect(next.builds[0].ownerId).toBe("p1");
    expect(isStrongBuild(next.builds[0])).toBe(true);
    expect(next.log.at(-1)?.message).toBe("Player 1 added 2♣ + 6♥ to their build of 8.");
  });

  it("adds a matching card on its own while the owner keeps another", () => {
    const next = addToBuild(state, "p1", "8-diamonds", "build-p1", []);
    expect(next.builds[0].sets).toEqual([cards("5S 3S"), cards("8D")]);
  });

  it("won't add the owner's last card of the build's value", () => {
    const oneEight = withHand(state, "p1", "6H 8D");
    expect(() => addToBuild(oneEight, "p1", "8-diamonds", "build-p1", [])).toThrow(
      "You need to keep an 8 in your hand to capture this build.",
    );
  });

  it("won't add a set that doesn't add up to the build's value", () => {
    expect(() => addToBuild(state, "p1", "6-hearts", "build-p1", ["9-hearts"])).toThrow(
      "Every set you add to this build must add up to 8.",
    );
  });

  it("can't raise the build's value", () => {
    expect(() => raiseBuild(state, "p1", "2-spades", "build-p1")).toThrow(
      "You can't raise your own build. You can add a set of the same value instead.",
    );
  });
});

describe("an opponent's weak build", () => {
  // p2 owns a weak build of 7 (2 + 5).
  const state = {
    ...scenario({ p1: "AH 8S 4H 7C 2D", p2: "9D 9C" }, "3C"),
    builds: [makeBuild("p2", ["2S 5S"])],
  };

  it("can be raised with a card from the hand, and the raiser takes it over", () => {
    const next = raiseBuild(state, "p1", "A-hearts", "build-p2");
    expect(next.builds[0]).toEqual({ id: "build-p2", sets: [cards("2S 5S AH")], value: 8, ownerId: "p1" });
    expect(next.log.at(-1)?.message).toBe("Player 1 raised Player 2's build from 7 to 8 with A♥ and took it over.");
  });

  it("is still weak after being raised, so the next player can raise it again", () => {
    let game = { ...scenario({ p1: "AH 8S", p2: "AD 9C" }, "3C", 3), builds: [makeBuild("p3", ["2S 5S"])] };
    game = raiseBuild(game, "p1", "A-hearts", "build-p3");
    expect(isStrongBuild(game.builds[0])).toBe(false);

    game = raiseBuild(game, "p2", "A-diamonds", "build-p3");
    expect(game.builds[0]).toMatchObject({ value: 9, ownerId: "p2" });
  });

  it("can take a new set of the same value, and the player takes it over (now strong)", () => {
    const next = addToBuild(state, "p1", "4-hearts", "build-p2", ["3-clubs"]);
    expect(next.builds[0].sets).toEqual([cards("2S 5S"), cards("3C 4H")]);
    expect(next.builds[0].ownerId).toBe("p1");
    expect(isStrongBuild(next.builds[0])).toBe(true);
    expect(next.log.at(-1)?.message).toBe("Player 1 added 3♣ + 4♥ to Player 2's build of 7 and took it over.");
  });

  it("can't be raised by a player without a card of the new value", () => {
    expect(() => raiseBuild(state, "p1", "2-diamonds", "build-p2")).toThrow(
      "You need to keep a 9 in your hand to capture this build.",
    );
  });

  it("can't be raised above 10", () => {
    expect(() => raiseBuild(state, "p1", "4-hearts", "build-p2")).toThrow("A build can't be worth more than 10.");
  });

  it("can't be taken by a player who already owns a build of another value", () => {
    const alreadyOwns = { ...state, builds: [...state.builds, makeBuild("p1", ["6D 3S"])] };
    expect(() => raiseBuild(alreadyOwns, "p1", "A-hearts", "build-p2")).toThrow(
      "You already own a build of 9. Another build must also be worth 9, and then the two join into one.",
    );
  });
});

describe("an opponent's strong build", () => {
  const state = { ...scenario({ p1: "AH 8S 4H 7C" }, "3C"), builds: [makeBuild("p2", ["2S 5S", "6D AD"])] };
  const strongMessage = "That build is strong, so it can't be changed. It can only be captured.";

  it("can't be raised", () => {
    expect(() => raiseBuild(state, "p1", "A-hearts", "build-p2")).toThrow(strongMessage);
  });

  it("can't have sets added to it", () => {
    expect(() => addToBuild(state, "p1", "4-hearts", "build-p2", ["3-clubs"])).toThrow(strongMessage);
  });

  it("can still be captured with a card of its value", () => {
    expect(captureCards(state, "p1", "7-clubs", [], ["build-p2"]).builds).toEqual([]);
  });
});

describe("capturing a build", () => {
  it("takes an opponent's build with a card of the same value", () => {
    const state = { ...scenario({ p1: "8S 2C" }, "9D"), builds: [makeBuild("p2", ["5H 3C"])] };
    const next = captureCards(state, "p1", "8-spades", [], ["build-p2"]);

    expect(next.builds).toEqual([]);
    expect(ids(next.capturePiles.p1)).toEqual(["5-hearts", "3-clubs", "8-spades"]);
    expect(next.lastCapturePlayerId).toBe("p1");
    expect(next.log.at(-1)?.message).toBe("Player 1 captured Player 2's build of 8 (5♥ + 3♣) with 8♠.");
  });

  it("lets the owner capture their own build", () => {
    const state = { ...scenario({ p1: "8S 2C" }, ""), builds: [makeBuild("p1", ["5H 3C"])] };
    const next = captureCards(state, "p1", "8-spades", [], ["build-p1"]);
    expect(next.log.at(-1)?.message).toBe("Player 1 captured their build of 8 (5♥ + 3♣) with 8♠.");
  });

  it("can take a build and loose cards in the same move", () => {
    const state = { ...scenario({ p1: "8S 2C" }, "6D 2H 9D"), builds: [makeBuild("p2", ["5H 3C"])] };
    const next = captureCards(state, "p1", "8-spades", ["6-diamonds", "2-hearts"], ["build-p2"]);

    expect(ids(next.tableCards)).toEqual(["9-diamonds"]);
    expect(next.capturePiles.p1).toHaveLength(5);
    expect(next.log.at(-1)?.message).toBe(
      "Player 1 captured Player 2's build of 8 (5♥ + 3♣) and 6♦ + 2♥ with 8♠.",
    );
  });

  it("won't take a build of a different value", () => {
    const state = { ...scenario({ p1: "9S 2C" }, ""), builds: [makeBuild("p2", ["5H 3C"])] };
    expect(() => captureCards(state, "p1", "9-spades", [], ["build-p2"])).toThrow(
      "That build is worth 8, so it can only be captured with an 8.",
    );
  });

  it("won't take a build that isn't on the table", () => {
    expect(() => captureCards(scenario({ p1: "8S 2C" }, ""), "p1", "8-spades", [], ["build-p9"])).toThrow(
      "That build is not on the table.",
    );
  });
});

describe("keeping a card to capture your build", () => {
  // p1 owns a build of 8 and holds only one 8.
  const state = { ...scenario({ p1: "8S 3D" }, "5C 3H 8H"), builds: [makeBuild("p1", ["6S 2S"])] };

  it("stops the owner using their last 8 to capture other cards", () => {
    expect(() => captureCards(state, "p1", "8-spades", ["5-clubs", "3-hearts"])).toThrow(
      "You must keep an 8 in your hand to capture your build.",
    );
  });

  it("lets the owner capture their build, and other cards with it", () => {
    const next = captureCards(state, "p1", "8-spades", ["5-clubs", "3-hearts", "8-hearts"], ["build-p1"]);
    expect(next.builds).toEqual([]);
    expect(next.tableCards).toEqual([]);
  });

  it("lets an owner with two 8s use one of them elsewhere", () => {
    const twoEights = withHand(state, "p1", "8S 8D 3D");
    expect(() => captureCards(twoEights, "p1", "8-spades", ["5-clubs", "3-hearts"])).not.toThrow();
  });
});

describe("legal moves with builds", () => {
  it("offers building and raising, and every listed move is legal", () => {
    const state = { ...scenario({ p1: "3H 8S AD" }, "5C"), builds: [makeBuild("p2", ["2S 5S"])] };
    const moves = getLegalMoves(state, "p1");

    expect(moves).toContainEqual({ action: "BUILD", cardId: "3-hearts", tableCardIds: ["5-clubs"], value: 8 });
    expect(moves).toContainEqual({ action: "RAISE_BUILD", cardId: "A-diamonds", buildId: "build-p2" });
    for (const move of moves) {
      expect(getMoveError(state, "p1", move)).toBeNull();
    }
  });

  it("only lets an owner play their last card of the build's value by capturing the build", () => {
    const state = { ...scenario({ p1: "8S" }, "8H"), builds: [makeBuild("p1", ["6S 2S"])] };
    expect(getLegalMoves(state, "p1")).toEqual([
      { action: "CAPTURE", cardId: "8-spades", tableCardIds: [], buildIds: ["build-p1"] },
      { action: "CAPTURE", cardId: "8-spades", tableCardIds: ["8-hearts"], buildIds: ["build-p1"] },
    ]);
  });

  it("plays build moves through applyMove", () => {
    const state = scenario({ p1: "3H 8S" }, "5C");
    const move: Move = { action: "BUILD", cardId: "3-hearts", tableCardIds: ["5-clubs"], value: 8 };
    expect(applyMove(state, "p1", move)).toEqual(createBuild(state, "p1", "3-hearts", ["5-clubs"], 8));
  });
});
