import { formatCard, type Card } from "./Card";

/**
 * Every group of cards that adds up to `value`, each group listed once.
 * e.g. value 8 with [8, 5, 3, 6, 2] → [8], [5, 3] and [6, 2].
 */
export function findGroupsAddingUpTo(cards: readonly Card[], value: number): Card[][] {
  const groups: Card[][] = [];
  const group: Card[] = [];

  function search(start: number, remaining: number) {
    if (remaining === 0) {
      groups.push([...group]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      if (cards[i].value <= remaining) {
        group.push(cards[i]);
        search(i + 1, remaining - cards[i].value);
        group.pop();
      }
    }
  }

  search(0, value);
  return groups;
}

/**
 * Splits cards into groups that each add up to `value`, using every card once.
 * Returns the groups, or null if that can't be done.
 * e.g. value 8: [8, 5, 3] → [[8], [5, 3]], but [5, 4] → null.
 *
 * Nothing is re-sorted: cards keep the order they were given in (the order they lie on the
 * table, or were placed), and the groups are ordered by where their first card was.
 */
export function splitIntoGroups(cards: readonly Card[], value: number): Card[][] | null {
  const total = cards.reduce((sum, card) => sum + card.value, 0);
  if (total % value !== 0) {
    return null;
  }

  // Cards of equal value are interchangeable, so search with counts: counts[v] = how many cards of value v.
  const counts = new Array<number>(11).fill(0);
  for (const card of cards) {
    counts[card.value]++;
  }
  const valueGroups = splitCounts(counts, value, new Set());
  if (!valueGroups) {
    return null;
  }

  // Swap each value back for a real card of that value, then put the cards back in their original order.
  const unused = [...cards];
  const groups = valueGroups.map((group) =>
    group.map((groupValue) => unused.splice(unused.findIndex((card) => card.value === groupValue), 1)[0]),
  );
  const position = (card: Card) => cards.indexOf(card);
  return groups
    .map((group) => [...group].sort((a, b) => position(a) - position(b)))
    .sort((a, b) => position(a[0]) - position(b[0]));
}

/** Text for groups of cards, e.g. "8♥ and 5♣ + 3♦". */
export function formatGroups(groups: readonly (readonly Card[])[]): string {
  return groups.map((group) => group.map(formatCard).join(" + ")).join(" and ");
}

/**
 * The search behind splitIntoGroups. The highest card left has to go in some group,
 * so try each group it could be part of, then split what's left the same way.
 * `failed` remembers the counts that can't be split, so they are never tried twice.
 */
function splitCounts(counts: number[], value: number, failed: Set<string>): number[][] | null {
  const highest = highestValueLeft(counts);
  if (highest === 0) {
    return [];
  }
  if (highest > value) {
    return null;
  }
  const key = counts.join(",");
  if (failed.has(key)) {
    return null;
  }

  counts[highest]--;
  for (const rest of valueCombinations(counts, value - highest, highest)) {
    for (const v of rest) counts[v]--;
    const otherGroups = splitCounts(counts, value, failed);
    for (const v of rest) counts[v]++;
    if (otherGroups) {
      counts[highest]++;
      return [[highest, ...rest], ...otherGroups];
    }
  }
  counts[highest]++;

  failed.add(key);
  return null;
}

function highestValueLeft(counts: number[]): number {
  for (let v = counts.length - 1; v >= 1; v--) {
    if (counts[v] > 0) {
      return v;
    }
  }
  return 0;
}

/** Every way to make `target` from the values left in `counts`, using values no bigger than `maxValue`. */
function valueCombinations(counts: number[], target: number, maxValue: number): number[][] {
  if (target === 0) {
    return [[]];
  }
  const combinations: number[][] = [];
  for (let v = Math.min(target, maxValue); v >= 1; v--) {
    if (counts[v] === 0) continue;
    counts[v]--;
    for (const rest of valueCombinations(counts, target - v, v)) {
      combinations.push([v, ...rest]);
    }
    counts[v]++;
  }
  return combinations;
}
