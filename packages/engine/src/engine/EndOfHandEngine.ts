import type { GameState } from "../models/GameState";
import { addToCapturePile } from "./CapturePile";
import { calculateScores, getWinnerIds } from "./ScoringEngine";
import { addLogEntry, getPlayer } from "./stateHelpers";

/** "Ann", "Ann and Ben", "Ann, Ben and Cas". */
function joinNames(names: string[]): string {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * When every card has been played, the last player to make a capture takes all the cards
 * left in the centre: loose table cards and any builds. A drift never counts as a capture.
 * If nobody captured anything all game, the cards stay where they are.
 */
export function awardRemainingTableCards(state: GameState): GameState {
  const remaining = [...state.tableCards, ...state.builds.flatMap((build) => build.sets.flat())];
  if (remaining.length === 0) {
    return state;
  }
  const cardsText = remaining.length === 1 ? "the last card" : `the ${remaining.length} cards`;

  const winnerId = state.lastCapturePlayerId;
  if (!winnerId) {
    const verb = remaining.length === 1 ? "goes" : "go";
    return addLogEntry(state, `Nobody made a capture, so ${cardsText} left on the table ${verb} to no one.`);
  }

  const awarded: GameState = {
    ...state,
    tableCards: [],
    builds: [],
    capturePiles: { ...state.capturePiles, [winnerId]: addToCapturePile(state.capturePiles[winnerId], remaining) },
  };
  const name = getPlayer(state, winnerId).name;
  return addLogEntry(awarded, `${name} made the last capture, so they take ${cardsText} left on the table.`, winnerId);
}

/**
 * Ends the game once all the cards have been played: gives the leftover cards to the last
 * capturer, then logs the final score and the winner. Scores are worked out from the capture
 * piles with calculateScores, after the leftover cards have been awarded.
 */
export function finishGame(state: GameState): GameState {
  const ended = awardRemainingTableCards(addLogEntry({ ...state, status: "finished" }, "All cards have been played."));

  const scores = calculateScores(ended);
  const scoreText = ended.players.map((player) => `${player.name} ${scores[player.id].total}`).join(", ");
  const withScore = addLogEntry(ended, `Final score: ${scoreText}.`);

  const winners = getWinnerIds(withScore).map((id) => getPlayer(withScore, id).name);
  const resultText = winners.length === 1 ? `${winners[0]} wins!` : `${joinNames(winners)} tie for the win.`;
  return addLogEntry(withScore, resultText);
}
