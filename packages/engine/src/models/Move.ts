/**
 * A move a player asks to make, e.g. { action: "DRIFT", cardId: "7-spades" }.
 *
 * This is what the UI sends (and, once online play exists, what the client sends
 * to the server). Cards and builds are referred to by id only: the engine looks up
 * the real ones itself and checks that the move is legal, so a client can never
 * invent cards.
 *
 */
export type Move =
  | { action: "DRIFT"; cardId: string }
  /**
   * Play `cardId` to take loose table cards, builds worth the same as it, and the top cards of
   * other players' capture piles (`pileCardIds`).
   */
  | { action: "CAPTURE"; cardId: string; tableCardIds: string[]; buildIds?: string[]; pileCardIds?: string[] }
  /**
   * Make a new build worth `value` from `cardId` and loose table cards, plus any other players'
   * top cards of that value (`pileCardIds`) when the floor cards already make `value`.
   */
  | { action: "BUILD"; cardId: string; tableCardIds: string[]; value: number; pileCardIds?: string[] }
  /** Add new sets of the same value (`cardId` plus any loose table cards) to a build. */
  | { action: "ADD_TO_BUILD"; cardId: string; buildId: string; tableCardIds: string[] }
  /** Raise an opponent's weak build by adding `cardId` (and any loose table cards) to it. */
  | { action: "RAISE_BUILD"; cardId: string; buildId: string; tableCardIds?: string[] }
  /** Take the top card of another player's capture pile and add it, `cardId` and any loose cards to a build. */
  | { action: "STEAL"; cardId: string; buildId: string; stolenCardId: string; tableCardIds: string[] };
