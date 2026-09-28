import { SUIT_SYMBOLS, type Card as CardData } from "@sa-casino/engine";

interface CardProps {
  /** The card to show. Leave it out to show the back of a card. */
  card?: CardData;
  selected?: boolean;
  /** Draws a glow round the card, e.g. to show it can be captured. */
  highlighted?: boolean;
  /** Makes the card clickable. */
  onClick?: () => void;
  size?: "sm" | "md";
}

const CARD_SIZES = {
  sm: "h-14 w-10 text-xs",
  md: "h-20 w-14 text-sm sm:h-24 sm:w-16 sm:text-base",
};

const SYMBOL_SIZES = {
  sm: "text-base",
  md: "text-2xl sm:text-3xl",
};

export function Card({ card, selected = false, highlighted = false, onClick, size = "md" }: CardProps) {
  if (!card) {
    return (
      <div
        role="img"
        aria-label="Face-down card"
        className={`${CARD_SIZES[size]} rounded-lg border-2 border-white bg-rose-800 shadow-md ring-4 ring-rose-950/40 ring-inset`}
      />
    );
  }

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const label = `${card.rank === "A" ? "Ace" : card.rank} of ${card.suit}`;
  const stateClasses = selected
    ? "-translate-y-2 ring-4 ring-amber-400"
    : highlighted
      ? "ring-4 ring-sky-300/80"
      : "";
  const faceClasses = `${CARD_SIZES[size]} ${stateClasses} flex flex-col items-center justify-between rounded-lg border border-slate-300 bg-white p-1 shadow-md ${isRed ? "text-red-600" : "text-slate-900"}`;
  const face = (
    <>
      <span className="self-start leading-none font-bold">{card.rank}</span>
      <span className={`${SYMBOL_SIZES[size]} leading-none`}>{SUIT_SYMBOLS[card.suit]}</span>
      <span className="rotate-180 self-end leading-none font-bold">{card.rank}</span>
    </>
  );

  if (!onClick) {
    return (
      <div role="img" aria-label={label} className={faceClasses}>
        {face}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={`${faceClasses} cursor-pointer transition focus-visible:ring-4 focus-visible:ring-sky-400 focus-visible:outline-none ${
        selected ? "" : "hover:-translate-y-1"
      }`}
    >
      {face}
    </button>
  );
}
