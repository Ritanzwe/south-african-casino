import type { Server, Socket } from "socket.io";
import {
  IllegalMoveError,
  chooseBotMove,
  getPlayer,
  getPlayerView,
  parseMove,
  type BotLevel,
  type ClientToServerEvents,
  type JoinedRoom,
  type Reply,
  type ServerToClientEvents,
} from "@sa-casino/engine";
import { RoomError, secureRandom, type Room, type RoomManager, type Seat } from "./RoomManager";

/** What the server remembers about each connection: the room and seat it belongs to. */
export interface SocketData {
  code?: string;
  playerId?: string;
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** How long bots wait before moving, so people can follow the game. */
export const BOT_MOVE_DELAY_MS = 1000;

function isBotLevel(value: unknown): value is BotLevel {
  return value === "easy" || value === "medium" || value === "hard";
}

/**
 * Handles every message a browser can send. The server is in charge: it checks each request
 * (the rules engine checks every move), changes the room, then sends each player their own view.
 */
export function registerSocketHandlers(io: GameServer, rooms: RoomManager, botDelayMs = BOT_MOVE_DELAY_MS) {
  const botTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Sends everyone in the room the room details and their own view of the game. */
  async function broadcast(room: Room): Promise<void> {
    const roomView = rooms.toView(room);
    for (const socket of await io.in(room.code).fetchSockets()) {
      socket.emit("room:update", roomView);
      if (room.game && socket.data.playerId) {
        socket.emit("game:update", getPlayerView(room.game, socket.data.playerId));
      }
    }
  }

  /** If it's a bot's turn, it plays after a short pause. */
  function scheduleBotTurn(room: Room): void {
    const game = room.game;
    if (!game || game.status !== "playing" || botTimers.has(room.code)) {
      return;
    }
    const player = getPlayer(game, game.currentPlayerId);
    const level = player.bot;
    if (!level) {
      return;
    }
    const timer = setTimeout(() => {
      botTimers.delete(room.code);
      // Only move if nothing changed while the bot was waiting.
      if (room.game === game && rooms.findRoom(room.code) === room) {
        rooms.playMove(room, player.id, chooseBotMove(game, player.id, level, secureRandom));
        void broadcast(room);
      }
      scheduleBotTurn(room);
    }, botDelayMs);
    botTimers.set(room.code, timer);
  }

  /** Something changed: tell everyone, and let a bot move if it's its turn. */
  function roomChanged(room: Room): void {
    void broadcast(room);
    scheduleBotTurn(room);
  }

  io.on("connection", (socket: GameSocket) => {
    /**
     * Runs a request and sends back the answer. Rule and room problems go back to the player
     * as a message, so nothing a browser sends can crash the server.
     */
    function answer<Details extends object>(reply: unknown, work: () => Details): void {
      if (typeof reply !== "function") {
        return;
      }
      const send = reply as (response: Reply<Details>) => void;
      try {
        send({ ok: true, ...work() });
      } catch (error) {
        if (error instanceof RoomError || error instanceof IllegalMoveError) {
          send({ ok: false, error: error.message });
        } else {
          console.error(error);
          send({ ok: false, error: "Something went wrong on the server." });
        }
      }
    }

    /** The room and seat this connection has joined. */
    function mySeat(): { room: Room; playerId: string } {
      const { code, playerId } = socket.data;
      if (!code || !playerId) {
        throw new RoomError("Join a room first.");
      }
      return { room: rooms.getRoom(code), playerId };
    }

    /** Puts this connection into a room, in the given seat. */
    function sitDown(room: Room, seat: Seat): JoinedRoom {
      if (socket.data.code && socket.data.code !== room.code) {
        void socket.leave(socket.data.code);
      }
      socket.data.code = room.code;
      socket.data.playerId = seat.playerId;
      void socket.join(room.code);
      seat.connected = true;
      roomChanged(room);
      return { code: room.code, playerId: seat.playerId, token: seat.token ?? "" };
    }

    socket.on("room:create", (request, reply) =>
      answer(reply, () => {
        const { room, seat } = rooms.createRoom(request?.name);
        return sitDown(room, seat);
      }),
    );

    socket.on("room:join", (request, reply) =>
      answer(reply, () => {
        const room = rooms.getRoom(request?.code);
        const seat = request?.token ? rooms.rejoin(room, request.token) : rooms.join(room, request?.name);
        return sitDown(room, seat);
      }),
    );

    socket.on("room:addBot", (request, reply) =>
      answer(reply, () => {
        const { room, playerId } = mySeat();
        const level = request?.level;
        if (!isBotLevel(level)) {
          throw new RoomError("Choose an easy, medium or hard bot.");
        }
        rooms.addBot(room, playerId, level);
        roomChanged(room);
        return {};
      }),
    );

    socket.on("room:removeSeat", (request, reply) =>
      answer(reply, () => {
        const { room, playerId } = mySeat();
        rooms.removeSeat(room, playerId, String(request?.playerId));
        roomChanged(room);
        return {};
      }),
    );

    socket.on("room:makeBot", (request, reply) =>
      answer(reply, () => {
        const { room, playerId } = mySeat();
        const level = request?.level;
        if (!isBotLevel(level)) {
          throw new RoomError("Choose an easy, medium or hard bot.");
        }
        rooms.makeBot(room, playerId, String(request?.playerId), level);
        roomChanged(room);
        return {};
      }),
    );

    socket.on("room:leave", (_request, reply) =>
      answer(reply, () => {
        const { room, playerId } = mySeat();
        rooms.leave(room, playerId);
        void socket.leave(room.code);
        socket.data.code = undefined;
        socket.data.playerId = undefined;
        roomChanged(room);
        return {};
      }),
    );

    socket.on("game:start", (_request, reply) =>
      answer(reply, () => {
        const { room, playerId } = mySeat();
        rooms.startGame(room, playerId);
        roomChanged(room);
        return {};
      }),
    );

    socket.on("game:move", (request, reply) =>
      answer(reply, () => {
        const { room, playerId } = mySeat();
        const move = parseMove(request?.move);
        if (!move) {
          throw new RoomError("That move wasn't understood.");
        }
        rooms.playMove(room, playerId, move);
        roomChanged(room);
        return {};
      }),
    );

    socket.on("game:playAgain", (_request, reply) =>
      answer(reply, () => {
        const { room, playerId } = mySeat();
        rooms.playAgain(room, playerId);
        roomChanged(room);
        return {};
      }),
    );

    socket.on("disconnect", () => {
      const { code, playerId } = socket.data;
      const room = code ? rooms.findRoom(code) : undefined;
      const seat = room?.seats.find((s) => s.playerId === playerId);
      if (!room || !seat || seat.bot) {
        return;
      }
      // The same person may still be connected in another tab.
      void io
        .in(room.code)
        .fetchSockets()
        .then((sockets) => {
          if (!sockets.some((s) => s.data.playerId === playerId)) {
            seat.connected = false;
            void broadcast(room);
          }
        });
    });
  });

  return {
    /** Stops any bot that is waiting to move, e.g. when the server shuts down. */
    stop(): void {
      botTimers.forEach((timer) => clearTimeout(timer));
      botTimers.clear();
    },
  };
}
