import type { ReactNode } from "react";
import type { Player } from "@sa-casino/engine";

interface PlayerSeatProps {
  player: Player;
  /** How many cards they hold (online, the cards themselves are hidden). */
  handSize: number;
  isDealer: boolean;
  /** Highlights the seat of the player whose turn it is. */
  isTurn: boolean;
  /** True when the person in this seat has lost their connection (online games). */
  isAway?: boolean;
  /** Points from the cards captured so far. */
  points: number;
  /** The player's capture pile, shown on the right. */
  children: ReactNode;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const BADGE = "rounded bg-white/15 px-1.5 py-0.5 text-[10px] tracking-wide uppercase";

/** A player at the top of the table: avatar, name, cards left, points so far and capture pile. */
export function PlayerSeat({ player, handSize, isDealer, isTurn, isAway = false, points, children }: PlayerSeatProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 ${isTurn ? "ring-2 ring-amber-300" : ""} ${
        isAway ? "opacity-60" : ""
      }`}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-400 font-bold text-emerald-950">
        {initials(player.name)}
      </div>
      <div className="text-sm leading-tight">
        <div className="flex flex-wrap items-center gap-1.5 font-semibold">
          {player.name}
          {player.bot && <span className={BADGE}>Bot · {player.bot}</span>}
          {isDealer && <span className={BADGE}>Dealer</span>}
          {isAway && <span className={`${BADGE} bg-red-500/40`}>Away</span>}
        </div>
        <div className="text-emerald-100/75">
          {handSize} in hand · {points} pts
        </div>
      </div>
      {children}
    </div>
  );
}
