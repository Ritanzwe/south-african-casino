import { calculateScores, getPlayer, getWinnerIds, type GameState } from "@sa-casino/engine";
import { ScoreBoard } from "../components/ScoreBoard";

interface ResultsProps {
  state: GameState;
  /** The loser of this game, who is dealt first and starts the next one. */
  nextStarterId: string;
  /** Starts the next game. Leave out when this player can't (online, only the host can). */
  onPlayAgain?: () => void;
  onExit: () => void;
  exitLabel: string;
}

/** The end-of-game screen: everyone's total, the full score breakdown, and who starts next. */
export function Results({ state, nextStarterId, onPlayAgain, onExit, exitLabel }: ResultsProps) {
  const scores = calculateScores(state);
  const winnerIds = getWinnerIds(state);
  const ranked = [...state.players].sort((a, b) => scores[b.id].total - scores[a.id].total);
  const starterName = getPlayer(state, nextStarterId).name;

  return (
    <section aria-label="Results" className="rounded-2xl bg-black/30 p-4 sm:p-6">
      <h2 className="text-center text-2xl font-extrabold tracking-wide text-amber-300 uppercase">Game complete</h2>

      <ol className="mx-auto mt-4 grid max-w-md gap-2">
        {ranked.map((player) => (
          <li key={player.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-2">
            <span className="flex items-center gap-2 font-semibold">
              {player.name}
              {winnerIds.includes(player.id) && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-emerald-950 uppercase">
                  {winnerIds.length > 1 ? "Tied winner" : "Winner"}
                </span>
              )}
            </span>
            <span className="text-lg font-bold tabular-nums">{scores[player.id].total} POINTS</span>
          </li>
        ))}
      </ol>

      <h3 className="mt-6 mb-2 text-sm font-semibold tracking-wider text-emerald-100/80 uppercase">Score breakdown</h3>
      <ScoreBoard state={state} scores={scores} />

      <p className="mt-5 text-center text-sm text-emerald-100/80">
        {starterName} had the fewest points, so they are dealt first and start the next game.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {onPlayAgain ? (
          <button
            type="button"
            onClick={onPlayAgain}
            className="cursor-pointer rounded-lg bg-amber-400 px-6 py-2 font-bold text-emerald-950 shadow transition hover:bg-amber-300"
          >
            Play again
          </button>
        ) : (
          <p className="text-sm text-emerald-100/70">Waiting for the host to start the next game…</p>
        )}
        <button
          type="button"
          onClick={onExit}
          className="cursor-pointer rounded-lg border border-white/20 px-6 py-2 font-semibold hover:bg-white/10"
        >
          {exitLabel}
        </button>
      </div>
    </section>
  );
}
