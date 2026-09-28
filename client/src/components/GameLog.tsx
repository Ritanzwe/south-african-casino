import type { GameLogEntry } from "@sa-casino/engine";

interface GameLogProps {
  entries: GameLogEntry[];
}

/** The game activity log, newest entry first. */
export function GameLog({ entries }: GameLogProps) {
  return (
    <section aria-label="Game log" className="rounded-xl bg-black/25 p-3">
      <h2 className="mb-2 text-xs font-semibold tracking-wider text-amber-200 uppercase">Game log</h2>
      <ol className="max-h-72 space-y-1 overflow-y-auto text-sm text-emerald-50/90">
        {[...entries].reverse().map((entry) => (
          <li key={entry.id}>{entry.message}</li>
        ))}
      </ol>
    </section>
  );
}
