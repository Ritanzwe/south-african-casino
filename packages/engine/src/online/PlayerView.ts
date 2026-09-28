import { getPlayer } from "../engine/stateHelpers";
import type { GameState } from "../models/GameState";

/**
 * A game as one player may see it online: their own hand, plus everything that lies face up.
 * Other players' hands and the undealt deck are emptied; only how many cards they hold is kept.
 * The server sends each player this instead of the full game, so nobody can peek.
 */
export interface PlayerView extends GameState {
  viewerId: string;
  /** How many cards each player holds. */
  handSizes: Record<string, number>;
  /** How many cards are left to deal. */
  deckSize: number;
}

export function getPlayerView(state: GameState, viewerId: string): PlayerView {
  const handSizes: Record<string, number> = {};
  for (const player of state.players) {
    handSizes[player.id] = player.hand.length;
  }
  return {
    ...state,
    players: state.players.map((player) => (player.id === viewerId ? player : { ...player, hand: [] })),
    deck: [],
    viewerId,
    handSizes,
    deckSize: state.deck.length,
  };
}

function isPlayerView(state: GameState): state is PlayerView {
  return "handSizes" in state;
}

/** How many cards a player holds. Works on a full game and on a player view. */
export function getHandSize(state: GameState, playerId: string): number {
  return isPlayerView(state) ? state.handSizes[playerId] : getPlayer(state, playerId).hand.length;
}

/** How many cards are left to deal. Works on a full game and on a player view. */
export function getDeckSize(state: GameState): number {
  return isPlayerView(state) ? state.deckSize : state.deck.length;
}
