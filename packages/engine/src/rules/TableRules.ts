import type { Card } from "../cards/Card";
import type { GameState } from "../models/GameState";

/** The loose table cards with these ids, in table order. */
export function getLooseCards(state: GameState, tableCardIds: readonly string[]): Card[] {
  return state.tableCards.filter((card) => tableCardIds.includes(card.id));
}

/** Checks that the ids are all different loose cards on the table. Returns a message, or null if they are. */
export function getLooseCardsError(state: GameState, tableCardIds: readonly string[]): string | null {
  if (new Set(tableCardIds).size !== tableCardIds.length) {
    return "You chose the same table card twice.";
  }
  if (getLooseCards(state, tableCardIds).length !== tableCardIds.length) {
    return "You can only use cards that are loose on the table.";
  }
  return null;
}
