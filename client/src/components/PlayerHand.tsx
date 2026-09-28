import { compareCards, type Card as CardData } from "@sa-casino/engine";
import { Card } from "./Card";

interface PlayerHandProps {
  cards: CardData[];
  selectedCardId: string | null;
  /** Leave out when the cards can't be picked, e.g. while a bot is playing. */
  onSelect?: (cardId: string) => void;
}

/** A player's cards, sorted from lowest to highest so they are easy to read. */
export function PlayerHand({ cards, selectedCardId, onSelect }: PlayerHandProps) {
  const sorted = [...cards].sort(compareCards);

  return (
    <div className="flex flex-wrap justify-center gap-1.5 pt-3 sm:gap-2">
      {sorted.map((card) => (
        <Card
          key={card.id}
          card={card}
          selected={card.id === selectedCardId}
          onClick={onSelect && (() => onSelect(card.id))}
        />
      ))}
    </div>
  );
}
