import { formatCard, type Card } from "../cards/Card";
import { createDeck, shuffleDeck } from "../cards/deck";
import { findGroupsAddingUpTo } from "../cards/groups";
import type { GameState } from "../models/GameState";
import type { Move } from "../models/Move";
import type { BotLevel, Player } from "../models/Player";
import { getAddToBuildError, getCreateBuildError, getRaiseBuildError } from "../rules/BuildRules";
import { getCaptureError } from "../rules/CaptureRules";
import { getDriftError } from "../rules/DriftRules";
import { SOUTH_AFRICAN_CASINO_RULES as RULES, isSupportedPlayerCount } from "../rules/SouthAfricanCasinoRules";
import { getStealError, getStealableCards } from "../rules/StealRules";
import { getTurnError } from "../rules/TurnRules";
import { randomInt, type RandomFn } from "../utils/random";
import { addToBuild, createBuild, raiseBuild } from "./BuildEngine";
import { captureCards } from "./CaptureEngine";
import { dealCards, getDealOrder } from "./DealEngine";
import { drift } from "./DriftEngine";
import { IllegalMoveError } from "./IllegalMoveError";
import { addLogEntry, getPlayer, getPlayerIdAfter } from "./stateHelpers";
import { stealIntoBuild } from "./StealEngine";

export interface PlayerSetup {
  id: string;
  name: string;
  /** Leave out for a person; set it to make this seat a computer player. */
  bot?: BotLevel;
}

export interface CreateGameOptions {
  /** 2, 3 or 4 players, in seating order. Play goes clockwise through this list. */
  players: PlayerSetup[];
  /** Game id. One is generated if left out. */
  id?: string;
  /**
   * Where randomness comes from when picking the dealer and shuffling. Defaults to Math.random.
   * Pass createSeededRandom(seed) to get exactly the same game every time (useful in tests).
   */
  random?: RandomFn;
  /**
   * The player who lost the previous game. They are dealt first and start this game.
   * Leave it out for the first game: the dealer is then picked at random.
   */
  previousLoserId?: string;
  /** Which game of the session this is. Defaults to 1. */
  roundNumber?: number;
}

/**
 * Starts a new game: picks the dealer and the starting player, shuffles the
 * 40-card deck and deals the right way for 2, 3 or 4 players.
 */
export function createGame(options: CreateGameOptions): GameState {
  const random = options.random ?? Math.random;
  const playerCount = options.players.length;

  if (!isSupportedPlayerCount(playerCount)) {
    throw new Error(`South African Casino needs 2, 3 or 4 players, not ${playerCount}.`);
  }
  const playerIds = new Set(options.players.map((player) => player.id));
  if (playerIds.size !== playerCount) {
    throw new Error("Every player needs a different id.");
  }
  if (options.previousLoserId !== undefined && !playerIds.has(options.previousLoserId)) {
    throw new Error(`The previous loser "${options.previousLoserId}" is not one of the players.`);
  }

  const players: Player[] = options.players.map(({ id, name, bot }) => ({ id, name, hand: [], ...(bot ? { bot } : {}) }));

  // First game: a random dealer, and the player to their left starts.
  // Later games: the previous loser starts, so the player to their right deals.
  let dealerId: string;
  let startingPlayerId: string;
  if (options.previousLoserId !== undefined) {
    startingPlayerId = options.previousLoserId;
    dealerId = getPlayerIdAfter(players, startingPlayerId, -1);
  } else {
    dealerId = players[randomInt(playerCount, random)].id;
    startingPlayerId = getPlayerIdAfter(players, dealerId, 1);
  }

  const deck = shuffleDeck(createDeck(), random);
  const dealt = dealCards(
    deck,
    getDealOrder(players, startingPlayerId),
    RULES.cardsPerPlayer[playerCount],
    RULES.faceUpCards[playerCount],
  );

  const capturePiles: Record<string, Card[]> = {};
  for (const player of players) {
    capturePiles[player.id] = [];
  }

  let state: GameState = {
    id: options.id ?? `game-${Date.now().toString(36)}`,
    players: players.map((player) => ({ ...player, hand: dealt.hands[player.id] })),
    playerCount,
    dealerId,
    startingPlayerId,
    previousLoserId: options.previousLoserId,
    currentPlayerId: startingPlayerId,
    deck: dealt.deck,
    tableCards: dealt.tableCards,
    builds: [],
    capturePiles,
    roundNumber: options.roundNumber ?? 1,
    phase: 1,
    status: "playing",
    log: [],
  };

  const tableText =
    dealt.tableCards.length > 0
      ? `${dealt.tableCards.map(formatCard).join(", ")} was placed face up on the table.`
      : "No cards were placed on the table.";
  state = addLogEntry(
    state,
    `${getPlayer(state, dealerId).name} dealt ${RULES.cardsPerPlayer[playerCount]} cards to each player. ${tableText}`,
  );
  return addLogEntry(state, `${getPlayer(state, startingPlayerId).name} plays first.`, startingPlayerId);
}

/**
 * Explains why a move isn't allowed, or returns null if it is.
 * These are exactly the checks applyMove makes before changing anything.
 */
export function getMoveError(state: GameState, playerId: string, move: Move): string | null {
  switch (move.action) {
    case "DRIFT":
      return getDriftError(state, playerId, move.cardId);
    case "CAPTURE":
      return getCaptureError(state, playerId, move.cardId, move.tableCardIds, move.buildIds, move.pileCardIds);
    case "BUILD":
      return getCreateBuildError(state, playerId, move.cardId, move.tableCardIds, move.value);
    case "ADD_TO_BUILD":
      return getAddToBuildError(state, playerId, move.cardId, move.buildId, move.tableCardIds);
    case "RAISE_BUILD":
      return getRaiseBuildError(state, playerId, move.cardId, move.buildId, move.tableCardIds);
    case "STEAL":
      return getStealError(state, playerId, move.cardId, move.buildId, move.stolenCardId, move.tableCardIds);
    default:
      return `Unknown action "${(move as { action: unknown }).action}".`;
  }
}

/**
 * The moves the player may make right now, or an empty list when it is not their turn.
 *
 * For every card in their hand it considers: drifting it; capturing each group of loose
 * cards and each build it matches; building it with each group of loose cards; adding
 * it to each build; raising each build with it; and stealing each other player's top
 * capture-pile card into each build with it. Only the legal ones are returned.
 *
 * Moves that combine several groups at once (e.g. an 8 taking 8 and 5 + 3) are also
 * legal but aren't all listed. Use getMoveError to check any move.
 */
export function getLegalMoves(state: GameState, playerId: string): Move[] {
  if (getTurnError(state, playerId)) {
    return [];
  }
  return candidateMoves(state, playerId).filter((move) => getMoveError(state, playerId, move) === null);
}

/** Possible moves for each card in the hand. Some may be illegal; getLegalMoves filters those out. */
function candidateMoves(state: GameState, playerId: string): Move[] {
  const ids = (cards: Card[]) => cards.map((card) => card.id);
  const moves: Move[] = [];
  // Other players' top capture-pile cards can be captured just like loose table cards.
  const topCards = getStealableCards(state, playerId);
  const topCardIds = new Set(ids(topCards));

  for (const card of getPlayer(state, playerId).hand) {
    moves.push({ action: "DRIFT", cardId: card.id });

    // Capture each group (of table cards and top cards), each matching build, and each build with each group.
    const capture = (group: Card[], buildIds?: string[]): Move => {
      const pileCardIds = ids(group.filter((c) => topCardIds.has(c.id)));
      return {
        action: "CAPTURE",
        cardId: card.id,
        tableCardIds: ids(group.filter((c) => !topCardIds.has(c.id))),
        ...(buildIds ? { buildIds } : {}),
        ...(pileCardIds.length > 0 ? { pileCardIds } : {}),
      };
    };
    const groups = findGroupsAddingUpTo([...state.tableCards, ...topCards], card.value);
    for (const group of groups) {
      moves.push(capture(group));
    }
    for (const build of state.builds.filter((b) => b.value === card.value)) {
      moves.push(capture([], [build.id]));
      for (const group of groups) {
        moves.push(capture(group, [build.id]));
      }
    }

    // Build: the card plus loose cards as one set (3 + 5 = 8), or paired with loose cards of its own value (2 and 2).
    for (let value = Math.max(2, card.value); value <= RULES.maxBuildValue; value++) {
      const partner = value === card.value ? value : value - card.value;
      for (const group of findGroupsAddingUpTo(state.tableCards, partner)) {
        moves.push({ action: "BUILD", cardId: card.id, tableCardIds: ids(group), value });
      }
    }

    // Add to a build (the card alone, or with loose cards to make a set), or raise it.
    for (const build of state.builds) {
      if (card.value === build.value) {
        moves.push({ action: "ADD_TO_BUILD", cardId: card.id, buildId: build.id, tableCardIds: [] });
      }
      if (card.value < build.value) {
        for (const group of findGroupsAddingUpTo(state.tableCards, build.value - card.value)) {
          moves.push({ action: "ADD_TO_BUILD", cardId: card.id, buildId: build.id, tableCardIds: ids(group) });
        }
      }
      // Raise with the card alone, or with loose cards on top of it.
      moves.push({ action: "RAISE_BUILD", cardId: card.id, buildId: build.id });
      for (let extra = 1; build.value + card.value + extra <= RULES.maxBuildValue; extra++) {
        for (const group of findGroupsAddingUpTo(state.tableCards, extra)) {
          moves.push({ action: "RAISE_BUILD", cardId: card.id, buildId: build.id, tableCardIds: ids(group) });
        }
      }

      // Steal another player's top card into the build: with this card in the same set
      // (hand 7 + stolen A = 8), or with this card as its own set (hand 8, and stolen A + loose 7).
      for (const stolen of getStealableCards(state, playerId)) {
        const steal = (tableCardIds: string[]): Move => ({
          action: "STEAL",
          cardId: card.id,
          buildId: build.id,
          stolenCardId: stolen.id,
          tableCardIds,
        });
        const stillNeeded = [build.value - card.value - stolen.value];
        if (card.value === build.value) {
          stillNeeded.push(build.value - stolen.value);
        }
        for (const needed of stillNeeded) {
          if (needed === 0) {
            moves.push(steal([]));
          }
          if (needed > 0) {
            for (const group of findGroupsAddingUpTo(state.tableCards, needed)) {
              moves.push(steal(ids(group)));
            }
          }
        }
      }
    }
  }
  return moves;
}

/**
 * Checks a move and applies it, returning the new game state (the old state is not changed).
 * Throws IllegalMoveError if the move breaks the rules.
 *
 * This is the one function the UI, and later the server, uses to play a move.
 */
export function applyMove(state: GameState, playerId: string, move: Move): GameState {
  switch (move.action) {
    case "DRIFT":
      return drift(state, playerId, move.cardId);
    case "CAPTURE":
      return captureCards(state, playerId, move.cardId, move.tableCardIds, move.buildIds, move.pileCardIds);
    case "BUILD":
      return createBuild(state, playerId, move.cardId, move.tableCardIds, move.value);
    case "ADD_TO_BUILD":
      return addToBuild(state, playerId, move.cardId, move.buildId, move.tableCardIds);
    case "RAISE_BUILD":
      return raiseBuild(state, playerId, move.cardId, move.buildId, move.tableCardIds);
    case "STEAL":
      return stealIntoBuild(state, playerId, move.cardId, move.buildId, move.stolenCardId, move.tableCardIds);
    default:
      throw new IllegalMoveError(`Unknown action "${(move as { action: unknown }).action}".`);
  }
}
