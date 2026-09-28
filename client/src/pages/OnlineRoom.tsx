import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { PlayerView, Reply, RoomView, SeatView } from "@sa-casino/engine";
import { GameScreen } from "../components/GameScreen";
import { forgetRoomToken, loadName, loadRoomToken, saveName, saveRoomToken } from "../services/onlineSession";
import { ask, connectToServer, type GameSocket } from "../services/socketService";
import { Lobby } from "./Lobby";
import { Results } from "./Results";

interface OnlineRoomProps {
  code: string;
  onLeave: () => void;
}

type Status = "connecting" | "needName" | "joined" | "failed";

/** A simple centred message page, used while connecting and for problems. */
function Message({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {children}
    </main>
  );
}

/** Warnings shown above the table: a lost connection, and players who have left. */
function OnlineNotice(props: { connected: boolean; away: SeatView[]; isHost: boolean; onMakeBot: (id: string) => void }) {
  if (props.connected && props.away.length === 0) {
    return null;
  }
  return (
    <section className="rounded-xl bg-red-500/20 px-4 py-3 text-sm">
      {!props.connected && <p>Connection lost. Reconnecting…</p>}
      {props.away.map((seat) => (
        <p key={seat.playerId} className="flex flex-wrap items-center gap-2">
          {seat.name} has left the game.
          {props.isHost && (
            <button type="button" onClick={() => props.onMakeBot(seat.playerId)} className="cursor-pointer underline">
              Let a bot play for {seat.name}
            </button>
          )}
        </p>
      ))}
    </section>
  );
}

/**
 * An online room. It connects to the game server, takes a seat (or gets its seat back after a
 * refresh), then shows the lobby and the game. The server runs the game and checks every move;
 * this page only shows what the server sends and passes on the player's moves.
 */
export function OnlineRoom({ code, onLeave }: OnlineRoomProps) {
  const socketRef = useRef<GameSocket | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [game, setGame] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(loadName);

  /** Takes a seat: with this browser's saved token for the room if it has one, otherwise with a name. */
  async function join(socket: GameSocket, name = loadName()): Promise<void> {
    const token = loadRoomToken(code);
    if (!token && !name) {
      setStatus("needName");
      return;
    }
    try {
      const reply = await socket
        .timeout(8000)
        .emitWithAck("room:join", token ? { code, token } : { code, name });
      if (reply.ok) {
        saveRoomToken(code, reply.token);
        setPlayerId(reply.playerId);
        setStatus("joined");
        setError(null);
      } else if (token) {
        // The saved seat has gone (for example the server restarted), so join as someone new.
        forgetRoomToken(code);
        await join(socket, name);
      } else {
        setError(reply.error);
        setStatus("failed");
      }
    } catch {
      setError("The game server didn't answer. Check your connection and try again.");
      setStatus("failed");
    }
  }

  useEffect(() => {
    const socket = connectToServer();
    socketRef.current = socket;
    // Join every time the connection is made, including after a dropped connection comes back.
    socket.on("connect", () => {
      setConnected(true);
      void join(socket);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("room:update", setRoom);
    socket.on("game:update", setGame);
    return () => {
      socket.disconnect();
    };
  }, [code]);

  /** Sends a request to the server and shows its error, if any. */
  async function send(request: (socket: ReturnType<GameSocket["timeout"]>) => Promise<Reply>): Promise<string | null> {
    const socket = socketRef.current;
    if (!socket) {
      return "You're not connected to the game server.";
    }
    const problem = await ask(socket, request);
    setError(problem);
    return problem;
  }

  async function leave() {
    await send((s) => s.emitWithAck("room:leave", {}));
    forgetRoomToken(code);
    onLeave();
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    const name = nameInput.trim();
    if (!name || !socketRef.current) {
      return;
    }
    saveName(name);
    setStatus("connecting");
    void join(socketRef.current, name);
  }

  if (status === "needName") {
    return (
      <Message>
        <h1 className="text-2xl font-bold text-amber-300">Join room {code}</h1>
        <form onSubmit={submitName} className="flex w-full gap-2">
          <input
            autoFocus
            value={nameInput}
            maxLength={20}
            placeholder="Your name"
            aria-label="Your name"
            onChange={(event) => setNameInput(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/20 px-3 py-2 focus:border-amber-300 focus:outline-none"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-amber-400 px-5 py-2 font-bold text-emerald-950 hover:bg-amber-300"
          >
            Join
          </button>
        </form>
      </Message>
    );
  }

  const backButton = (
    <button type="button" onClick={onLeave} className="cursor-pointer text-sm underline">
      Back to the start
    </button>
  );

  if (status === "failed") {
    return (
      <Message>
        <p className="text-lg font-semibold">{error}</p>
        {backButton}
      </Message>
    );
  }

  if (status === "connecting" || !room || !playerId) {
    return (
      <Message>
        <p className="text-emerald-100/80">Connecting to room {code}…</p>
        {backButton}
      </Message>
    );
  }

  if (!room.seats.some((seat) => seat.playerId === playerId)) {
    return (
      <Message>
        <p className="text-lg font-semibold">You're no longer in this room.</p>
        {backButton}
      </Message>
    );
  }

  if (!room.started || !game) {
    return (
      <Lobby
        room={room}
        playerId={playerId}
        error={error}
        onAddBot={(level) => void send((s) => s.emitWithAck("room:addBot", { level }))}
        onRemoveSeat={(id) => void send((s) => s.emitWithAck("room:removeSeat", { playerId: id }))}
        onStart={() => void send((s) => s.emitWithAck("game:start", {}))}
        onLeave={() => void leave()}
      />
    );
  }

  const isHost = room.hostId === playerId;
  const away = room.seats.filter((seat) => !seat.bot && !seat.connected);

  return (
    <GameScreen
      state={game}
      viewerId={playerId}
      canAct={connected && game.status === "playing" && game.currentPlayerId === playerId}
      onMove={(move) => send((s) => s.emitWithAck("game:move", { move }))}
      subtitle={`Room ${room.code}`}
      notice={
        <OnlineNotice
          connected={connected}
          away={away}
          isHost={isHost}
          onMakeBot={(id) => void send((s) => s.emitWithAck("room:makeBot", { playerId: id, level: "medium" }))}
        />
      }
      awayPlayerIds={away.map((seat) => seat.playerId)}
      results={
        room.nextStarterId && (
          <Results
            state={game}
            nextStarterId={room.nextStarterId}
            onPlayAgain={isHost ? () => void send((s) => s.emitWithAck("game:playAgain", {})) : undefined}
            onExit={() => void leave()}
            exitLabel="Leave room"
          />
        )
      }
      exitLabel="Leave room"
      onExit={() => void leave()}
    />
  );
}
