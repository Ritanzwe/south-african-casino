import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, Reply, ServerToClientEvents } from "@sa-casino/engine";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** How long to wait for the server to answer before giving up. */
const ANSWER_TIMEOUT_MS = 8000;

/** Connects to the game server, which lives at the same address as this page. */
export function connectToServer(): GameSocket {
  return io();
}

/**
 * Sends a request and waits for the answer. Resolves to an error message to show,
 * or null when the server said yes.
 * e.g. await ask(socket, (s) => s.emitWithAck("game:start", {}))
 */
export async function ask(
  socket: GameSocket,
  send: (socket: ReturnType<GameSocket["timeout"]>) => Promise<Reply>,
): Promise<string | null> {
  try {
    const reply = await send(socket.timeout(ANSWER_TIMEOUT_MS));
    return reply.ok ? null : reply.error;
  } catch {
    return "The game server didn't answer. Check your connection and try again.";
  }
}
