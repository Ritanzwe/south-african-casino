import { compareCards, type Card } from "../cards/Card";

/**
 * Puts newly captured cards on top of a capture pile, in number order with the
 * LOWEST card on top. (The end of the array is the top of the pile.)
 * The order never depends on the order the cards were selected in.
 */
export function addToCapturePile(pile: readonly Card[], captured: readonly Card[]): Card[] {
  const highestFirst = [...captured].sort((a, b) => compareCards(b, a));
  return [...pile, ...highestFirst];
}

/** The top card of a capture pile, the only card other players can ever reach. */
export function getTopCard(pile: readonly Card[]): Card | undefined {
  return pile[pile.length - 1];
}
