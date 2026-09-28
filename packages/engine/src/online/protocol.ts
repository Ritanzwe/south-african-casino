// The messages the browser and the game server send each other over Socket.IO.
// Both sides import these types, so they always agree on the shape of every message.

import type { Move } from "../models/Move";
import type { BotLevel } from "../models/Player";
import type { PlayerView } from "./PlayerView";

/** A seat in an online room, as everyone in the room sees it. */
export interface SeatView {
  playerId: string;
  name: string;
  /** Set when the seat is played by a bot. */
  bot?: BotLevel;
  /** Whether the person in this seat is connected right now. Bots are always connected. */
  connected: boolean;
}

/** What everyone in an online room sees about the room itself. */
export interface RoomView {
  code: string;
  /** The player who can add bots, start games and replace players who have left. */
  hostId: string;
  seats: SeatView[];
  /** True once the first game has started. */
  started: boolean;
  /** When a game has finished: the loser, who starts the next game. */
  nextStarterId?: string;
}

/** The server's answer to a request: `ok: true` with any extra details, or an error to show. */
export type Reply<Details = object> = ({ ok: true } & Details) | { ok: false; error: string };

/** Sent back when you create or join a room. Keep the token to get your seat back after a refresh. */
export interface JoinedRoom {
  code: string;
  playerId: string;
  token: string;
}

type Answer<Details = object> = (reply: Reply<Details>) => void;

/** Messages the browser sends to the server. Each one gets a Reply. */
export interface ClientToServerEvents {
  "room:create": (request: { name: string }, answer: Answer<JoinedRoom>) => void;
  /** Join with a name to take a new seat, or with your token to get your seat back. */
  "room:join": (request: { code: string; name?: string; token?: string }, answer: Answer<JoinedRoom>) => void;
  "room:addBot": (request: { level: BotLevel }, answer: Answer) => void;
  "room:removeSeat": (request: { playerId: string }, answer: Answer) => void;
  /** Hand a seat over to a bot, e.g. when the person in it has left. */
  "room:makeBot": (request: { playerId: string; level: BotLevel }, answer: Answer) => void;
  "room:leave": (request: Record<string, never>, answer: Answer) => void;
  "game:start": (request: Record<string, never>, answer: Answer) => void;
  "game:move": (request: { move: Move }, answer: Answer) => void;
  "game:playAgain": (request: Record<string, never>, answer: Answer) => void;
}

/** Messages the server sends to the browsers in a room. */
export interface ServerToClientEvents {
  "room:update": (room: RoomView) => void;
  /** Your view of the game: your own hand and everything face up. */
  "game:update": (game: PlayerView) => void;
}
