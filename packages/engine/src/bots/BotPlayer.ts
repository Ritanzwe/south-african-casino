import type { Card } from "../cards/Card";
import { createDeck } from "../cards/deck";
import { applyMove, getLegalMoves, getMoveError } from "../engine/GameEngine";
import { getPlayer } from "../engine/stateHelpers";
import type { GameState } from "../models/GameState";
import type { Move } from "../models/Move";
import type { BotLevel } from "../models/Player";
import { findGroupsAddingUpTo } from "../cards/groups";
import { getCapturableCardIds, getTopCardGroups } from "../rules/CaptureRules";
import { addSameValueCardsBelow, getStealableCards } from "../rules/PileRules";
import { SOUTH_AFRICAN_CASINO_RULES as RULES } from "../rules/SouthAfricanCasinoRules";
import { randomInt, type RandomFn } from "../utils/random";

const POINTS = RULES.scoring;

/** How likely a build is to end up with its current owner. */
const BUILD_KEEP_CHANCE = 0.8;
/** How much a card taken from another player's capture pile hurts them, on top of what it gives the bot. */
const STEAL_WEIGHT = 0.5;
/** How much the bot dislikes putting value on the table, where others may capture it. */
const LOOSE_CARD_PENALTY = 0.5;

/**
 * Roughly how many points a card is worth to whoever captures it: a share of the most-cards
 * bonus, a share of the five-spades bonus, plus the 2♠, the 10♦ and the Aces.
 */
export function cardWorth(card: Card): number {
  let worth = POINTS.mostCards / (RULES.deckSize / 2);
  if (card.suit === "spades") worth += POINTS.fiveSpades / POINTS.spadesNeededForBonus;
  if (card.rank === "A") worth += POINTS.eachAce;
  if (card.rank === "2" && card.suit === "spades") worth += POINTS.twoOfSpades;
  if (card.rank === "10" && card.suit === "diamonds") worth += POINTS.tenOfDiamonds;
  return worth;
}

function totalWorth(cards: readonly Card[]): number {
  return cards.reduce((sum, card) => sum + cardWorth(card), 0);
}

/**
 * Chooses a move for a computer player. It is always one of the engine's legal moves.
 *
 *  - easy: any legal move, at random.
 *  - medium: the move that gains the most right now: capturing valuable cards, building,
 *    stealing, and drifting its least valuable card when there's nothing better.
 *  - hard: like medium, but it also counts which cards it hasn't seen yet, to judge what
 *    the next player could capture after its move, and avoids leaving them easy points.
 */
export function chooseBotMove(state: GameState, botId: string, level: BotLevel, random: RandomFn = Math.random): Move {
  const legalMoves = getLegalMoves(state, botId);
  if (legalMoves.length === 0) {
    throw new Error("The bot has no legal move. Is it the bot's turn?");
  }
  if (level === "easy") {
    return legalMoves[randomInt(legalMoves.length, random)];
  }

  let bestMoves: Move[] = [];
  let bestScore = -Infinity;
  for (const move of [...legalMoves, ...biggestCaptures(state, botId)]) {
    const score = scoreMove(state, applyMove(state, botId, move), botId, level);
    if (score > bestScore + 1e-9) {
      bestMoves = [move];
      bestScore = score;
    } else if (Math.abs(score - bestScore) <= 1e-9) {
      bestMoves.push(move);
    }
  }
  return bestMoves[randomInt(bestMoves.length, random)];
}

/**
 * For each card, the capture that takes as much as it can in one go: every matching build and,
 * working from the most valuable group down, every group of loose cards that doesn't overlap,
 * then every group with other players' top cards (the same value, or a sum with more loose cards),
 * with any cards of the same value lying under those top cards.
 * (getLegalMoves lists single groups, so these bigger captures are added here.)
 */
function biggestCaptures(state: GameState, botId: string): Move[] {
  const moves: Move[] = [];
  const topCards = getStealableCards(state, botId);
  for (const card of getPlayer(state, botId).hand) {
    const taken: Card[] = [];
    const take = (groups: Card[][]) => {
      for (const group of groups.sort((a, b) => totalWorth(b) - totalWorth(a))) {
        if (group.every((c) => !taken.includes(c))) {
          taken.push(...group);
        }
      }
    };
    // Loose groups first: top cards can only come with a floor build of the value.
    take(findGroupsAddingUpTo(state.tableCards, card.value));
    take(getTopCardGroups(state, botId, card.value));
    const buildIds = state.builds.filter((build) => build.value === card.value).map((build) => build.id);
    const move: Move = {
      action: "CAPTURE",
      cardId: card.id,
      tableCardIds: taken.filter((c) => !topCards.includes(c)).map((c) => c.id),
      buildIds,
      pileCardIds: addSameValueCardsBelow(
        state,
        taken.filter((c) => topCards.includes(c)).map((c) => c.id),
        card.value,
      ),
    };
    if (taken.length + buildIds.length > 0 && getMoveError(state, botId, move) === null) {
      moves.push(move);
    }
  }
  return moves;
}

/** How good a move was for the bot, comparing the game before and after it. */
function scoreMove(before: GameState, after: GameState, botId: string, level: BotLevel): number {
  const captured = totalWorth(after.capturePiles[botId]) - totalWorth(before.capturePiles[botId]);
  const takenFromOthers = othersPileWorth(before, botId) - othersPileWorth(after, botId);
  const builds = buildOutlook(after, botId) - buildOutlook(before, botId);
  const leftOnTable = Math.max(0, totalWorth(after.tableCards) - totalWorth(before.tableCards));

  let score = captured + STEAL_WEIGHT * takenFromOthers + builds - LOOSE_CARD_PENALTY * leftOnTable;
  if (level === "hard") {
    score -= nextPlayerThreat(after, botId);
  }
  return score;
}

function othersPileWorth(state: GameState, botId: string): number {
  return state.players
    .filter((player) => player.id !== botId)
    .reduce((sum, player) => sum + totalWorth(state.capturePiles[player.id]), 0);
}

/** Builds the bot owns will probably be captured by it; other players' builds probably by them. */
function buildOutlook(state: GameState, botId: string): number {
  return state.builds.reduce((sum, build) => {
    const worth = totalWorth(build.sets.flat());
    return sum + (build.ownerId === botId ? BUILD_KEEP_CHANCE : -BUILD_KEEP_CHANCE) * worth;
  }, 0);
}

/**
 * Hard bots only: the points the next player can expect to capture after this move.
 * For each card value, it multiplies what a card of that value could take by the chance
 * that the next player holds one, judged from the cards the bot hasn't seen.
 */
function nextPlayerThreat(state: GameState, botId: string): number {
  const nextId = state.currentPlayerId;
  if (state.status !== "playing" || nextId === botId) {
    return 0;
  }
  const unseen = unseenCards(state, botId);
  const handSize = getPlayer(state, nextId).hand.length;

  // Table cards and everyone else's piles (the bot's own included): the capturable ids pick out
  // the top cards, and any cards of the same value under them.
  const reachable = [
    ...state.tableCards,
    ...state.players.filter((player) => player.id !== nextId).flatMap((player) => state.capturePiles[player.id]),
  ];
  let threat = 0;
  for (let value = 1; value <= 10; value++) {
    const capturableIds = getCapturableCardIds(state, value, nextId);
    const capturableCards = reachable.filter((card) => capturableIds.has(card.id));
    const buildCards = state.builds.filter((build) => build.value === value).flatMap((build) => build.sets.flat());
    const prize = totalWorth([...capturableCards, ...buildCards]);
    if (prize > 0) {
      threat = Math.max(threat, chanceOfHolding(unseen, value, handSize) * prize);
    }
  }
  return threat;
}

/** Cards the bot can't see: other players' hands and the deck. Everything else is face up or its own. */
function unseenCards(state: GameState, botId: string): Card[] {
  const seen = new Set(
    [
      ...getPlayer(state, botId).hand,
      ...state.tableCards,
      ...state.builds.flatMap((build) => build.sets.flat()),
      ...Object.values(state.capturePiles).flat(),
    ].map((card) => card.id),
  );
  return createDeck().filter((card) => !seen.has(card.id));
}

/** The chance that a hand of `handSize` cards, drawn from the unseen cards, holds at least one of this value. */
function chanceOfHolding(unseen: readonly Card[], value: number, handSize: number): number {
  const matching = unseen.filter((card) => card.value === value).length;
  if (matching === 0 || handSize === 0) {
    return 0;
  }
  let chanceOfNone = 1;
  for (let i = 0; i < handSize; i++) {
    chanceOfNone *= Math.max(0, unseen.length - matching - i) / (unseen.length - i);
  }
  return 1 - chanceOfNone;
}
