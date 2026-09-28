import type { Card } from "../cards/Card";

/**
 * Puts captured cards on top of a capture pile. They keep the order they lay in on the table
 * (a build in the order it was built), and the capturing card goes on top of them.
 * The end of the array is the top of the pile.
 */
export function addToCapturePile(pile: readonly Card[], capturedCards: readonly Card[], capturingCard?: Card): Card[] {
  return [...pile, ...capturedCards, ...(capturingCard ? [capturingCard] : [])];
}

/** The top card of a capture pile, the only card other players can ever reach. */
export function getTopCard(pile: readonly Card[]): Card | undefined {
  return pile[pile.length - 1];
}
