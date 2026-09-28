import { getDeckSize, getPlayer, type GameState } from "@sa-casino/engine";
import { Build } from "./Build";
import { Card } from "./Card";

interface GameTableProps {
  state: GameState;
  selectedCardIds: string[];
  selectedBuildIds: string[];
  /** Loose cards and builds that the selected hand card could capture. They get a glow. */
  capturableCardIds: Set<string>;
  capturableBuildIds: Set<string>;
  /** Called when a table card or build is clicked. Leave them out when nothing can be selected. */
  onCardClick?: (cardId: string) => void;
  onBuildClick?: (buildId: string) => void;
}

/** The centre of the table: builds, loose cards, and the deck while a 2-player game still has Phase 2 to come. */
export function GameTable({
  state,
  selectedCardIds,
  selectedBuildIds,
  capturableCardIds,
  capturableBuildIds,
  onCardClick,
  onBuildClick,
}: GameTableProps) {
  const cardSize = state.tableCards.length > 12 ? "sm" : "md";
  const isEmpty = state.tableCards.length === 0 && state.builds.length === 0;
  const deckSize = getDeckSize(state);

  return (
    <section
      aria-label="Table"
      className="flex min-h-44 flex-col items-center justify-center gap-4 rounded-[2rem] border-8 border-amber-950/70 bg-emerald-700 p-4 shadow-2xl"
    >
      {isEmpty && <p className="text-emerald-100/70">The table is empty.</p>}

      {state.builds.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3">
          {state.builds.map((build) => (
            <Build
              key={build.id}
              build={build}
              ownerName={getPlayer(state, build.ownerId).name}
              selected={selectedBuildIds.includes(build.id)}
              highlighted={capturableBuildIds.has(build.id)}
              onClick={onBuildClick && (() => onBuildClick(build.id))}
            />
          ))}
        </div>
      )}

      {state.tableCards.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 pt-2 sm:gap-2">
          {state.tableCards.map((card) => (
            <Card
              key={card.id}
              card={card}
              size={cardSize}
              selected={selectedCardIds.includes(card.id)}
              highlighted={capturableCardIds.has(card.id)}
              onClick={onCardClick && (() => onCardClick(card.id))}
            />
          ))}
        </div>
      )}

      {deckSize > 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-100/80">
          <Card size="sm" />
          <span>{deckSize} cards waiting for Phase 2</span>
        </div>
      )}
    </section>
  );
}
