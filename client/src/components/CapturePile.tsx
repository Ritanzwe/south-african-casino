import { getTopCard, type Card as CardData } from "@sa-casino/engine";
import { Card } from "./Card";

interface CapturePileProps {
  cards: CardData[];
  /** Makes the top card clickable and lights it up, for stealing it. */
  onTopCardClick?: () => void;
  topCardSelected?: boolean;
  /** Called when someone clicks the cards under the top card, which can never be taken. */
  onCoveredCardsClick?: () => void;
}

/** A capture pile: how many cards it holds, and its top card (the only one anyone can reach). */
export function CapturePile({ cards, onTopCardClick, topCardSelected = false, onCoveredCardsClick }: CapturePileProps) {
  const topCard = getTopCard(cards);
  const coveredClasses = "absolute top-0 left-0 h-14 w-10 rounded-lg border border-slate-300 bg-slate-200 shadow";

  return (
    <div className="flex items-center gap-2 text-xs text-emerald-100/80">
      <div className="relative h-14 w-12 shrink-0">
        {cards.length > 1 &&
          (onCoveredCardsClick ? (
            <button
              type="button"
              aria-label="Cards under the top card"
              onClick={onCoveredCardsClick}
              className={`${coveredClasses} cursor-pointer`}
            />
          ) : (
            <div aria-hidden className={coveredClasses} />
          ))}
        <div className="absolute top-0 right-0">
          {topCard ? (
            <Card
              card={topCard}
              size="sm"
              selected={topCardSelected}
              highlighted={onTopCardClick !== undefined}
              onClick={onTopCardClick}
            />
          ) : (
            <div aria-hidden className="h-14 w-10 rounded-lg border-2 border-dashed border-white/20" />
          )}
        </div>
      </div>
      <span className="leading-tight">
        Captured
        <span className="block text-base font-semibold text-white">{cards.length}</span>
      </span>
    </div>
  );
}
