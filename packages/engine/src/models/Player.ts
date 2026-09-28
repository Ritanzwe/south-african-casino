import type { Card } from "../cards/Card";

/** How well a computer player plays. */
export type BotLevel = "easy" | "medium" | "hard";

export interface Player {
  id: string;
  name: string;
  /** The cards the player is holding. */
  hand: Card[];
  /** Set for computer players. A player without it is a person. */
  bot?: BotLevel;
}
