import { describe, expect, it } from "vitest";
import {
  IllegalMoveError,
  addToCapturePile,
  applyMove,
  canCapture,
  canDrift,
  captureCards,
  drift,
  getCapturableCardIds,
  getLegalMoves,
  getPlayer,
  getTopCard,
  splitIntoGroups,
} from "../src";
import { buildOwnedBy, cards, ids, scenario } from "./helpers";

describe("splitIntoGroups", () => {
  it("splits cards into groups that each add up to the value", () => {
    expect(splitIntoGroups(cards("8H 5C 3D"), 8)).toEqual([cards("8H"), cards("5C 3D")]);
  });

  it("finds the right split when the first thing it tries doesn't work", () => {
    expect(splitIntoGroups(cards("6H 5C 4D 3S 2H"), 10)).toEqual([cards("6H 4D"), cards("5C 3S 2H")]);
  });

  it("returns null when the cards can't be split that way", () => {
    expect(splitIntoGroups(cards("5C 4D"), 8)).toBeNull();
    expect(splitIntoGroups(cards("5C 3D 2H"), 8)).toBeNull();
    expect(splitIntoGroups(cards("9C"), 8)).toBeNull();
  });

  it("pairs up cards of equal value correctly", () => {
    expect(splitIntoGroups(cards("7C 7D AH AS"), 8)).toEqual([cards("7C AH"), cards("7D AS")]);
  });
});

describe("a valid capture", () => {
  it("takes a single card of the same value", () => {
    const next = captureCards(scenario({ p1: "8S 2C" }, "8H 3C"), "p1", "8-spades", ["8-hearts"]);
    expect(ids(next.tableCards)).toEqual(["3-clubs"]);
    expect(ids(getPlayer(next, "p1").hand)).toEqual(["2-clubs"]);
    expect(next.capturePiles.p1).toHaveLength(2);
  });

  it("takes several cards that add up to the played card (3 + 5 with an 8)", () => {
    const next = captureCards(scenario({ p1: "8S 2C" }, "3H 5C"), "p1", "8-spades", ["3-hearts", "5-clubs"]);
    expect(next.tableCards).toEqual([]);
    expect(next.capturePiles.p1).toHaveLength(3);
  });

  it("takes several groups at once (8, 5 + 3 and 6 + 2 with an 8)", () => {
    const state = scenario({ p1: "8S 2C" }, "8H 5C 3D 6S 2H 9C");
    const next = captureCards(state, "p1", "8-spades", ["8-hearts", "5-clubs", "3-diamonds", "6-spades", "2-hearts"]);
    expect(ids(next.tableCards)).toEqual(["9-clubs"]);
    expect(next.capturePiles.p1).toHaveLength(6);
  });

  it("lets the player choose to take only some of the groups", () => {
    const next = captureCards(scenario({ p1: "8S 2C" }, "8H 5C 3D"), "p1", "8-spades", ["5-clubs", "3-diamonds"]);
    expect(ids(next.tableCards)).toEqual(["8-hearts"]);
  });

  it("passes the turn to the next player", () => {
    const next = captureCards(scenario({ p1: "8S 2C" }, "8H"), "p1", "8-spades", ["8-hearts"]);
    expect(next.currentPlayerId).toBe("p2");
  });

  it("writes the capture to the game log", () => {
    const state = scenario({ p1: "8S 2C" }, "8H 5C 3D");
    const next = captureCards(state, "p1", "8-spades", ["8-hearts", "5-clubs", "3-diamonds"]);
    expect(next.log.at(-1)).toEqual({
      id: state.log.length + 1,
      message: "Player 1 captured 8♥ and 5♣ + 3♦ with 8♠.",
      playerId: "p1",
    });
  });

  it("is allowed while the player owns a build (keeping another card to capture it)", () => {
    const state = { ...scenario({ p1: "8S 8D 2C" }, "5C 3D"), builds: [buildOwnedBy("p1")] };
    expect(canDrift(state, "p1")).toBe(false);
    expect(canCapture(state, "p1", "8-spades", ["5-clubs", "3-diamonds"])).toBe(true);
  });

  it("can take the face-up card in a 3-player game", () => {
    const state = scenario({ p1: "4S 9C" }, "4H", 3);
    const next = captureCards(state, "p1", "4-spades", ["4-hearts"]);
    expect(next.tableCards).toEqual([]);
    expect(next.currentPlayerId).toBe("p2");
  });

  it("leaves the original state unchanged", () => {
    const state = scenario({ p1: "8S 2C" }, "8H");
    const snapshot = JSON.parse(JSON.stringify(state));
    captureCards(state, "p1", "8-spades", ["8-hearts"]);
    expect(state).toEqual(snapshot);
  });
});

describe("an invalid capture", () => {
  const state = scenario({ p1: "8S 2C", p2: "7H 4S" }, "3H 4C 9D 5S");
  const doesNotAddUp = "Those cards don't add up to 8. Each group you capture must add up to 8.";

  it.each([
    ["cards that don't add up to the played card", ["3-hearts", "4-clubs"], doesNotAddUp],
    ["a card worth more than the played card", ["9-diamonds"], doesNotAddUp],
    ["a correct group plus an extra card", ["3-hearts", "5-spades", "4-clubs"], doesNotAddUp],
    ["nothing at all", [], "Choose the cards or builds you want to capture."],
    ["the same table card twice", ["3-hearts", "5-spades", "3-hearts"], "You chose the same table card twice."],
    ["a card that isn't on the table", ["7-hearts"], "You can only use cards that are loose on the table."],
  ])("rejects %s", (_, tableCardIds, message) => {
    expect(canCapture(state, "p1", "8-spades", tableCardIds)).toBe(false);
    expect(() => captureCards(state, "p1", "8-spades", tableCardIds)).toThrow(IllegalMoveError);
    expect(() => captureCards(state, "p1", "8-spades", tableCardIds)).toThrow(message);
  });

  it("rejects a card the player isn't holding", () => {
    expect(() => captureCards(state, "p1", "7-hearts", ["3-hearts", "4-clubs"])).toThrow(
      "That card is not in your hand.",
    );
  });

  it("rejects a capture when it isn't the player's turn", () => {
    expect(() => captureCards(state, "p2", "7-hearts", ["3-hearts", "4-clubs"])).toThrow("It's not your turn.");
  });
});

describe("the capture pile", () => {
  it("receives the captured cards in the order they lay, with the capturing card on top", () => {
    const next = captureCards(scenario({ p1: "7C 2C" }, "2S 5H"), "p1", "7-clubs", ["2-spades", "5-hearts"]);
    expect(ids(next.capturePiles.p1)).toEqual(["2-spades", "5-hearts", "7-clubs"]);
    expect(getTopCard(next.capturePiles.p1)?.id).toBe("7-clubs");
  });

  it("doesn't sort the captured cards", () => {
    const highFirst = captureCards(scenario({ p1: "9S 2C" }, "5H 4C"), "p1", "9-spades", ["5-hearts", "4-clubs"]);
    const lowFirst = captureCards(scenario({ p1: "9S 2C" }, "4C 5H"), "p1", "9-spades", ["5-hearts", "4-clubs"]);
    expect(ids(highFirst.capturePiles.p1)).toEqual(["5-hearts", "4-clubs", "9-spades"]);
    expect(ids(lowFirst.capturePiles.p1)).toEqual(["4-clubs", "5-hearts", "9-spades"]);
  });

  it("orders the cards the same way whatever order they were selected in", () => {
    const state = scenario({ p1: "7C 2C" }, "2S 5H");
    const first = captureCards(state, "p1", "7-clubs", ["2-spades", "5-hearts"]);
    const second = captureCards(state, "p1", "7-clubs", ["5-hearts", "2-spades"]);
    expect(first.capturePiles.p1).toEqual(second.capturePiles.p1);
  });

  it("stacks new captures on top of earlier ones", () => {
    let state = scenario({ p1: "7C 3C", p2: "9H 9D" }, "2S 5H 3D");
    state = captureCards(state, "p1", "7-clubs", ["2-spades", "5-hearts"]);
    state = drift(state, "p2", "9-hearts");
    state = captureCards(state, "p1", "3-clubs", ["3-diamonds"]);
    expect(ids(state.capturePiles.p1)).toEqual(["2-spades", "5-hearts", "7-clubs", "3-diamonds", "3-clubs"]);
  });

  it("only changes the capturing player's pile", () => {
    const next = captureCards(scenario({ p1: "8S 2C" }, "8H"), "p1", "8-spades", ["8-hearts"]);
    expect(next.capturePiles.p2).toEqual([]);
  });

  it("addToCapturePile adds cards on top, capturing card last, without touching the cards below", () => {
    expect(ids(addToCapturePile(cards("10D"), cards("2S 8D 5H"), cards("9C")[0]))).toEqual([
      "10-diamonds",
      "2-spades",
      "8-diamonds",
      "5-hearts",
      "9-clubs",
    ]);
  });

  it("an empty pile has no top card", () => {
    expect(getTopCard([])).toBeUndefined();
  });
});

describe("last-capture tracking", () => {
  it("records who made the capture", () => {
    const next = captureCards(scenario({ p1: "8S 2C" }, "8H"), "p1", "8-spades", ["8-hearts"]);
    expect(next.lastCapturePlayerId).toBe("p1");
  });

  it("is not changed by a later drift", () => {
    let state = captureCards(scenario({ p1: "8S 2C", p2: "9H 9D" }, "8H"), "p1", "8-spades", ["8-hearts"]);
    state = drift(state, "p2", "9-hearts");
    expect(state.lastCapturePlayerId).toBe("p1");
  });

  it("moves to whoever captures next", () => {
    let state = captureCards(scenario({ p1: "8S 2C", p2: "9H 9D" }, "8H 9C"), "p1", "8-spades", ["8-hearts"]);
    state = captureCards(state, "p2", "9-hearts", ["9-clubs"]);
    expect(state.lastCapturePlayerId).toBe("p2");
  });
});

describe("capture options", () => {
  it("finds every table card that is part of a group adding up to the value", () => {
    const state = scenario({ p1: "8S" }, "8H 5C 3D 9S 7C");
    expect(getCapturableCardIds(state, 8)).toEqual(new Set(["8-hearts", "5-clubs", "3-diamonds"]));
  });

  it("lists a CAPTURE move for every group each hand card can take", () => {
    const state = scenario({ p1: "8S 3C" }, "8H 5C 3D");
    const captures = getLegalMoves(state, "p1").filter((move) => move.action === "CAPTURE");
    expect(captures).toEqual([
      { action: "CAPTURE", cardId: "8-spades", tableCardIds: ["8-hearts"] },
      { action: "CAPTURE", cardId: "8-spades", tableCardIds: ["5-clubs", "3-diamonds"] },
      { action: "CAPTURE", cardId: "3-clubs", tableCardIds: ["3-diamonds"] },
    ]);
  });

  it("plays a CAPTURE move through applyMove", () => {
    const state = scenario({ p1: "8S 2C" }, "8H");
    const move = { action: "CAPTURE" as const, cardId: "8-spades", tableCardIds: ["8-hearts"] };
    expect(applyMove(state, "p1", move)).toEqual(captureCards(state, "p1", "8-spades", ["8-hearts"]));
  });
});

describe("capturing and the two phases", () => {
  it("still deals Phase 2 when the last card of Phase 1 is a capture", () => {
    let state = scenario({ p1: "4S", p2: "4H" }, "");
    state = drift(state, "p1", "4-spades");
    state = captureCards(state, "p2", "4-hearts", ["4-spades"]);
    expect(state.phase).toBe(2);
    expect(state.players.every((p) => p.hand.length === 10)).toBe(true);
  });
});
