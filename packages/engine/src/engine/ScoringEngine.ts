import type { Card } from "../cards/Card";
import type { GameState } from "../models/GameState";
import type { ScoreBreakdown } from "../models/Score";
import { countAces, countSpades, hasCard } from "../rules/ScoringRules";
import { SOUTH_AFRICAN_CASINO_RULES as RULES } from "../rules/SouthAfricanCasinoRules";
import { randomInt, type RandomFn } from "../utils/random";

const POINTS = RULES.scoring;

/**
 * One player's score from their capture pile. `allPiles` holds every player's capture pile,
 * because the most-cards points depend on everyone's count.
 *
 *  - most cards: 2 points, or 1 point each for players tied for the most
 *  - 5 or more spades: 1 point
 *  - the 2♠: 1 point
 *  - the 10♦: 2 points
 *  - each Ace: 1 point
 */
export function calculateScore(pile: readonly Card[], allPiles: readonly (readonly Card[])[]): ScoreBreakdown {
  const mostCards = Math.max(...allPiles.map((p) => p.length));
  const playersWithMost = allPiles.filter((p) => p.length === mostCards).length;

  let cardsMajority = 0;
  if (mostCards > 0 && pile.length === mostCards) {
    cardsMajority = playersWithMost > 1 ? POINTS.tiedMostCards : POINTS.mostCards;
  }
  const spadesBonus = countSpades(pile) >= POINTS.spadesNeededForBonus ? POINTS.fiveSpades : 0;
  const twoOfSpades = hasCard(pile, "2", "spades") ? POINTS.twoOfSpades : 0;
  const tenOfDiamonds = hasCard(pile, "10", "diamonds") ? POINTS.tenOfDiamonds : 0;
  const aces = countAces(pile) * POINTS.eachAce;

  return {
    cardsMajority,
    spadesBonus,
    twoOfSpades,
    tenOfDiamonds,
    aces,
    total: cardsMajority + spadesBonus + twoOfSpades + tenOfDiamonds + aces,
  };
}

/**
 * Every player's score, keyed by player id. At the end of a game, call this after the
 * remaining table cards have been awarded (finishGame does both in the right order).
 */
export function calculateScores(state: GameState): Record<string, ScoreBreakdown> {
  const allPiles = state.players.map((player) => state.capturePiles[player.id]);
  const scores: Record<string, ScoreBreakdown> = {};
  for (const player of state.players) {
    scores[player.id] = calculateScore(state.capturePiles[player.id], allPiles);
  }
  return scores;
}

/** The players with the most points. More than one means they tie and share the win. */
export function getWinnerIds(state: GameState): string[] {
  const scores = calculateScores(state);
  const most = Math.max(...state.players.map((player) => scores[player.id].total));
  return state.players.filter((player) => scores[player.id].total === most).map((player) => player.id);
}

/**
 * The player with the fewest points, who is dealt first and starts the next game.
 * If several players tie for the fewest, one of them is picked at random.
 */
export function getLoserId(state: GameState, random: RandomFn = Math.random): string {
  const scores = calculateScores(state);
  const fewest = Math.min(...state.players.map((player) => scores[player.id].total));
  const losers = state.players.filter((player) => scores[player.id].total === fewest);
  return losers[randomInt(losers.length, random)].id;
}
