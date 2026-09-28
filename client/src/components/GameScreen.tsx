import { useEffect, useState, type ReactNode } from "react";
import {
  SOUTH_AFRICAN_CASINO_RULES as RULES,
  calculateScores,
  canDrift,
  findBuild,
  getCapturableBuildIds,
  getCapturableCardIds,
  getHandSize,
  getMoveError,
  getOwnedBuild,
  getPileCards,
  getPlayer,
  getPlayerIdAfter,
  getPossibleBuildValues,
  getRaisedValue,
  getStealCardError,
  getTopCard,
  mustDrift,
  splitIntoGroups,
  type Card,
  type GameState,
  type Move,
} from "@sa-casino/engine";
import { Rules } from "../pages/Rules";
import { CapturePile } from "./CapturePile";
import { GameLog } from "./GameLog";
import { GameTable } from "./GameTable";
import { PlayerHand } from "./PlayerHand";
import { PlayerSeat } from "./PlayerSeat";

interface GameScreenProps {
  /** The game to show: the full game (local play) or one player's view of it (online). */
  state: GameState;
  /** Whose hand is shown at the bottom. Leave out to show no hand. */
  viewerId?: string;
  /** May the viewer pick cards and play right now? */
  canAct: boolean;
  /** Sends a move. Resolves to an error message, or null once it has been played. */
  onMove: (move: Move) => Promise<string | null>;
  /** Shown instead of the viewer's hand, e.g. the pass-the-device panel. */
  handCover?: ReactNode;
  /** Shown instead of the table once the game has finished. */
  results?: ReactNode;
  /** A short note under the title, e.g. "Room K7QX". */
  subtitle?: string;
  /** Shown above the table, e.g. a warning that a player has left. */
  notice?: ReactNode;
  /** Players who are away (online games). Their seats say so. */
  awayPlayerIds?: string[];
  exitLabel: string;
  onExit: () => void;
}

/** What the player has picked: a hand card, plus any table cards, builds and other players' top cards. */
interface Selection {
  handCard: Card;
  tableCardIds: string[];
  buildIds: string[];
  /** Top cards of other players' capture piles, to capture (or steal into a build). */
  pileCardIds: string[];
}

interface Action {
  label: string;
  move: Move;
}

const ACTION_BUTTON =
  "cursor-pointer rounded-lg bg-amber-400 px-6 py-2 font-bold tracking-wide text-emerald-950 shadow transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60";
/** Less eye-catching, for the other choices when several are possible, so the main one is harder to miss. */
const OTHER_ACTION_BUTTON =
  "cursor-pointer rounded-lg border-2 border-amber-400 px-6 py-2 font-bold tracking-wide text-amber-300 transition hover:bg-amber-400/10 disabled:cursor-wait disabled:opacity-60";
const HEADER_BUTTON = "cursor-pointer rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10";

/** The moves the current selection allows. The engine decides what is legal; this only asks it. */
export function getActions(state: GameState, playerId: string, selection: Selection): Action[] {
  const { handCard, tableCardIds, buildIds, pileCardIds } = selection;
  const cardId = handCard.id;
  const isLegal = (move: Move) => getMoveError(state, playerId, move) === null;
  const actions: Action[] = [];
  const onlyHandCard = tableCardIds.length === 0 && buildIds.length === 0 && pileCardIds.length === 0;

  if (onlyHandCard && canDrift(state, playerId, cardId)) {
    actions.push({ label: "DRIFT", move: { action: "DRIFT", cardId } });
  }

  if (!onlyHandCard) {
    const capture: Move = { action: "CAPTURE", cardId, tableCardIds, buildIds, pileCardIds };
    if (isLegal(capture)) {
      actions.push({ label: "CAPTURE", move: capture });
    }
  }

  // Adding to a build, or stealing a top card into it, aims at the selected build or, when no
  // build is selected, at the player's own build, so continuing your build needs no extra click.
  const ownBuild = getOwnedBuild(state, playerId);
  const target = buildIds.length === 1 ? findBuild(state, buildIds[0]) : buildIds.length === 0 ? ownBuild : undefined;
  if (target && target.ownerId === playerId) {
    if (pileCardIds.length === 0) {
      const addToBuild: Move = { action: "ADD_TO_BUILD", cardId, buildId: target.id, tableCardIds };
      if (isLegal(addToBuild)) {
        actions.push({ label: "ADD TO MY BUILD", move: addToBuild });
      }
    } else if (pileCardIds.length === 1) {
      const steal: Move = { action: "STEAL", cardId, buildId: target.id, stolenCardId: pileCardIds[0], tableCardIds };
      if (isLegal(steal)) {
        actions.push({ label: "STEAL INTO MY BUILD", move: steal });
      }
    }
  }

  // New builds. A build of the value the player already builds would just join their build,
  // which the buttons above already offer, so it isn't repeated.
  if (buildIds.length === 0 && tableCardIds.length > 0) {
    const alreadyAdding = actions.some((action) => action.move.action === "ADD_TO_BUILD" || action.move.action === "STEAL");
    for (const value of getPossibleBuildValues(state, playerId, cardId, tableCardIds, pileCardIds)) {
      if (alreadyAdding && value === ownBuild?.value) {
        continue;
      }
      const build: Move = { action: "BUILD", cardId, tableCardIds, value };
      actions.push({ label: `BUILD ${value}`, move: pileCardIds.length > 0 ? { ...build, pileCardIds } : build });
    }
  }

  // Raising another player's weak build (it has to be selected).
  if (buildIds.length === 1 && pileCardIds.length === 0 && target && target.ownerId !== playerId) {
    const raise: Move = { action: "RAISE_BUILD", cardId, buildId: target.id, tableCardIds };
    if (isLegal(raise)) {
      actions.push({ label: `RAISE TO ${getRaisedValue(state, target, handCard, tableCardIds)}`, move: raise });
    }
  }
  return actions;
}

/** A hint under the hand: what to do next, or why the selection can't be played. */
function describeSelection(state: GameState, playerId: string, selection: Selection, actions: Action[]): string {
  const { handCard, tableCardIds, buildIds, pileCardIds } = selection;
  const cardId = handCard.id;

  if (tableCardIds.length === 0 && buildIds.length === 0 && pileCardIds.length === 0) {
    const canCaptureSomething =
      getCapturableCardIds(state, handCard.value, playerId).size +
        getCapturableBuildIds(state, handCard.value).size >
      0;
    const lit = canCaptureSomething ? "Cards you can capture are lit up. " : "";
    const drift = actions.length > 0 ? ", or press DRIFT" : "";
    return `${lit}Select table cards, a build or other players' top cards to capture or build with${drift}.`;
  }
  if (actions.length > 0) {
    return "Choose what to do with the selected cards.";
  }
  // Nothing is possible: explain using the rule that most likely applies.
  let attempted: Move = { action: "CAPTURE", cardId, tableCardIds, buildIds, pileCardIds };
  const selectedBuild = buildIds.length === 1 ? findBuild(state, buildIds[0]) : undefined;
  const ownBuild = getOwnedBuild(state, playerId);
  const target = selectedBuild ?? (buildIds.length === 0 ? ownBuild : undefined);
  const looseCards = state.tableCards.filter((card) => tableCardIds.includes(card.id));
  const capturable = looseCards.length === 0 || splitIntoGroups(looseCards, handCard.value) !== null;

  if (pileCardIds.length === 1 && target?.ownerId === playerId) {
    // A top card with your own build: stealing it into the build.
    attempted = { action: "STEAL", cardId, buildId: target.id, stolenCardId: pileCardIds[0], tableCardIds };
  } else if (selectedBuild && pileCardIds.length === 0 && handCard.value !== selectedBuild.value) {
    // A build of a different value: adding to your own, or raising someone else's.
    attempted =
      selectedBuild.ownerId === playerId
        ? { action: "ADD_TO_BUILD", cardId, buildId: selectedBuild.id, tableCardIds }
        : { action: "RAISE_BUILD", cardId, buildId: selectedBuild.id, tableCardIds };
  } else if (buildIds.length === 0 && tableCardIds.length > 0 && !capturable) {
    // Table cards that can't be captured with this card are meant for a build: your own build if
    // you have one, otherwise a new build of the value the chosen cards make sets of (floor 9 +
    // your 4 + their 5 → 9), or of everything added up.
    const chosenCards = [...looseCards, handCard, ...getPileCards(state, pileCardIds)];
    let buildValue = chosenCards.reduce((sum, card) => sum + card.value, 0);
    for (let value = Math.max(...chosenCards.map((card) => card.value)); value <= RULES.maxBuildValue; value++) {
      if (splitIntoGroups(chosenCards, value)) {
        buildValue = value;
        break;
      }
    }
    if (ownBuild && pileCardIds.length === 0) {
      attempted = { action: "ADD_TO_BUILD", cardId, buildId: ownBuild.id, tableCardIds };
    } else if (buildValue <= RULES.maxBuildValue) {
      attempted = { action: "BUILD", cardId, tableCardIds, value: buildValue, pileCardIds };
    }
  }
  return getMoveError(state, playerId, attempted) ?? "";
}

/**
 * The game table used by both local and online games: other players at the top, the table in
 * the middle, the viewer's hand and the action buttons at the bottom, and the log on the side.
 * It only shows the game and collects the player's choices; whoever renders it decides how
 * moves are played (in the browser, or on the server).
 */
export function GameScreen({
  state,
  viewerId,
  canAct,
  onMove,
  handCover,
  results,
  subtitle,
  notice,
  awayPlayerIds = [],
  exitLabel,
  onExit,
}: GameScreenProps) {
  const [showRules, setShowRules] = useState(false);
  const [handCardId, setHandCardId] = useState<string | null>(null);
  const [tableCardIds, setTableCardIds] = useState<string[]>([]);
  const [buildIds, setBuildIds] = useState<string[]>([]);
  const [pileCardIds, setPileCardIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Start with a clean selection once a move has been played (the log grows) or a new game starts.
  // Other updates, such as another player reconnecting online, keep the current selection.
  useEffect(() => clearSelection(), [state.log.length, state.roundNumber]);

  const currentPlayer = getPlayer(state, state.currentPlayerId);
  const viewer = viewerId ? getPlayer(state, viewerId) : undefined;
  const isFinished = state.status === "finished";
  const scores = calculateScores(state);

  // Everyone except the viewer sits at the top, in playing order.
  const firstSeatId = viewer?.id ?? currentPlayer.id;
  const seatOrder = state.players.map((_, i) => getPlayer(state, getPlayerIdAfter(state.players, firstSeatId, i)));
  const topSeats = viewer ? seatOrder.slice(1) : seatOrder;

  const ownBuild = getOwnedBuild(state, currentPlayer.id);
  const handCard = canAct ? currentPlayer.hand.find((card) => card.id === handCardId) : undefined;
  const selection: Selection | null = handCard ? { handCard, tableCardIds, buildIds, pileCardIds } : null;
  const actions = selection ? getActions(state, currentPlayer.id, selection) : [];
  const hint = selection ? describeSelection(state, currentPlayer.id, selection, actions) : "Select a card from your hand.";
  const hasExtraSelection = tableCardIds.length > 0 || buildIds.length > 0 || pileCardIds.length > 0;

  function clearSelection() {
    setHandCardId(null);
    setTableCardIds([]);
    setBuildIds([]);
    setPileCardIds([]);
    setError(null);
  }

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  async function play(move: Move) {
    setSending(true);
    const problem = await onMove(move);
    setSending(false);
    if (problem) {
      setError(problem);
    }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl content-start gap-4 px-4 py-4 lg:grid-cols-[1fr_18rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-bold text-amber-300">South African Casino</h1>
            <p className="text-xs text-emerald-100/70">
              {subtitle && `${subtitle} · `}Game {state.roundNumber} · {state.playerCount} players
              {state.playerCount === 2 && ` · Phase ${state.phase} of 2`}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowRules(true)} className={HEADER_BUTTON}>
              Rules
            </button>
            <button type="button" onClick={onExit} className={HEADER_BUTTON}>
              {exitLabel}
            </button>
          </div>
        </header>

        {notice}

        {isFinished ? (
          results
        ) : (
          <>
            <section aria-label="Other players" className="flex flex-wrap justify-center gap-2">
              {topSeats.map((player) => {
                const pile = state.capturePiles[player.id];
                const topCard = getTopCard(pile);
                return (
                  <PlayerSeat
                    key={player.id}
                    player={player}
                    handSize={getHandSize(state, player.id)}
                    isDealer={player.id === state.dealerId}
                    isTurn={player.id === currentPlayer.id}
                    isAway={awayPlayerIds.includes(player.id)}
                    points={scores[player.id].total}
                  >
                    <CapturePile
                      cards={pile}
                      topCardSelected={topCard !== undefined && pileCardIds.includes(topCard.id)}
                      onTopCardClick={
                        canAct && topCard
                          ? () => {
                              setPileCardIds((list) => toggle(list, topCard.id));
                              setError(null);
                            }
                          : undefined
                      }
                      onCoveredCardsClick={
                        canAct
                          ? () => setError(getStealCardError(state, currentPlayer.id, pile[pile.length - 2].id))
                          : undefined
                      }
                    />
                  </PlayerSeat>
                );
              })}
            </section>

            <div className="text-center" aria-live="polite">
              <p className="text-xl font-extrabold tracking-wide text-amber-300 uppercase">
                {currentPlayer.id === viewer?.id ? "Your turn" : `${currentPlayer.name}'s turn`}
              </p>
              {currentPlayer.bot && <p className="mt-1 text-sm">{currentPlayer.name} is thinking…</p>}
              {canAct && mustDrift(state, currentPlayer.id) && (
                <p className="mt-1 text-sm">No cards available to capture. You must drift.</p>
              )}
              {canAct && ownBuild && (
                <p className="mt-1 text-sm">
                  You own a build of {ownBuild.value}. Add to it or capture something
                  {canDrift(state, currentPlayer.id) ? ", or drift (Phase 2)" : ""}.
                </p>
              )}
            </div>

            <GameTable
              state={state}
              selectedCardIds={tableCardIds}
              selectedBuildIds={buildIds}
              capturableCardIds={handCard ? getCapturableCardIds(state, handCard.value, currentPlayer.id) : new Set()}
              capturableBuildIds={handCard ? getCapturableBuildIds(state, handCard.value) : new Set()}
              onCardClick={canAct ? (id) => setTableCardIds((list) => toggle(list, id)) : undefined}
              onBuildClick={canAct ? (id) => setBuildIds((list) => toggle(list, id)) : undefined}
            />

            {handCover ??
              (viewer === undefined ? (
                <section className="rounded-xl bg-black/20 p-6 text-center text-sm text-emerald-100/80">
                  Hands stay hidden while the bots play.
                </section>
              ) : (
                <section
                  aria-label="Your hand"
                  className="flex flex-col items-center gap-3 rounded-xl bg-black/20 p-3 sm:p-4"
                >
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-emerald-100/80">
                      <span className="font-semibold text-white">{viewer.name}</span>
                      {viewer.id === state.dealerId && " (dealer)"} · {scores[viewer.id].total} pts
                    </p>
                    <CapturePile cards={state.capturePiles[viewer.id]} />
                  </div>
                  <PlayerHand
                    cards={viewer.hand}
                    selectedCardId={canAct ? handCardId : null}
                    onSelect={
                      canAct
                        ? (id) => {
                            setHandCardId((selected) => (selected === id ? null : id));
                            setError(null);
                          }
                        : undefined
                    }
                  />
                  {canAct ? (
                    <>
                      {error && (
                        <p role="alert" className="text-sm font-medium text-red-300">
                          {error}
                        </p>
                      )}
                      {actions.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2">
                          {actions.map((action, index) => (
                            <button
                              key={action.label}
                              type="button"
                              disabled={sending}
                              className={index === 0 ? ACTION_BUTTON : OTHER_ACTION_BUTTON}
                              onClick={() => void play(action.move)}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-center text-xs text-emerald-100/70">{hint}</p>
                      {hasExtraSelection && (
                        <button type="button" onClick={clearSelection} className="cursor-pointer text-xs underline">
                          Clear selection
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-xs text-emerald-100/70">Waiting for {currentPlayer.name}…</p>
                  )}
                </section>
              ))}
          </>
        )}
      </div>

      <aside className="lg:pt-12">
        <GameLog entries={state.log} />
      </aside>

      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </div>
  );
}
