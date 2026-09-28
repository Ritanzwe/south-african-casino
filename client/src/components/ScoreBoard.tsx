import { countSpades, type GameState, type ScoreBreakdown } from "@sa-casino/engine";

interface ScoreBoardProps {
  state: GameState;
  scores: Record<string, ScoreBreakdown>;
}

const CATEGORIES: { key: Exclude<keyof ScoreBreakdown, "total">; label: string }[] = [
  { key: "cardsMajority", label: "Most Cards" },
  { key: "spadesBonus", label: "5+ Spades" },
  { key: "twoOfSpades", label: "2 of Spades" },
  { key: "tenOfDiamonds", label: "10 of Diamonds" },
  { key: "aces", label: "Aces" },
];

/** The score breakdown: points per category for every player, with the counts behind them. */
export function ScoreBoard({ state, scores }: ScoreBoardProps) {
  const cell = "px-3 py-1.5 text-right tabular-nums";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/15 text-emerald-100/80">
            <th className="px-3 py-1.5 text-left font-semibold">Category</th>
            {state.players.map((player) => (
              <th key={player.id} className={`${cell} font-semibold`}>
                {player.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="text-emerald-100/60">
            <td className="px-3 py-1.5">Cards captured</td>
            {state.players.map((player) => (
              <td key={player.id} className={cell}>
                {state.capturePiles[player.id].length}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/15 text-emerald-100/60">
            <td className="px-3 py-1.5">Spades captured</td>
            {state.players.map((player) => (
              <td key={player.id} className={cell}>
                {countSpades(state.capturePiles[player.id])}
              </td>
            ))}
          </tr>
          {CATEGORIES.map(({ key, label }) => (
            <tr key={key}>
              <td className="px-3 py-1.5">{label}</td>
              {state.players.map((player) => (
                <td key={player.id} className={cell}>
                  {scores[player.id][key]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-white/15 font-bold text-amber-300">
            <td className="px-3 py-1.5">TOTAL</td>
            {state.players.map((player) => (
              <td key={player.id} className={cell}>
                {scores[player.id].total}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
