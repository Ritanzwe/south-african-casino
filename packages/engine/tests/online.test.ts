import { describe, expect, it } from "vitest";
import { getDeckSize, getHandSize, getLegalMoves, getPlayerView, parseMove } from "../src";
import { newGame } from "./helpers";

describe("getPlayerView", () => {
  const state = newGame(2, { previousLoserId: "p1" });
  const view = getPlayerView(state, "p1");

  it("keeps the viewer's own hand", () => {
    expect(view.players[0].hand).toEqual(state.players[0].hand);
  });

  it("hides the other players' hands and the deck", () => {
    expect(view.players[1].hand).toEqual([]);
    expect(view.deck).toEqual([]);
    expect(JSON.stringify(view)).not.toContain(state.players[1].hand[0].id);
  });

  it("still says how many cards everyone holds and how many are left to deal", () => {
    expect(getHandSize(view, "p2")).toBe(10);
    expect(getDeckSize(view)).toBe(20);
    expect(getHandSize(state, "p2")).toBe(10);
    expect(getDeckSize(state)).toBe(20);
  });

  it("is enough for the viewer to work out their legal moves", () => {
    expect(getLegalMoves(view, "p1")).toEqual(getLegalMoves(state, "p1"));
  });
});

describe("parseMove", () => {
  it("accepts well-formed moves", () => {
    expect(parseMove({ action: "DRIFT", cardId: "7-spades" })).toEqual({ action: "DRIFT", cardId: "7-spades" });
    expect(parseMove({ action: "CAPTURE", cardId: "8-spades", tableCardIds: ["8-hearts"] })).toEqual({
      action: "CAPTURE",
      cardId: "8-spades",
      tableCardIds: ["8-hearts"],
      buildIds: [],
    });
    expect(parseMove({ action: "BUILD", cardId: "3-hearts", tableCardIds: ["5-clubs"], value: 8 })).toMatchObject({
      value: 8,
    });
  });

  it("drops fields that don't belong to the move", () => {
    expect(parseMove({ action: "DRIFT", cardId: "7-spades", score: 99 })).toEqual({
      action: "DRIFT",
      cardId: "7-spades",
    });
  });

  it.each([
    ["nothing", null],
    ["a string", "DRIFT"],
    ["an unknown action", { action: "CHEAT", cardId: "7-spades" }],
    ["a missing card", { action: "DRIFT" }],
    ["a card id that isn't text", { action: "DRIFT", cardId: 7 }],
    ["table cards that aren't a list", { action: "CAPTURE", cardId: "8-spades", tableCardIds: "8-hearts" }],
    ["a build value that isn't a whole number", { action: "BUILD", cardId: "3-hearts", tableCardIds: [], value: 8.5 }],
    ["a steal without a stolen card", { action: "STEAL", cardId: "7-hearts", buildId: "b", tableCardIds: [] }],
  ])("rejects %s", (_, input) => {
    expect(parseMove(input)).toBeNull();
  });
});
