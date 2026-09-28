import { describe, expect, it } from "vitest";
import {
  SOUTH_AFRICAN_CASINO_RULES as RULES,
  canDealSecondPhase,
  createDeck,
  dealCards,
  dealSecondPhase,
  getDealOrder,
  type GameState,
  type PlayerCount,
} from "../src";
import { driftTurns, makePlayers, newGame } from "./helpers";

const PLAYER_COUNTS: PlayerCount[] = [2, 3, 4];

/** The ids of every card in the game that hasn't been played: hands, table and deck. */
function cardIdsInPlay(state: GameState): string[] {
  return [...state.players.flatMap((p) => p.hand), ...state.tableCards, ...state.deck].map((c) => c.id);
}

describe("dealCards", () => {
  it("deals one card at a time, starting with the first player in the deal order", () => {
    const deck = createDeck();
    const { hands } = dealCards(deck, ["p1", "p2"], 3);
    expect(hands.p1).toEqual([deck[0], deck[2], deck[4]]);
    expect(hands.p2).toEqual([deck[1], deck[3], deck[5]]);
  });

  it("places the face-up table cards after the players' cards", () => {
    const deck = createDeck();
    const result = dealCards(deck, ["p1", "p2", "p3"], 13, 1);
    expect(result.tableCards).toEqual([deck[39]]);
    expect(result.deck).toEqual([]);
  });

  it("keeps the cards that were not dealt in the deck", () => {
    const deck = createDeck();
    const result = dealCards(deck, ["p1", "p2"], 10);
    expect(result.deck).toEqual(deck.slice(20));
  });

  it("does not change the deck passed in", () => {
    const deck = createDeck();
    dealCards(deck, ["p1", "p2"], 10);
    expect(deck).toEqual(createDeck());
  });

  it("refuses to deal more cards than the deck has", () => {
    expect(() => dealCards(createDeck(), ["p1", "p2", "p3", "p4", "p5"], 10)).toThrow(/Not enough cards/);
  });
});

describe("dealing for 2 players", () => {
  it("gives each player 10 cards and puts no cards on the table", () => {
    const state = newGame(2);
    for (const player of state.players) {
      expect(player.hand).toHaveLength(10);
    }
    expect(state.tableCards).toHaveLength(0);
  });

  it("keeps the other 20 cards back for Phase 2", () => {
    const state = newGame(2);
    expect(state.deck).toHaveLength(20);
    expect(state.phase).toBe(1);
  });
});

describe("dealing for 3 players", () => {
  it("gives each player 13 cards and puts 1 card face up on the table", () => {
    const state = newGame(3);
    for (const player of state.players) {
      expect(player.hand).toHaveLength(13);
    }
    expect(state.tableCards).toHaveLength(1);
    expect(state.deck).toHaveLength(0);
  });
});

describe("dealing for 4 players", () => {
  it("gives each player 10 cards and puts no cards on the table", () => {
    const state = newGame(4);
    for (const player of state.players) {
      expect(player.hand).toHaveLength(10);
    }
    expect(state.tableCards).toHaveLength(0);
    expect(state.deck).toHaveLength(0);
  });
});

describe.each(PLAYER_COUNTS)("dealing for %i players", (count) => {
  it("uses every one of the 40 cards exactly once", () => {
    const cardIds = cardIdsInPlay(newGame(count));
    expect(cardIds).toHaveLength(40);
    expect(new Set(cardIds)).toEqual(new Set(createDeck().map((c) => c.id)));
  });

  it("follows the rule configuration", () => {
    const state = newGame(count);
    for (const player of state.players) {
      expect(player.hand).toHaveLength(RULES.cardsPerPlayer[count]);
    }
    expect(state.tableCards).toHaveLength(RULES.faceUpCards[count]);
  });
});

describe("the second deal in a 2-player game", () => {
  it("happens automatically once both players have played their first 10 cards", () => {
    const state = driftTurns(newGame(2), 20);
    expect(state.phase).toBe(2);
    for (const player of state.players) {
      expect(player.hand).toHaveLength(10);
    }
    expect(state.deck).toHaveLength(0);
  });

  it("deals no cards to the table", () => {
    const state = driftTurns(newGame(2), 20);
    // The only table cards are the 20 that were drifted in Phase 1.
    expect(state.tableCards).toHaveLength(20);
  });

  it("still uses every one of the 40 cards exactly once", () => {
    const cardIds = cardIdsInPlay(driftTurns(newGame(2), 20));
    expect(new Set(cardIds)).toEqual(new Set(createDeck().map((c) => c.id)));
  });

  it("gives the first turn of Phase 2 to the starting player", () => {
    const game = newGame(2);
    const state = driftTurns(game, 20);
    expect(state.currentPlayerId).toBe(game.startingPlayerId);
    expect(state.log.at(-1)?.message).toMatch(/^Phase 2: 10 more cards dealt to each player\./);
  });

  it("is not dealt while a player still has cards", () => {
    const state = driftTurns(newGame(2), 19);
    expect(state.phase).toBe(1);
    expect(canDealSecondPhase(state)).toBe(false);
    expect(() => dealSecondPhase(state)).toThrow();
  });

  it("never happens in 3- or 4-player games", () => {
    const threePlayers = driftTurns(newGame(3), 39);
    const fourPlayers = driftTurns(newGame(4), 40);
    for (const state of [threePlayers, fourPlayers]) {
      expect(state.phase).toBe(1);
      expect(state.status).toBe("finished");
      expect(canDealSecondPhase(state)).toBe(false);
    }
  });
});

describe("dealer and starting player", () => {
  it("picks the dealer of the first game at random", () => {
    const dealers = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      dealers.add(newGame(4, { seed }).dealerId);
    }
    expect(dealers).toEqual(new Set(["p1", "p2", "p3", "p4"]));
  });

  it("lets the player to the dealer's left start the first game", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = newGame(4, { seed });
      const dealerSeat = state.players.findIndex((p) => p.id === state.dealerId);
      expect(state.startingPlayerId).toBe(state.players[(dealerSeat + 1) % 4].id);
      expect(state.currentPlayerId).toBe(state.startingPlayerId);
    }
  });

  it("lets the previous loser be dealt first and start the next game", () => {
    const state = newGame(3, { previousLoserId: "p2", roundNumber: 2 });
    expect(state.startingPlayerId).toBe("p2");
    expect(state.currentPlayerId).toBe("p2");
    expect(state.previousLoserId).toBe("p2");
    expect(state.roundNumber).toBe(2);
    // The dealer sits to the loser's right, so the loser is dealt to first.
    expect(state.dealerId).toBe("p1");
  });

  it("wraps round the table when the previous loser is in the first seat", () => {
    const state = newGame(4, { previousLoserId: "p1" });
    expect(state.dealerId).toBe("p4");
  });

  it("rejects a previous loser who is not in the game", () => {
    expect(() => newGame(2, { previousLoserId: "p9" })).toThrow(/not one of the players/);
  });
});

describe("getDealOrder", () => {
  it("starts with the starting player and goes clockwise", () => {
    const players = makePlayers(4).map((p) => ({ ...p, hand: [] }));
    expect(getDealOrder(players, "p3")).toEqual(["p3", "p4", "p1", "p2"]);
  });
});
