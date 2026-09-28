/** A function that returns a random number from 0 up to (but not including) 1, like Math.random. */
export type RandomFn = () => number;

/**
 * Creates a seeded random number generator (the "mulberry32" algorithm).
 * The same seed always gives the same sequence of numbers, so a game created
 * with a seed can be repeated exactly. Handy for tests and replays.
 */
export function createSeededRandom(seed: number): RandomFn {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random whole number from 0 up to (but not including) `max`. */
export function randomInt(max: number, random: RandomFn): number {
  return Math.floor(random() * max);
}
