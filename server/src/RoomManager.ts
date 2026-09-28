import { randomBytes, randomInt } from "node:crypto";
import {
  SOUTH_AFRICAN_CASINO_RULES as RULES,
  applyMove,
  createGame,
  getLoserId,
  type BotLevel,
  type GameState,
  type Move,
  type RandomFn,
  type RoomView,
} from "@sa-casino/engine";

/** Randomness for shuffling that nobody can predict. */
export const secureRandom: RandomFn = () => randomInt(0, 2 ** 32) / 2 ** 32;

/** A problem to show the player, e.g. "That room is full." */
export class RoomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomError";
  }
}

export interface Seat {
  playerId: string;
  name: string;
  /** Set when a bot plays this seat. */
  bot?: BotLevel;
  /** A secret that lets a person get their seat back after a refresh. People only. */
  token?: string;
  connected: boolean;
}

export interface Room {
  code: string;
  /** The person who created the room. If they're away, the next connected person acts as host. */
  hostId: string;
  /** The seats in playing order. */
  seats: Seat[];
  game?: GameState;
  /** When a game has finished: the loser, who starts the next game. */
  nextStarterId?: string;
  lastActivity: number;
}

const MIN_SEATS = Math.min(...RULES.supportedPlayers);
const MAX_SEATS = Math.max(...RULES.supportedPlayers);
/** Room codes leave out 0, O, 1 and I, which are easy to mix up. */
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const BOT_NAMES: Record<BotLevel, string> = { easy: "Easy Bot", medium: "Medium Bot", hard: "Hard Bot" };

function cleanName(name: unknown, fallback: string): string {
  const text = typeof name === "string" ? name.trim().slice(0, 20) : "";
  return text || fallback;
}

/**
 * Keeps track of every online room, in memory. All the room rules live here (who may join,
 * who is host, starting games, playing moves), so they can be tested without a network.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();

  /** Creates a room with its creator in the first seat. */
  createRoom(hostName: unknown): { room: Room; seat: Seat } {
    const seat = this.newPersonSeat("p1", cleanName(hostName, "Player 1"));
    const room: Room = { code: this.newCode(), hostId: seat.playerId, seats: [seat], lastActivity: Date.now() };
    this.rooms.set(room.code, room);
    return { room, seat };
  }

  /** The room with this code. Throws a RoomError if there isn't one. */
  getRoom(code: unknown): Room {
    const room = typeof code === "string" ? this.rooms.get(code.trim().toUpperCase()) : undefined;
    if (!room) {
      throw new RoomError("There's no room with that code. It may have closed.");
    }
    return room;
  }

  /** The room with this code, or undefined. */
  findRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /** A new person takes the next free seat. */
  join(room: Room, name: unknown): Seat {
    if (room.game) {
      throw new RoomError("That game has already started.");
    }
    const seat = this.newPersonSeat(this.freeSeatId(room), cleanName(name, `Player ${room.seats.length + 1}`));
    room.seats.push(seat);
    this.touch(room);
    return seat;
  }

  /** A person gets their seat back with the token they were given when they joined. */
  rejoin(room: Room, token: unknown): Seat {
    const seat = room.seats.find((s) => s.token !== undefined && s.token === token);
    if (!seat) {
      throw new RoomError("Your seat in that room was not found.");
    }
    return seat;
  }

  addBot(room: Room, byPlayerId: string, level: BotLevel): void {
    this.checkHost(room, byPlayerId);
    this.checkNotStarted(room);
    const playerId = this.freeSeatId(room);
    const sameLevel = room.seats.filter((seat) => seat.bot === level).length;
    const name = sameLevel === 0 ? BOT_NAMES[level] : `${BOT_NAMES[level]} ${sameLevel + 1}`;
    room.seats.push({ playerId, name, bot: level, connected: true });
    this.touch(room);
  }

  removeSeat(room: Room, byPlayerId: string, playerId: string): void {
    this.checkHost(room, byPlayerId);
    this.checkNotStarted(room);
    if (playerId === byPlayerId) {
      throw new RoomError("You can't remove yourself. Leave the room instead.");
    }
    room.seats = room.seats.filter((seat) => seat.playerId !== playerId);
    this.touch(room);
  }

  /**
   * A person leaves. Before the first game their seat is freed. During a game the seat stays
   * (the host can hand it to a bot). A room with no people left is closed.
   */
  leave(room: Room, playerId: string): void {
    if (room.game) {
      const seat = room.seats.find((s) => s.playerId === playerId);
      if (seat) seat.connected = false;
    } else {
      room.seats = room.seats.filter((seat) => seat.playerId !== playerId);
    }
    if (!room.seats.some((seat) => !seat.bot && seat.connected)) {
      this.rooms.delete(room.code);
    }
  }

  /** The host hands a seat whose person has left over to a bot, so the game can go on. */
  makeBot(room: Room, byPlayerId: string, playerId: string, level: BotLevel): void {
    this.checkHost(room, byPlayerId);
    const seat = room.seats.find((s) => s.playerId === playerId);
    if (!seat || seat.bot) {
      throw new RoomError("That seat can't be given to a bot.");
    }
    if (seat.connected) {
      throw new RoomError("Only a player who has left can be replaced by a bot.");
    }
    seat.bot = level;
    seat.token = undefined;
    seat.connected = true;
    if (room.game) {
      room.game = {
        ...room.game,
        players: room.game.players.map((player) => (player.id === playerId ? { ...player, bot: level } : player)),
      };
    }
    this.touch(room);
  }

  startGame(room: Room, byPlayerId: string): void {
    this.checkHost(room, byPlayerId);
    this.checkNotStarted(room);
    if (room.seats.length < MIN_SEATS) {
      throw new RoomError(`You need at least ${MIN_SEATS} players to start.`);
    }
    room.game = createGame({
      id: room.code,
      players: room.seats.map(({ playerId, name, bot }) => ({ id: playerId, name, bot })),
      random: secureRandom,
    });
    this.touch(room);
  }

  /** Plays a move. Throws the engine's IllegalMoveError when the move breaks the rules. */
  playMove(room: Room, playerId: string, move: Move): void {
    if (!room.game) {
      throw new RoomError("The game hasn't started yet.");
    }
    room.game = applyMove(room.game, playerId, move);
    if (room.game.status === "finished") {
      room.nextStarterId = getLoserId(room.game, secureRandom);
    }
    this.touch(room);
  }

  /** Starts the next game with the same seats. The loser of the last game starts. */
  playAgain(room: Room, byPlayerId: string): void {
    this.checkHost(room, byPlayerId);
    if (room.game?.status !== "finished" || !room.nextStarterId) {
      throw new RoomError("The current game hasn't finished yet.");
    }
    room.game = createGame({
      id: room.code,
      players: room.game.players.map(({ id, name, bot }) => ({ id, name, bot })),
      previousLoserId: room.nextStarterId,
      roundNumber: room.game.roundNumber + 1,
      random: secureRandom,
    });
    room.nextStarterId = undefined;
    this.touch(room);
  }

  /** The host: the room's creator, or the first connected person while the creator is away. */
  getHostId(room: Room): string {
    const creator = room.seats.find((seat) => seat.playerId === room.hostId);
    if (creator?.connected) {
      return creator.playerId;
    }
    return room.seats.find((seat) => !seat.bot && seat.connected)?.playerId ?? room.hostId;
  }

  /** What everyone in the room may see about it. Tokens are never shared. */
  toView(room: Room): RoomView {
    return {
      code: room.code,
      hostId: this.getHostId(room),
      seats: room.seats.map(({ playerId, name, bot, connected }) => ({ playerId, name, bot, connected })),
      started: room.game !== undefined,
      nextStarterId: room.nextStarterId,
    };
  }

  /** Closes rooms nobody has used for a while, so the server doesn't fill up. */
  removeIdleRooms(maxIdleMs: number, now = Date.now()): void {
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > maxIdleMs) {
        this.rooms.delete(code);
      }
    }
  }

  private touch(room: Room): void {
    room.lastActivity = Date.now();
  }

  private newCode(): string {
    let code = "";
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join("");
    } while (this.rooms.has(code));
    return code;
  }

  private newPersonSeat(playerId: string, name: string): Seat {
    return { playerId, name, token: randomBytes(16).toString("hex"), connected: true };
  }

  private freeSeatId(room: Room): string {
    for (let n = 1; n <= MAX_SEATS; n++) {
      const playerId = `p${n}`;
      if (!room.seats.some((seat) => seat.playerId === playerId)) {
        return playerId;
      }
    }
    throw new RoomError(`That room is full. A game has at most ${MAX_SEATS} players.`);
  }

  private checkHost(room: Room, playerId: string): void {
    if (this.getHostId(room) !== playerId) {
      throw new RoomError("Only the host can do that.");
    }
  }

  private checkNotStarted(room: Room): void {
    if (room.game) {
      throw new RoomError("The game has already started.");
    }
  }
}
