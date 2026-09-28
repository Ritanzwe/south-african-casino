/** The points one player scored in a game, by category. */
export interface ScoreBreakdown {
  cardsMajority: number;
  spadesBonus: number;
  twoOfSpades: number;
  tenOfDiamonds: number;
  aces: number;
  total: number;
}
