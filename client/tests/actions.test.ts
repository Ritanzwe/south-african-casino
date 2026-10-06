// The buttons the table offers for a selection, checked against the situations in the user's
// screenshots, so a selection that should work keeps showing its button.

import { describe, expect, it } from "vitest";
import { getActions } from "../src/components/GameScreen";
import { cards, makeBuild, scenario, withPiles } from "../../packages/engine/tests/helpers";

const labels = (actions: { label: string }[]) => actions.map((action) => action.label);

describe("raising another player's build into yours (screenshot 16:13)", () => {
  // Dali (p1) owns a strong build of 10; Bidi (p2) a weak build of 9. Dali picks A♥.
  const state = {
    ...scenario({ p1: "AH 8S 10H" }, "10C 5S"),
    builds: [makeBuild("p1", ["7D 3H", "6C 3S AC"]), makeBuild("p2", ["7S 2C"])],
  };
  const ace = cards("AH")[0];

  it("offers RAISE TO 10 with only their build picked", () => {
    const actions = getActions(state, "p1", { handCard: ace, tableCardIds: [], buildIds: ["build-p2"], pileCardIds: [] });
    expect(labels(actions)).toEqual(["RAISE TO 10"]);
  });

  it("offers it too when your own build is picked as well", () => {
    const actions = getActions(state, "p1", {
      handCard: ace,
      tableCardIds: [],
      buildIds: ["build-p2", "build-p1"],
      pileCardIds: [],
    });
    expect(actions).toEqual([
      { label: "RAISE TO 10", move: { action: "RAISE_BUILD", cardId: "A-hearts", buildId: "build-p2", tableCardIds: [] } },
    ]);
  });
});

describe("other screenshots", () => {
  it("19:08: your 4 + their top 5 with a floor 9 builds 9", () => {
    const state = withPiles(scenario({ p1: "AH AC AS 3H 4C 4S 7H 8S 9D 10H" }, "9C 10C 7C"), { p2: "2D 7D 5C" });
    const actions = getActions(state, "p1", {
      handCard: cards("4C")[0],
      tableCardIds: ["9-clubs"],
      buildIds: [],
      pileCardIds: ["5-clubs"],
    });
    expect(labels(actions)).toEqual(["BUILD 9"]);
  });

  it("your build of 9 + a floor 6 with their top 3, without clicking the build", () => {
    const state = withPiles({ ...scenario({ p1: "9C" }, "5S 6S"), builds: [makeBuild("p1", ["9D", "9H"])] }, { p2: "7C 3S" });
    const actions = getActions(state, "p1", {
      handCard: cards("9C")[0],
      tableCardIds: ["6-spades"],
      buildIds: [],
      pileCardIds: ["3-spades"],
    });
    expect(labels(actions)).toEqual(["CAPTURE WITH MY BUILD"]);
  });

  it("their top 8 brings the 8 under it", () => {
    const state = withPiles(scenario({ p1: "8C 3H" }, "8D 5C"), { p2: "2D 8S 8H" });
    const actions = getActions(state, "p1", {
      handCard: cards("8C")[0],
      tableCardIds: ["8-diamonds"],
      buildIds: [],
      pileCardIds: ["8-hearts"],
    });
    expect(actions[0].move).toMatchObject({ action: "CAPTURE", pileCardIds: ["8-hearts", "8-spades"] });
  });

  it("topping up Aces", () => {
    const state = scenario({ p1: "AH AC 3D 10S" }, "8H AS");
    const actions = getActions(state, "p1", { handCard: cards("AC")[0], tableCardIds: ["A-spades"], buildIds: [], pileCardIds: [] });
    expect(labels(actions)).toEqual(["CAPTURE", "BUILD ACES"]);
  });
});
