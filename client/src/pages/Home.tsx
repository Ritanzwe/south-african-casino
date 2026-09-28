import { useState, type FormEvent } from "react";
import { SOUTH_AFRICAN_CASINO_RULES as RULES, type BotLevel, type PlayerCount } from "@sa-casino/engine";
import type { SeatSetup } from "../services/gameService";
import { loadName, saveName, saveRoomToken } from "../services/onlineSession";
import { connectToServer } from "../services/socketService";
import { Rules } from "./Rules";

export interface GameSetup {
  seats: SeatSetup[];
  /** Hide each person's hand until they say they have the device (pass-and-play). */
  hideHands: boolean;
}

interface HomeProps {
  onStartLocal: (setup: GameSetup) => void;
  /** Opens an online room, e.g. after creating it or typing its code. */
  onEnterRoom: (code: string) => void;
}

type SeatKind = "person" | BotLevel;

const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];
const DEFAULT_KINDS: SeatKind[] = ["person", "medium", "medium", "medium"];

const SEAT_KINDS: { kind: SeatKind; label: string }[] = [
  { kind: "person", label: "Person" },
  { kind: "easy", label: "Bot · Easy" },
  { kind: "medium", label: "Bot · Medium" },
  { kind: "hard", label: "Bot · Hard" },
];

const SECTION_TITLE = "mb-3 text-sm font-semibold tracking-wider text-emerald-100/80 uppercase";
const INPUT =
  "min-w-0 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-white focus:border-amber-300 focus:outline-none";
const SMALL_BUTTON =
  "cursor-pointer rounded-lg border border-white/20 px-4 py-2 font-semibold hover:bg-white/10 disabled:cursor-wait disabled:opacity-50";

/** A one-line summary of how the cards are dealt, taken from the rule configuration. */
function describeDeal(count: PlayerCount): string {
  const cards = RULES.cardsPerPlayer[count];
  const faceUp = RULES.faceUpCards[count];
  const hands =
    count === 2 && RULES.secondDealForTwoPlayers ? `${cards} cards each, then ${cards} more` : `${cards} cards each`;
  const table = faceUp === 0 ? "no table cards" : `${faceUp} card face up`;
  return `${hands} · ${table}`;
}

/** The start screen: play online with other people, or on this device against bots or friends. */
export function Home({ onStartLocal, onEnterRoom }: HomeProps) {
  const [showRules, setShowRules] = useState(false);

  // Online
  const [onlineName, setOnlineName] = useState(loadName);
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  // On this device
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [kinds, setKinds] = useState(DEFAULT_KINDS);
  const [hideHands, setHideHands] = useState(true);

  const peopleCount = kinds.slice(0, playerCount).filter((kind) => kind === "person").length;

  function updateSeat<T>(list: T[], index: number, value: T): T[] {
    return list.map((old, i) => (i === index ? value : old));
  }

  async function createRoom() {
    const name = onlineName.trim();
    if (!name) {
      setOnlineError("Type your name first.");
      return;
    }
    saveName(name);
    setCreating(true);
    setOnlineError(null);
    const socket = connectToServer();
    try {
      const reply = await socket.timeout(8000).emitWithAck("room:create", { name });
      if (reply.ok) {
        saveRoomToken(reply.code, reply.token);
        onEnterRoom(reply.code);
      } else {
        setOnlineError(reply.error);
      }
    } catch {
      setOnlineError("Can't reach the game server. Is it running?");
    } finally {
      socket.disconnect();
      setCreating(false);
    }
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setOnlineError("Type the room code you were given.");
      return;
    }
    if (onlineName.trim()) {
      saveName(onlineName.trim());
    }
    onEnterRoom(code);
  }

  function startLocal() {
    const seats = names.slice(0, playerCount).map((name, i) => {
      const kind = kinds[i];
      return { name: name.trim() || DEFAULT_NAMES[i], bot: kind === "person" ? undefined : kind };
    });
    onStartLocal({ seats, hideHands });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-4 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-amber-300 sm:text-5xl">South African Casino</h1>
        <p className="mt-2 text-emerald-100/80">Play with friends online, or against bots on this device</p>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          className="mt-3 cursor-pointer text-sm text-amber-200 underline hover:text-amber-100"
        >
          How to play
        </button>
      </header>

      <section className="rounded-2xl bg-black/20 p-4 sm:p-6">
        <h2 className={SECTION_TITLE}>Play online</h2>
        <div className="grid gap-3">
          <input
            value={onlineName}
            maxLength={20}
            placeholder="Your name"
            aria-label="Your name"
            onChange={(event) => setOnlineName(event.target.value)}
            className={INPUT}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={creating}
              onClick={() => void createRoom()}
              className="cursor-pointer rounded-lg bg-amber-400 px-5 py-2 font-bold text-emerald-950 shadow transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create a room"}
            </button>
            <form onSubmit={joinRoom} className="flex min-w-0 flex-1 gap-2">
              <input
                value={roomCode}
                maxLength={8}
                placeholder="Room code"
                aria-label="Room code"
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                className={`${INPUT} flex-1 font-mono tracking-widest uppercase`}
              />
              <button type="submit" className={SMALL_BUTTON}>
                Join
              </button>
            </form>
          </div>
          {onlineError && (
            <p role="alert" className="text-sm font-medium text-red-300">
              {onlineError}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6">
        <h2 className={`${SECTION_TITLE} mb-0`}>Play on this device</h2>

        <div className="grid gap-3 sm:grid-cols-3">
          {RULES.supportedPlayers.map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={count === playerCount}
              onClick={() => setPlayerCount(count)}
              className={`cursor-pointer rounded-xl border-2 p-4 text-left transition ${
                count === playerCount ? "border-amber-300 bg-amber-300/10" : "border-white/15 hover:border-white/40"
              }`}
            >
              <span className="block text-2xl font-bold">{count} players</span>
              <span className="mt-1 block text-sm text-emerald-100/75">{describeDeal(count)}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          {names.slice(0, playerCount).map((name, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={name}
                maxLength={20}
                aria-label={`Name of player ${i + 1}`}
                onChange={(event) => setNames((current) => updateSeat(current, i, event.target.value))}
                className={`${INPUT} flex-1`}
              />
              <select
                value={kinds[i]}
                aria-label={`Who plays as player ${i + 1}`}
                onChange={(event) => setKinds((current) => updateSeat(current, i, event.target.value as SeatKind))}
                className="cursor-pointer rounded-lg border border-white/15 bg-emerald-950 px-2 py-2 text-white focus:border-amber-300 focus:outline-none"
              >
                {SEAT_KINDS.map(({ kind, label }) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {peopleCount > 1 && (
            <label className="mt-2 flex cursor-pointer items-start gap-3 text-sm text-emerald-100/90">
              <input
                type="checkbox"
                checked={hideHands}
                onChange={(event) => setHideHands(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-400"
              />
              <span>
                Hide each person's cards until they have the device
                <span className="block text-xs text-emerald-100/60">Turn this off to play every seat yourself.</span>
              </span>
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={startLocal}
          className="cursor-pointer rounded-xl bg-amber-400 px-6 py-3 text-lg font-bold text-emerald-950 shadow-lg transition hover:bg-amber-300"
        >
          Deal cards
        </button>
      </section>

      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </main>
  );
}
