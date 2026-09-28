/**
 * Every number that defines South African Casino lives here, so the values are
 * never scattered through the code. RULES.md describes the rules in words.
 */
export const SOUTH_AFRICAN_CASINO_RULES = {
  deckSize: 40,

  supportedPlayers: [2, 3, 4],

  /** Cards dealt to each player in each deal. */
  cardsPerPlayer: {
    2: 10,
    3: 13,
    4: 10,
  },

  /** Cards dealt face up to the table at the start of the game. */
  faceUpCards: {
    2: 0,
    3: 1,
    4: 0,
  },

  /** A 2-player game deals the other 20 cards once both players have played their first 10. */
  secondDealForTwoPlayers: true,

  /** In Phase 2 of a 2-player game, players may drift even while they own a build. */
  twoPlayerPhase2AlwaysAllowsDrift: true,

  /** The least a build can be worth: 1 is a build of Aces, each Ace a set of its own (your A on a floor A). */
  minBuildValue: 1,

  /** The most a build can be worth. */
  maxBuildValue: 10,

  scoring: {
    mostCards: 2,
    tiedMostCards: 1,
    fiveSpades: 1,
    spadesNeededForBonus: 5,
    twoOfSpades: 1,
    tenOfDiamonds: 2,
    eachAce: 1,
  },
} as const;

/** The number of players in a game: 2, 3 or 4. */
export type PlayerCount = (typeof SOUTH_AFRICAN_CASINO_RULES.supportedPlayers)[number];

export function isSupportedPlayerCount(count: number): count is PlayerCount {
  return (SOUTH_AFRICAN_CASINO_RULES.supportedPlayers as readonly number[]).includes(count);
}
