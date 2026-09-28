import {
  createCard,
  createGame,
  createSeededRandom,
  drift,
  getPlayer,
  type Build,
  type Card,
  type CreateGameOptions,
  type GameState,
  type PlayerSetup,
  type Rank,
  type Suit,
} from "../src";

/** Shorthand for making a card: card("7", "spades"). */
export function card(rank: Rank, suit: Suit): Card {
  return createCard(rank, suit);
}

const SUIT_LETTERS: Record<string, Suit> = { H: "hearts", D: "diamonds", C: "clubs", S: "spades" };

/** Several cards from short text, e.g. cards("8S 5H 10D") → 8♠, 5♥, 10♦. */
export function cards(text: string): Card[] {
  return text
    .split(" ")
    .filter(Boolean)
    .map((token) => createCard(token.slice(0, -1) as Rank, SUIT_LETTERS[token.slice(-1)]));
}

/** The ids of some cards, e.g. to compare card lists in a readable way. */
export function ids(someCards: readonly Card[]): string[] {
  return someCards.map((c) => c.id);
}

/**
 * An exact situation to test: a game where p1 plays first, with the given hands
 * (players not listed keep their dealt cards) and these loose cards on the table.
 * e.g. scenario({ p1: "8S 2C" }, "5H 3D")
 */
export function scenario(hands: Record<string, string>, table: string, playerCount = 2): GameState {
  const game = newGame(playerCount, { previousLoserId: "p1" });
  return {
    ...game,
    players: game.players.map((p) => (hands[p.id] !== undefined ? { ...p, hand: cards(hands[p.id]) } : p)),
    tableCards: cards(table),
  };
}

/** Every card in the game: hands, table, builds, deck and capture piles. */
export function allCards(state: GameState): Card[] {
  return [
    ...state.players.flatMap((p) => p.hand),
    ...state.tableCards,
    ...state.builds.flatMap((b) => b.sets.flat()),
    ...state.deck,
    ...Object.values(state.capturePiles).flat(),
  ];
}

/** Players with ids "p1", "p2", … and names "Player 1", "Player 2", … */
export function makePlayers(count: number): PlayerSetup[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));
}

/** A new game with a fixed seed, so every test run deals the same cards. */
export function newGame(playerCount: number, options: Partial<CreateGameOptions> & { seed?: number } = {}): GameState {
  const { seed = 1, ...rest } = options;
  return createGame({ id: "test-game", players: makePlayers(playerCount), random: createSeededRandom(seed), ...rest });
}

/**
 * A build to put on the table in a test. Its id is "build-<owner>" and its value is the
 * total of the first set, e.g. makeBuild("p2", ["2S 5S"]) is p2's weak build of 7 and
 * makeBuild("p2", ["2S 5S", "6D AD"]) is a strong build of 7.
 */
export function makeBuild(ownerId: string, sets: string[]): Build {
  const cardSets = sets.map((set) => cards(set));
  const value = cardSets[0].reduce((sum, c) => sum + c.value, 0);
  return { id: `build-${ownerId}`, value, ownerId, sets: cardSets };
}

/** A weak build of 8 (5♥ + 3♣) owned by `ownerId`. */
export function buildOwnedBy(ownerId: string): Build {
  return makeBuild(ownerId, ["5H 3C"]);
}

/**
 * Replaces some capture piles. The LAST card listed is the top card,
 * e.g. withPiles(state, { p2: "10C 7D AS" }) puts A♠ on top of p2's pile.
 */
export function withPiles(state: GameState, piles: Record<string, string>): GameState {
  const capturePiles = { ...state.capturePiles };
  for (const [playerId, pile] of Object.entries(piles)) {
    capturePiles[playerId] = cards(pile);
  }
  return { ...state, capturePiles };
}

/** Replaces one player's hand, e.g. withHand(state, "p1", "8D 4C"). */
export function withHand(state: GameState, playerId: string, hand: string): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, hand: cards(hand) } : p)) };
}

/** Plays `turns` turns in a row, each time drifting the current player's first card. */
export function driftTurns(state: GameState, turns: number): GameState {
  let next = state;
  for (let i = 0; i < turns; i++) {
    const player = getPlayer(next, next.currentPlayerId);
    next = drift(next, player.id, player.hand[0].id);
  }
  return next;
}

/** Any player other than the given one. */
export function otherPlayerId(state: GameState, playerId: string): string {
  return state.players.find((player) => player.id !== playerId)!.id;
}
