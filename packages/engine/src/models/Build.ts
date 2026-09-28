import type { Card } from "../cards/Card";

/**
 * A build: cards on the table grouped together, to be captured later by a card of `value`.
 *
 * The cards are stored as sets, and every set adds up to `value`:
 *   - one set, e.g. [2, 5] for a 7, is a WEAK build
 *   - two or more sets, e.g. [2, 5] and [6, A], is a STRONG build
 * RULES.md explains what each kind allows.
 */
export interface Build {
  id: string;
  sets: Card[][];
  value: number;
  /** The player who controls the build. */
  ownerId: string;
}
