import { describe, expect, it } from "vitest";
import { IllegalMoveError, getLegalMoves } from "@sa-casino/engine";
import { RoomError, RoomManager } from "../src/RoomManager";

/** A room with Ann (host, p1) and Ben (p2). */
function roomWithTwoPeople() {
  const rooms = new RoomManager();
  const { room, seat: host } = rooms.createRoom("Ann");
  const guest = rooms.join(room, "Ben");
  return { rooms, room, host, guest };
}

/** Plays the first legal move for whoever's turn it is until the game ends. */
function playToTheEnd(rooms: RoomManager, room: ReturnType<typeof roomWithTwoPeople>["room"]) {
  while (room.game!.status === "playing") {
    const current = room.game!.currentPlayerId;
    rooms.playMove(room, current, getLegalMoves(room.game!, current)[0]);
  }
}

describe("creating and joining rooms", () => {
  it("gives the room a 5-character code and puts its creator in seat p1 as host", () => {
    const rooms = new RoomManager();
    const { room, seat } = rooms.createRoom("Ann");
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(seat).toMatchObject({ playerId: "p1", name: "Ann", connected: true });
    expect(seat.token).toMatch(/^[0-9a-f]{32}$/);
    expect(rooms.getHostId(room)).toBe("p1");
  });

  it("finds a room by its code in any letter case", () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom("Ann");
    expect(rooms.getRoom(room.code.toLowerCase())).toBe(room);
    expect(() => rooms.getRoom("ZZZZZ")).toThrow(RoomError);
  });

  it("seats up to 4 players", () => {
    const { rooms, room } = roomWithTwoPeople();
    rooms.join(room, "Cas");
    rooms.join(room, "Dee");
    expect(room.seats.map((seat) => seat.playerId)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(() => rooms.join(room, "Eve")).toThrow("That room is full.");
  });

  it("gives a person their seat back with their token", () => {
    const { rooms, room, guest } = roomWithTwoPeople();
    expect(rooms.rejoin(room, guest.token)).toBe(guest);
    expect(() => rooms.rejoin(room, "not-a-token")).toThrow("Your seat in that room was not found.");
  });

  it("tidies up names", () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom("   ");
    expect(room.seats[0].name).toBe("Player 1");
    expect(rooms.join(room, "A".repeat(50)).name).toHaveLength(20);
  });

  it("never shares anyone's token", () => {
    const { rooms, room, host, guest } = roomWithTwoPeople();
    const shared = JSON.stringify(rooms.toView(room));
    expect(shared).not.toContain(host.token!);
    expect(shared).not.toContain(guest.token!);
  });
});

describe("the host", () => {
  it("is the only one who can add bots and start the game", () => {
    const { rooms, room } = roomWithTwoPeople();
    expect(() => rooms.addBot(room, "p2", "easy")).toThrow("Only the host can do that.");
    expect(() => rooms.startGame(room, "p2")).toThrow("Only the host can do that.");

    rooms.addBot(room, "p1", "hard");
    expect(room.seats[2]).toMatchObject({ playerId: "p3", name: "Hard Bot", bot: "hard", connected: true });
  });

  it("can remove other seats before the game starts, but not their own", () => {
    const { rooms, room } = roomWithTwoPeople();
    expect(() => rooms.removeSeat(room, "p1", "p1")).toThrow("You can't remove yourself.");
    rooms.removeSeat(room, "p1", "p2");
    expect(room.seats.map((seat) => seat.playerId)).toEqual(["p1"]);
  });

  it("is taken over by the next connected person while the creator is away", () => {
    const { rooms, room, host } = roomWithTwoPeople();
    host.connected = false;
    expect(rooms.getHostId(room)).toBe("p2");
    host.connected = true;
    expect(rooms.getHostId(room)).toBe("p1");
  });
});

describe("games in a room", () => {
  it("need at least 2 players", () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom("Ann");
    expect(() => rooms.startGame(room, "p1")).toThrow("You need at least 2 players to start.");
  });

  it("start with the seats in order, bots included", () => {
    const { rooms, room } = roomWithTwoPeople();
    rooms.addBot(room, "p1", "medium");
    rooms.startGame(room, "p1");

    expect(room.game?.players.map((player) => [player.id, player.name, player.bot])).toEqual([
      ["p1", "Ann", undefined],
      ["p2", "Ben", undefined],
      ["p3", "Medium Bot", "medium"],
    ]);
    expect(room.game?.players.every((player) => player.hand.length === 13)).toBe(true);
  });

  it("can't be joined once started", () => {
    const { rooms, room } = roomWithTwoPeople();
    rooms.startGame(room, "p1");
    expect(() => rooms.join(room, "Cas")).toThrow("That game has already started.");
  });

  it("accept legal moves and refuse illegal ones", () => {
    const { rooms, room } = roomWithTwoPeople();
    rooms.startGame(room, "p1");
    const game = room.game!;
    const waiting = game.players.find((player) => player.id !== game.currentPlayerId)!;

    expect(() => rooms.playMove(room, waiting.id, { action: "DRIFT", cardId: waiting.hand[0].id })).toThrow(
      IllegalMoveError,
    );
    rooms.playMove(room, game.currentPlayerId, getLegalMoves(game, game.currentPlayerId)[0]);
    expect(room.game).not.toBe(game);
  });

  it("pick who starts next when a game ends, and the host can play again", () => {
    const { rooms, room } = roomWithTwoPeople();
    rooms.startGame(room, "p1");
    expect(() => rooms.playAgain(room, "p1")).toThrow("The current game hasn't finished yet.");

    playToTheEnd(rooms, room);
    const starter = room.nextStarterId;
    expect(starter).toBeDefined();

    rooms.playAgain(room, "p1");
    expect(room.game).toMatchObject({ roundNumber: 2, status: "playing", startingPlayerId: starter });
    expect(room.nextStarterId).toBeUndefined();
  });

  it("let the host hand the seat of someone who left to a bot", () => {
    const { rooms, room, guest } = roomWithTwoPeople();
    rooms.startGame(room, "p1");
    expect(() => rooms.makeBot(room, "p1", "p2", "easy")).toThrow("Only a player who has left can be replaced by a bot.");

    guest.connected = false;
    rooms.makeBot(room, "p1", "p2", "easy");
    expect(room.game?.players[1].bot).toBe("easy");
    expect(guest).toMatchObject({ bot: "easy", connected: true, token: undefined });
  });
});

describe("leaving and closing rooms", () => {
  it("frees the seat when someone leaves before the game starts", () => {
    const { rooms, room } = roomWithTwoPeople();
    rooms.leave(room, "p2");
    expect(room.seats.map((seat) => seat.playerId)).toEqual(["p1"]);
  });

  it("keeps the seat, marked as away, when someone leaves during a game", () => {
    const { rooms, room, guest } = roomWithTwoPeople();
    rooms.startGame(room, "p1");
    rooms.leave(room, "p2");
    expect(room.seats).toHaveLength(2);
    expect(guest.connected).toBe(false);
  });

  it("closes the room once no people are left", () => {
    const { rooms, room } = roomWithTwoPeople();
    rooms.leave(room, "p2");
    rooms.leave(room, "p1");
    expect(() => rooms.getRoom(room.code)).toThrow(RoomError);
  });

  it("closes rooms nobody has used for a while", () => {
    const { rooms, room } = roomWithTwoPeople();
    rooms.removeIdleRooms(60_000, Date.now() + 120_000);
    expect(() => rooms.getRoom(room.code)).toThrow(RoomError);
  });
});
