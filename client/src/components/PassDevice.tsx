interface PassDeviceProps {
  playerName: string;
  /** What happened since this player's last turn, oldest first. */
  recentEvents: string[];
  onReady: () => void;
}

/** Shown in place of the hand between turns, so nobody sees the next player's cards. */
export function PassDevice({ playerName, recentEvents, onReady }: PassDeviceProps) {
  return (
    <section
      aria-label="Pass the device"
      className="flex flex-col items-center gap-4 rounded-xl bg-black/30 p-6 text-center"
    >
      <div>
        <p className="text-xs tracking-wider text-emerald-100/70 uppercase">Pass the device to</p>
        <p className="text-3xl font-extrabold text-amber-300">{playerName}</p>
      </div>
      {recentEvents.length > 0 && (
        <div className="w-full max-w-md rounded-lg bg-white/5 p-3 text-left text-sm">
          <p className="mb-1 text-xs font-semibold tracking-wider text-emerald-100/70 uppercase">
            Since your last turn
          </p>
          <ul className="space-y-1">
            {recentEvents.map((event, i) => (
              <li key={i}>{event}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        autoFocus
        onClick={onReady}
        className="cursor-pointer rounded-lg bg-amber-400 px-6 py-2 font-bold text-emerald-950 shadow transition hover:bg-amber-300"
      >
        I'm {playerName}, show my cards
      </button>
    </section>
  );
}
