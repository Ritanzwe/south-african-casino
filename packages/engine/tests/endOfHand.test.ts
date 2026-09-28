import { describe, expect, it } from "vitest";
import { calculateScores, captureCards, drift } from "../src";
import { ids, scenario } from "./helpers";

/**
 * A 3-player game down to its last three cards. p1 captures the 8♥ with the 8♠,
 * then p2 and p3 drift their last cards, which ends the game.
 */
function playToTheEnd(table = "8H 3C") {
  let state = scenario({ p1: "8S", p2: "4D", p3: "5C" }, table, 3);
  state = captureCards(state, "p1", "8-spades", ["8-hearts"]);
  state = drift(state, "p2", "4-diamonds");
  return drift(state, "p3", "5-clubs");
}

describe("the end of the hand", () => {
  it("finishes once every card has been played", () => {
    expect(playToTheEnd().status).toBe("finished");
  });

  it("gives the cards left on the table to the last player who captured", () => {
    const state = playToTheEnd();
    expect(state.tableCards).toEqual([]);
    expect(ids(state.capturePiles.p1)).toEqual(["8-spades", "8-hearts", "5-clubs", "4-diamonds", "3-clubs"]);
  });

  it("doesn't count the drifts that came after as the last capture", () => {
    const state = playToTheEnd();
    expect(state.lastCapturePlayerId).toBe("p1");
    expect(state.capturePiles.p2).toEqual([]);
    expect(state.capturePiles.p3).toEqual([]);
  });

  it("calculates the final score after the remaining cards are awarded", () => {
    // The 10♦ is still on the table at the end, so it goes to p1 and is worth 2 points.
    const scores = calculateScores(playToTheEnd("8H 10D"));
    expect(scores.p1).toMatchObject({ cardsMajority: 2, tenOfDiamonds: 2, total: 4 });
    expect(scores.p2.total).toBe(0);
  });

  it("logs the leftover cards, the final score and the winner", () => {
    const messages = playToTheEnd("8H 10D").log.map((entry) => entry.message);
    expect(messages.slice(-4)).toEqual([
      "All cards have been played.",
      "Player 1 made the last capture, so they take the 3 cards left on the table.",
      "Final score: Player 1 4, Player 2 0, Player 3 0.",
      "Player 1 wins!",
    ]);
  });

  it("leaves the cards on the table when nobody captured anything", () => {
    let state = scenario({ p1: "8S", p2: "4D", p3: "5C" }, "9H", 3);
    state = drift(state, "p1", "8-spades");
    state = drift(state, "p2", "4-diamonds");
    state = drift(state, "p3", "5-clubs");

    expect(state.tableCards).toHaveLength(4);
    expect(state.log.map((entry) => entry.message)).toContain(
      "Nobody made a capture, so the 4 cards left on the table go to no one.",
    );
  });
});
