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
  /** Play `cardId` to take loose table cards and/or builds worth the same as it. */
  | { action: "CAPTURE"; cardId: string; tableCardIds: string[]; buildIds?: string[] }
  /** Make a new build worth `value` from `cardId` and loose table cards. */
  | { action: "BUILD"; cardId: string; tableCardIds: string[]; value: number }
  /** Add new sets of the same value (`cardId` plus any loose table cards) to a build. */
  | { action: "ADD_TO_BUILD"; cardId: string; buildId: string; tableCardIds: string[] }
  /** Raise an opponent's weak build by adding `cardId` to it. */
  | { action: "RAISE_BUILD"; cardId: string; buildId: string }
  /** Take the top card of another player's capture pile and add it, `cardId` and any loose cards to a build. */
  | { action: "STEAL"; cardId: string; buildId: string; stolenCardId: string; tableCardIds: string[] };
