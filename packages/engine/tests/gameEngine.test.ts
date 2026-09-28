import { describe, expect, it } from "vitest";
import {
  IllegalMoveError,
  applyMove,
  calculateScores,
  createGame,
  createSeededRandom,
  drift,
  getLegalMoves,
  getNextPlayerId,
  getPlayer,
  isPlayersTurn,
  randomInt,
  type Move,
} from "../src";
import { allCards, driftTurns, newGame, otherPlayerId } from "./helpers";

describe("createGame", () => {
  it("starts a game that is ready to play", () => {
    const state = newGame(3);
    expect(state.status).toBe("playing");
    expect(state.playerCount).toBe(3);
    expect(state.phase).toBe(1);
    expect(state.roundNumber).toBe(1);
    expect(state.builds).toEqual([]);
    expect(state.lastCapturePlayerId).toBeUndefined();
    expect(state.previousLoserId).toBeUndefined();
  });

  it("gives every player an empty capture pile", () => {
    expect(newGame(4).capturePiles).toEqual({ p1: [], p2: [], p3: [], p4: [] });
  });

  it("starts with the starting player's turn", () => {
    const state = newGame(4);
    expect(state.currentPlayerId).toBe(state.startingPlayerId);
    expect(isPlayersTurn(state, state.startingPlayerId)).toBe(true);
  });

  it("logs the deal and who plays first", () => {
    const state = newGame(4);
    const dealer = getPlayer(state, state.dealerId);
    const starter = getPlayer(state, state.startingPlayerId);
    expect(state.log.map((entry) => entry.message)).toEqual([
      `${dealer.name} dealt 10 cards to each player. No cards were placed on the table.`,
      `${starter.name} plays first.`,
    ]);
  });

  it("logs the face-up card in a 3-player game", () => {
    const state = newGame(3);
    expect(state.log[0].message).toMatch(/dealt 13 cards to each player\. .+ was placed face up on the table\./);
  });

  it.each([0, 1, 5])("rejects a game with %i players", (count) => {
    expect(() => newGame(count)).toThrow("South African Casino needs 2, 3 or 4 players");
  });

  it("rejects two players with the same id", () => {
    const players = [
      { id: "p1", name: "Alice" },
      { id: "p1", name: "Bongani" },
    ];
    expect(() => createGame({ players })).toThrow("Every player needs a different id.");
  });

  it("deals the same game for the same seed", () => {
    expect(newGame(3, { seed: 99 })).toEqual(newGame(3, { seed: 99 }));
  });

  it("deals different cards for different seeds", () => {
    expect(newGame(3, { seed: 1 }).players[0].hand).not.toEqual(newGame(3, { seed: 2 }).players[0].hand);
  });
});

describe("turn order", () => {
  it("alternates between the players in a 2-player game", () => {
    let state = newGame(2);
    const first = state.currentPlayerId;
    const second = otherPlayerId(state, first);

    state = driftTurns(state, 1);
    expect(state.currentPlayerId).toBe(second);
    state = driftTurns(state, 1);
    expect(state.currentPlayerId).toBe(first);
  });

  it("goes clockwise round all 4 players and back to the first", () => {
    let state = newGame(4, { previousLoserId: "p1" });
    const turns = [state.currentPlayerId];
    for (let i = 0; i < 4; i++) {
      state = driftTurns(state, 1);
      turns.push(state.currentPlayerId);
    }
    expect(turns).toEqual(["p1", "p2", "p3", "p4", "p1"]);
  });

  it("wraps from the last seat back to the first", () => {
    const state = newGame(3);
    expect(getNextPlayerId(state, "p3")).toBe("p1");
  });

  it("only lets the current player act", () => {
    const state = newGame(3, { previousLoserId: "p2" });
    expect(isPlayersTurn(state, "p2")).toBe(true);
    expect(isPlayersTurn(state, "p1")).toBe(false);
    expect(isPlayersTurn(state, "p3")).toBe(false);
  });
});

describe("playing a whole game by drifting", () => {
  it.each([
    [2, 40],
    [3, 39],
    [4, 40],
  ])("finishes a %i-player game after %i drifts", (count, drifts) => {
    const almostDone = driftTurns(newGame(count), drifts - 1);
    expect(almostDone.status).toBe("playing");

    const finished = driftTurns(almostDone, 1);
    expect(finished.status).toBe("finished");
    expect(finished.tableCards).toHaveLength(40);
    expect(finished.players.every((player) => player.hand.length === 0)).toBe(true);
    expect(finished.log.map((entry) => entry.message)).toContain("All cards have been played.");
  });
});

describe("playing whole games with random legal moves", () => {
  it.each([2, 3, 4])("never loses or duplicates a card, and finishes (%i players)", (count) => {
    for (let seed = 1; seed <= 25; seed++) {
      const pickMove = createSeededRandom(seed * 7919);
      let state = newGame(count, { seed });

      while (state.status === "playing") {
        const moves = getLegalMoves(state, state.currentPlayerId);
        expect(moves.length).toBeGreaterThan(0);
        state = applyMove(state, state.currentPlayerId, moves[randomInt(moves.length, pickMove)]);

        const everyCard = allCards(state).map((c) => c.id);
        expect(everyCard).toHaveLength(40);
        expect(new Set(everyCard).size).toBe(40);

        // Every build adds up, its owner can still capture it, and nobody owns two builds.
        for (const build of state.builds) {
          for (const set of build.sets) {
            expect(set.reduce((sum, c) => sum + c.value, 0)).toBe(build.value);
          }
          expect(getPlayer(state, build.ownerId).hand.some((c) => c.value === build.value)).toBe(true);
        }
        expect(new Set(state.builds.map((build) => build.ownerId)).size).toBe(state.builds.length);
      }

      expect(state.players.every((player) => player.hand.length === 0)).toBe(true);
      expect(state.deck).toEqual([]);
      // Owners always keep a card for their build, so every build is captured before the cards run out.
      expect(state.builds).toEqual([]);

      // Once anyone has captured, every card ends in a capture pile, so all the special cards score.
      if (state.lastCapturePlayerId) {
        expect(state.tableCards).toEqual([]);
        const scores = Object.values(calculateScores(state));
        expect(scores.reduce((sum, score) => sum + score.aces, 0)).toBe(4);
        expect(scores.reduce((sum, score) => sum + score.twoOfSpades, 0)).toBe(1);
        expect(scores.reduce((sum, score) => sum + score.tenOfDiamonds, 0)).toBe(2);
      }
    }
  });
});

describe("getLegalMoves", () => {
  it("offers the current player one DRIFT move for each card in their hand", () => {
    const state = newGame(2);
    const hand = getPlayer(state, state.currentPlayerId).hand;
    expect(getLegalMoves(state, state.currentPlayerId)).toEqual(
      hand.map((card) => ({ action: "DRIFT", cardId: card.id })),
    );
  });

  it("offers nothing to a player whose turn it is not", () => {
    const state = newGame(2);
    expect(getLegalMoves(state, otherPlayerId(state, state.currentPlayerId))).toEqual([]);
  });

  it("offers nothing once the game is finished", () => {
    const finished = driftTurns(newGame(2), 40);
    for (const player of finished.players) {
      expect(getLegalMoves(finished, player.id)).toEqual([]);
    }
  });
});

describe("applyMove", () => {
  it("plays a DRIFT move", () => {
    const state = newGame(2);
    const cardId = getPlayer(state, state.currentPlayerId).hand[0].id;
    const move: Move = { action: "DRIFT", cardId };
    expect(applyMove(state, state.currentPlayerId, move)).toEqual(drift(state, state.currentPlayerId, cardId));
  });

  it("rejects an illegal move with an IllegalMoveError", () => {
    const state = newGame(2);
    const waitingPlayerId = otherPlayerId(state, state.currentPlayerId);
    const move: Move = { action: "DRIFT", cardId: getPlayer(state, waitingPlayerId).hand[0].id };
    expect(() => applyMove(state, waitingPlayerId, move)).toThrow(IllegalMoveError);
  });

  it("rejects an unknown action", () => {
    const state = newGame(2);
    const unknownMove = { action: "CHEAT", cardId: "A-spades" } as unknown as Move;
    expect(() => applyMove(state, state.currentPlayerId, unknownMove)).toThrow('Unknown action "CHEAT".');
  });
});
