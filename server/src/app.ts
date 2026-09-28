import { existsSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@sa-casino/engine";
import { RoomManager } from "./RoomManager";
import { BOT_MOVE_DELAY_MS, registerSocketHandlers, type SocketData } from "./socketHandlers";

/** Rooms nobody has used for this long are closed. */
const ROOM_IDLE_LIMIT_MS = 2 * 60 * 60 * 1000;
/** The built React app (npm run build). In production this server hands it out too. */
const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

/** Creates the game server: the web app, the Socket.IO connection and the rooms. */
export function createGameServer(options: { botDelayMs?: number } = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer);
  const rooms = new RoomManager();
  const sockets = registerSocketHandlers(io, rooms, options.botDelayMs ?? BOT_MOVE_DELAY_MS);

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    // Any other page, such as /room/K7QX, is handled by the React app.
    app.use((request, response, next) => {
      if (request.method === "GET") {
        response.sendFile(path.join(CLIENT_DIST, "index.html"));
      } else {
        next();
      }
    });
  }

  const cleanup = setInterval(() => rooms.removeIdleRooms(ROOM_IDLE_LIMIT_MS), 10 * 60 * 1000);
  cleanup.unref();

  return {
    rooms,
    /** Starts listening. Pass port 0 to use any free port. Resolves to the port in use. */
    listen(port: number): Promise<number> {
      return new Promise((resolve) => {
        httpServer.listen(port, () => resolve((httpServer.address() as AddressInfo).port));
      });
    },
    async close(): Promise<void> {
      clearInterval(cleanup);
      sockets.stop();
      await io.close();
    },
  };
}
