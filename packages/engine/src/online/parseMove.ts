import type { Move } from "../models/Move";

const MAX_IDS = 40;

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 40;
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_IDS && value.every(isId);
}

/**
 * Checks that something received over the network has the shape of a Move, and returns
 * a clean copy of it, or null if it doesn't. Whether the move is legal is checked
 * separately, by the rules.
 */
export function parseMove(input: unknown): Move | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const move = input as Record<string, unknown>;
  const cardId = move.cardId;
  const tableCardIds = move.tableCardIds ?? [];
  const buildIds = move.buildIds ?? [];
  if (!isId(cardId) || !isIdList(tableCardIds) || !isIdList(buildIds)) {
    return null;
  }

  switch (move.action) {
    case "DRIFT":
      return { action: "DRIFT", cardId };
    case "CAPTURE":
      return { action: "CAPTURE", cardId, tableCardIds, buildIds };
    case "BUILD":
      return typeof move.value === "number" && Number.isInteger(move.value)
        ? { action: "BUILD", cardId, tableCardIds, value: move.value }
        : null;
    case "ADD_TO_BUILD":
      return isId(move.buildId) ? { action: "ADD_TO_BUILD", cardId, buildId: move.buildId, tableCardIds } : null;
    case "RAISE_BUILD":
      return isId(move.buildId) ? { action: "RAISE_BUILD", cardId, buildId: move.buildId, tableCardIds } : null;
    case "STEAL":
      return isId(move.buildId) && isId(move.stolenCardId)
        ? { action: "STEAL", cardId, buildId: move.buildId, stolenCardId: move.stolenCardId, tableCardIds }
        : null;
    default:
      return null;
  }
}
