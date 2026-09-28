import { describe, expect, it } from "vitest";
import {
  applyMove,
  canStealCapturePileCard,
  captureCards,
  getLegalMoves,
  getMoveError,
  getPlayer,
  getTopCard,
  isStrongBuild,
  stealIntoBuild,
  type Move,
} from "../src";
import { cards, ids, makeBuild, scenario, withPiles } from "./helpers";

/** p1 owns a build of 8 (5 + 3). p2's capture pile has A♠ on top, with 7♦ and 10♣ underneath. */
function setUp(hand = "7H 8S 8D", table = "7C") {
  return withPiles({ ...scenario({ p1: hand }, table), builds: [makeBuild("p1", ["5S 3S"])] }, { p2: "10C 7D AS" });
}

describe("stealing into your own build", () => {
  it("adds a hand card and the stolen top card as one set (hand 7 + stolen A♠ = 8)", () => {
    const next = stealIntoBuild(setUp(), "p1", "7-hearts", "build-p1", "A-spades", []);

    expect(next.builds[0].sets).toEqual([cards("5S 3S"), cards("7H AS")]);
    expect(ids(next.capturePiles.p2)).toEqual(["10-clubs", "7-diamonds"]);
    expect(ids(getPlayer(next, "p1").hand)).toEqual(["8-spades", "8-diamonds"]);
    expect(next.currentPlayerId).toBe("p2");
    expect(next.log.at(-1)?.message).toBe(
      "Player 1 stole A♠ from Player 2's capture pile and added 7♥ + A♠ to their build of 8.",
    );
  });

  it("can combine the stolen card with loose cards, adding a matching hand card as its own set", () => {
    const next = stealIntoBuild(setUp(), "p1", "8-spades", "build-p1", "A-spades", ["7-clubs"]);
    expect(next.builds[0].sets).toEqual([cards("5S 3S"), cards("7C AS"), cards("8S")]);
    expect(next.tableCards).toEqual([]);
  });

  it("makes the build strong", () => {
    const next = stealIntoBuild(setUp(), "p1", "7-hearts", "build-p1", "A-spades", []);
    expect(isStrongBuild(next.builds[0])).toBe(true);
  });

  it("is not a capture", () => {
    const next = stealIntoBuild(setUp(), "p1", "7-hearts", "build-p1", "A-spades", []);
    expect(next.lastCapturePlayerId).toBeUndefined();
    expect(next.capturePiles.p1).toEqual([]);
  });

  it("leaves the next card as the new top card", () => {
    const next = stealIntoBuild(setUp(), "p1", "7-hearts", "build-p1", "A-spades", []);
    expect(getTopCard(next.capturePiles.p2)?.id).toBe("7-diamonds");
  });
});

describe("stealing into an opponent's build", () => {
  it("takes over a weak build", () => {
    const state = withPiles(
      { ...scenario({ p1: "7H 8S" }, "", 3), builds: [makeBuild("p2", ["5S 3S"])] },
      { p3: "10C AS" },
    );
    const next = stealIntoBuild(state, "p1", "7-hearts", "build-p2", "A-spades", []);

    expect(next.builds[0]).toMatchObject({ ownerId: "p1", sets: [cards("5S 3S"), cards("7H AS")] });
    expect(next.log.at(-1)?.message).toBe(
      "Player 1 stole A♠ from Player 3's capture pile and added 7♥ + A♠ to Player 2's build of 8 and took it over.",
    );
  });

  it("won't go into a strong build", () => {
    const state = withPiles(
      { ...scenario({ p1: "7H 8S" }, ""), builds: [makeBuild("p2", ["5S 3S", "6D 2D"])] },
      { p2: "10C AS" },
    );
    expect(() => stealIntoBuild(state, "p1", "7-hearts", "build-p2", "A-spades", [])).toThrow(
      "That build is strong, so it can't be changed. It can only be captured.",
    );
  });
});

describe("only the top card can be stolen", () => {
  it("allows the top card of another player's pile", () => {
    expect(canStealCapturePileCard(setUp(), "p1", "A-spades")).toBe(true);
  });

  it("refuses a card underneath the top card", () => {
    const state = setUp();
    expect(canStealCapturePileCard(state, "p1", "7-diamonds")).toBe(false);
    expect(() => stealIntoBuild(state, "p1", "7-hearts", "build-p1", "7-diamonds", [])).toThrow(
      "Only the top card of a capture pile can be stolen.",
    );
  });

  it("refuses a card from the player's own capture pile", () => {
    const state = withPiles(setUp(), { p1: "9C 2H" });
    expect(() => stealIntoBuild(state, "p1", "7-hearts", "build-p1", "2-hearts", [])).toThrow(
      "You can't steal from your own capture pile.",
    );
  });

  it("refuses a card that isn't in any capture pile", () => {
    expect(() => stealIntoBuild(setUp(), "p1", "7-hearts", "build-p1", "9-hearts", [])).toThrow(
      "That card isn't in a capture pile.",
    );
  });

  it("never lets a normal capture take a capture-pile card", () => {
    expect(() => captureCards(setUp("AH 8S"), "p1", "A-hearts", ["A-spades"])).toThrow(
      "You can only use cards that are loose on the table.",
    );
  });
});

describe("the steal has to fit the build", () => {
  it("needs every new set to add up to the build's value", () => {
    expect(() => stealIntoBuild(setUp(), "p1", "8-spades", "build-p1", "A-spades", [])).toThrow(
      "Every set you add to this build must add up to 8.",
    );
  });

  it("needs a build to steal into", () => {
    expect(() => stealIntoBuild(setUp(), "p1", "7-hearts", "build-p9", "A-spades", [])).toThrow(
      "That build is not on the table.",
    );
  });

  it("needs a card from the player's hand in the new sets", () => {
    // The stolen A♠ and the loose 7♣ make 8 on their own, but the hand card must fit too.
    const state = setUp("3H 8S 8D");
    expect(() => stealIntoBuild(state, "p1", "3-hearts", "build-p1", "A-spades", ["7-clubs"])).toThrow(
      "Every set you add to this build must add up to 8.",
    );
    expect(() => stealIntoBuild(state, "p1", "9-hearts", "build-p1", "A-spades", ["7-clubs"])).toThrow(
      "That card is not in your hand.",
    );
  });

  it("needs the player to keep a card of the build's value", () => {
    expect(() => stealIntoBuild(setUp("8S 4D"), "p1", "8-spades", "build-p1", "A-spades", ["7-clubs"])).toThrow(
      "You need to keep an 8 in your hand to capture this build.",
    );
  });
});

describe("legal steal moves", () => {
  it("lists both ways of stealing the A♠, and every listed move is legal", () => {
    const state = setUp();
    const moves = getLegalMoves(state, "p1");

    expect(moves).toContainEqual({
      action: "STEAL",
      cardId: "7-hearts",
      buildId: "build-p1",
      stolenCardId: "A-spades",
      tableCardIds: [],
    });
    expect(moves).toContainEqual({
      action: "STEAL",
      cardId: "8-spades",
      buildId: "build-p1",
      stolenCardId: "A-spades",
      tableCardIds: ["7-clubs"],
    });
    for (const move of moves) {
      expect(getMoveError(state, "p1", move)).toBeNull();
    }
  });

  it("plays a STEAL move through applyMove", () => {
    const state = setUp();
    const move: Move = {
      action: "STEAL",
      cardId: "7-hearts",
      buildId: "build-p1",
      stolenCardId: "A-spades",
      tableCardIds: [],
    };
    expect(applyMove(state, "p1", move)).toEqual(stealIntoBuild(state, "p1", "7-hearts", "build-p1", "A-spades", []));
  });
});
