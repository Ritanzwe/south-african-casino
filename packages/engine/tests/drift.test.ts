import { describe, expect, it } from "vitest";
import { IllegalMoveError, canDrift, drift, formatCard, getPlayer, isTableEmpty, mustDrift } from "../src";
import { buildOwnedBy, driftTurns, newGame, otherPlayerId, withHand } from "./helpers";

const OWN_BUILD_MESSAGE = "You own a build, so you can't drift. Add to your build or capture something.";

describe("drifting with no cards on the table", () => {
  it.each([2, 4])("is the only option on the first turn of a %i-player game", (count) => {
    const state = newGame(count);
    expect(state.tableCards).toHaveLength(0);
    expect(isTableEmpty(state)).toBe(true);
    expect(mustDrift(state, state.currentPlayerId)).toBe(true);
  });

  it("is not forced on the first turn of a 3-player game, because a card starts face up", () => {
    const state = newGame(3);
    expect(mustDrift(state, state.currentPlayerId)).toBe(false);
    expect(canDrift(state, state.currentPlayerId)).toBe(true);
  });

  it("moves the card from the player's hand to the table", () => {
    const state = newGame(2);
    const playerId = state.currentPlayerId;
    const cardToDrift = getPlayer(state, playerId).hand[0];

    const next = drift(state, playerId, cardToDrift.id);

    expect(getPlayer(next, playerId).hand).toHaveLength(9);
    expect(getPlayer(next, playerId).hand).not.toContainEqual(cardToDrift);
    expect(next.tableCards).toEqual([cardToDrift]);
  });

  it("passes the turn to the next player", () => {
    const state = newGame(2);
    const next = drift(state, state.currentPlayerId, getPlayer(state, state.currentPlayerId).hand[0].id);
    expect(next.currentPlayerId).toBe(otherPlayerId(state, state.currentPlayerId));
  });

  it("writes the drift to the game log", () => {
    const state = newGame(2);
    const player = getPlayer(state, state.currentPlayerId);
    const cardToDrift = player.hand[0];

    const next = drift(state, player.id, cardToDrift.id);

    expect(next.log.at(-1)).toEqual({
      id: state.log.length + 1,
      message: `${player.name} drifted ${formatCard(cardToDrift)}.`,
      playerId: player.id,
    });
  });
});

describe("drifting when no build exists", () => {
  it("is allowed when there are loose cards on the table", () => {
    const state = driftTurns(newGame(4), 3);
    expect(state.tableCards).toHaveLength(3);
    expect(state.builds).toHaveLength(0);
    expect(canDrift(state, state.currentPlayerId)).toBe(true);
    expect(mustDrift(state, state.currentPlayerId)).toBe(false);
  });
});

describe("drifting while owning a build", () => {
  it.each([3, 4])("is not allowed in a %i-player game", (count) => {
    const game = newGame(count);
    const playerId = game.currentPlayerId;
    const state = { ...game, builds: [buildOwnedBy(playerId)] };
    const cardId = getPlayer(state, playerId).hand[0].id;

    expect(canDrift(state, playerId)).toBe(false);
    expect(() => drift(state, playerId, cardId)).toThrow(IllegalMoveError);
    expect(() => drift(state, playerId, cardId)).toThrow(OWN_BUILD_MESSAGE);
  });

  it("is not allowed in Phase 1 of a 2-player game", () => {
    const game = newGame(2);
    const playerId = game.currentPlayerId;
    const state = { ...game, builds: [buildOwnedBy(playerId)] };

    expect(state.phase).toBe(1);
    expect(canDrift(state, playerId)).toBe(false);
    expect(() => drift(state, playerId, getPlayer(state, playerId).hand[0].id)).toThrow(OWN_BUILD_MESSAGE);
  });

  it("is still allowed when the build belongs to another player", () => {
    const game = newGame(3);
    const playerId = game.currentPlayerId;
    const state = { ...game, builds: [buildOwnedBy(otherPlayerId(game, playerId))] };

    expect(canDrift(state, playerId)).toBe(true);
  });
});

describe("drifting during Phase 2 of a 2-player game", () => {
  it("is allowed even while the player owns a build", () => {
    const phase2 = driftTurns(newGame(2), 20);
    const playerId = phase2.currentPlayerId;
    const state = { ...withHand(phase2, playerId, "8D 4C"), builds: [buildOwnedBy(playerId)] };

    expect(state.phase).toBe(2);
    expect(canDrift(state, playerId, "4-clubs")).toBe(true);

    const next = drift(state, playerId, "4-clubs");
    expect(next.tableCards).toHaveLength(21);
  });

  it("still won't let the owner drift the last card they need to capture their build", () => {
    const phase2 = driftTurns(newGame(2), 20);
    const playerId = phase2.currentPlayerId;
    const state = { ...withHand(phase2, playerId, "8D 4C"), builds: [buildOwnedBy(playerId)] };

    expect(canDrift(state, playerId, "8-diamonds")).toBe(false);
    expect(() => drift(state, playerId, "8-diamonds")).toThrow("You must keep an 8 in your hand to capture your build.");
  });

  it("still requires it to be the player's turn", () => {
    const phase2 = driftTurns(newGame(2), 20);
    const waitingPlayerId = otherPlayerId(phase2, phase2.currentPlayerId);
    expect(canDrift(phase2, waitingPlayerId)).toBe(false);
  });
});

describe("drift validation", () => {
  it("rejects a drift when it is not the player's turn", () => {
    const state = newGame(2);
    const waitingPlayerId = otherPlayerId(state, state.currentPlayerId);
    const cardId = getPlayer(state, waitingPlayerId).hand[0].id;

    expect(canDrift(state, waitingPlayerId)).toBe(false);
    expect(() => drift(state, waitingPlayerId, cardId)).toThrow("It's not your turn.");
  });

  it("rejects a card that is not in the player's hand", () => {
    const state = newGame(2);
    const opponentsCard = getPlayer(state, otherPlayerId(state, state.currentPlayerId)).hand[0];
    expect(() => drift(state, state.currentPlayerId, opponentsCard.id)).toThrow("That card is not in your hand.");
  });

  it("rejects a player who is not in the game", () => {
    const state = newGame(2);
    expect(canDrift(state, "nobody")).toBe(false);
    expect(() => drift(state, "nobody", "7-spades")).toThrow("That player is not in this game.");
  });

  it("rejects moves once the game is finished", () => {
    const finished = driftTurns(newGame(4), 40);
    expect(finished.status).toBe("finished");
    for (const player of finished.players) {
      expect(canDrift(finished, player.id)).toBe(false);
    }
    expect(() => drift(finished, finished.currentPlayerId, "7-spades")).toThrow("The game is not in progress.");
  });

  it("does not count as a capture", () => {
    const state = driftTurns(newGame(3), 5);
    expect(state.lastCapturePlayerId).toBeUndefined();
    for (const pile of Object.values(state.capturePiles)) {
      expect(pile).toEqual([]);
    }
  });

  it("leaves the original state unchanged", () => {
    const state = newGame(2);
    const snapshot = JSON.parse(JSON.stringify(state));
    drift(state, state.currentPlayerId, getPlayer(state, state.currentPlayerId).hand[0].id);
    expect(state).toEqual(snapshot);
  });
});
