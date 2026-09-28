import { findCardInHand } from "../engine/stateHelpers";
import type { GameState } from "../models/GameState";
import { getKeepCardError, ownsBuild } from "./BuildRules";
import { SOUTH_AFRICAN_CASINO_RULES as RULES } from "./SouthAfricanCasinoRules";
import { getTurnError } from "./TurnRules";

/** True in Phase 2 of a 2-player game, where players may always drift, even while owning a build. */
export function isDriftAlwaysAllowed(state: GameState): boolean {
  return RULES.twoPlayerPhase2AlwaysAllowsDrift && state.playerCount === 2 && state.phase === 2;
}

/**
 * Explains why the player can't drift right now, or returns null if they can.
 * Pass `cardId` to check drifting that particular card: a build owner may never drift
 * their last card of the build's value.
 * The messages are written for players, so the UI can show them as they are.
 */
export function getDriftError(state: GameState, playerId: string, cardId?: string): string | null {
  const turnError = getTurnError(state, playerId);
  if (turnError) {
    return turnError;
  }
  if (ownsBuild(state, playerId) && !isDriftAlwaysAllowed(state)) {
    return "You own a build, so you can't drift. Add to your build or capture something.";
  }
  if (cardId !== undefined) {
    if (!findCardInHand(state, playerId, cardId)) {
      return "That card is not in your hand.";
    }
    return getKeepCardError(state, playerId, cardId);
  }
  return null;
}

/** Can this player drift (play a card to the table without capturing)? Pass `cardId` to ask about one card. */
export function canDrift(state: GameState, playerId: string, cardId?: string): boolean {
  return getDriftError(state, playerId, cardId) === null;
}

/** True when there is nothing on the table to capture: no loose cards and no builds. */
export function isTableEmpty(state: GameState): boolean {
  return state.tableCards.length === 0 && state.builds.length === 0;
}

/**
 * True when drifting is the player's only option because the table is empty,
 * e.g. the first turn of a 2- or 4-player game.
 */
export function mustDrift(state: GameState, playerId: string): boolean {
  return isTableEmpty(state) && canDrift(state, playerId);
}
