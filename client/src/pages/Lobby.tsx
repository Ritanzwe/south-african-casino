import { useState } from "react";
import { SOUTH_AFRICAN_CASINO_RULES as RULES, type BotLevel, type RoomView } from "@sa-casino/engine";

interface LobbyProps {
  room: RoomView;
  playerId: string;
  error: string | null;
  onAddBot: (level: BotLevel) => void;
  onRemoveSeat: (playerId: string) => void;
  onStart: () => void;
  onLeave: () => void;
}

const MIN_PLAYERS = Math.min(...RULES.supportedPlayers);
const MAX_PLAYERS = Math.max(...RULES.supportedPlayers);
const BADGE = "rounded bg-white/15 px-1.5 py-0.5 text-[10px] tracking-wide uppercase";

/** The room before the game starts: the invite link, who has joined, and the host's controls. */
export function Lobby({ room, playerId, error, onAddBot, onRemoveSeat, onStart, onLeave }: LobbyProps) {
  const [botLevel, setBotLevel] = useState<BotLevel>("medium");
  const [copied, setCopied] = useState(false);

  const isHost = room.hostId === playerId;
  const hostName = room.seats.find((seat) => seat.playerId === room.hostId)?.name ?? "the host";
  const inviteLink = `${window.location.origin}/room/${room.code}`;
  const canStart = room.seats.length >= MIN_PLAYERS;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <p className="text-xs tracking-wider text-emerald-100/70 uppercase">Room code</p>
        <p className="font-mono text-5xl font-bold tracking-[0.2em] text-amber-300">{room.code}</p>
      </header>

      <section className="rounded-xl bg-black/25 p-4">
        <p className="text-sm text-emerald-100/90">Send this link to the people you want to play with:</p>
        <div className="mt-2 flex gap-2">
          <input
            readOnly
            value={inviteLink}
            aria-label="Invite link"
            onFocus={(event) => event.target.select()}
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void copyLink()}
            className="cursor-pointer rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wider text-emerald-100/80 uppercase">
          Players ({room.seats.length} of {MAX_PLAYERS})
        </h2>
        <ul className="grid gap-2">
          {room.seats.map((seat) => (
            <li key={seat.playerId} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
              <span className="flex flex-wrap items-center gap-1.5">
                <span
                  aria-label={seat.connected ? "Connected" : "Away"}
                  className={`h-2 w-2 rounded-full ${seat.connected ? "bg-emerald-400" : "bg-red-400"}`}
                />
                <span className="font-semibold">{seat.name}</span>
                {seat.playerId === playerId && <span className="text-sm text-emerald-100/70">(you)</span>}
                {seat.bot && <span className={BADGE}>Bot · {seat.bot}</span>}
                {seat.playerId === room.hostId && <span className={BADGE}>Host</span>}
              </span>
              {isHost && seat.playerId !== playerId && (
                <button
                  type="button"
                  onClick={() => onRemoveSeat(seat.playerId)}
                  className="cursor-pointer text-xs text-red-200 underline hover:text-red-100"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {isHost && room.seats.length < MAX_PLAYERS && (
          <div className="mt-3 flex gap-2">
            <select
              value={botLevel}
              aria-label="Bot level"
              onChange={(event) => setBotLevel(event.target.value as BotLevel)}
              className="cursor-pointer rounded-lg border border-white/15 bg-emerald-950 px-2 py-2 text-sm"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <button
              type="button"
              onClick={() => onAddBot(botLevel)}
              className="cursor-pointer rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
            >
              Add bot
            </button>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-center text-sm font-medium text-red-300">
          {error}
        </p>
      )}

      {isHost ? (
        <div className="text-center">
          <button
            type="button"
            disabled={!canStart}
            onClick={onStart}
            className="w-full cursor-pointer rounded-xl bg-amber-400 px-6 py-3 text-lg font-bold text-emerald-950 shadow-lg transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start game
          </button>
          {!canStart && (
            <p className="mt-2 text-sm text-emerald-100/70">Waiting for someone to join. You can also add a bot.</p>
          )}
        </div>
      ) : (
        <p className="text-center text-emerald-100/80">Waiting for {hostName} to start the game…</p>
      )}

      <button type="button" onClick={onLeave} className="cursor-pointer text-sm text-emerald-100/70 underline">
        Leave room
      </button>
    </main>
  );
}
