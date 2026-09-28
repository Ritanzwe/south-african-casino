/** Thrown when a player tries a move the rules don't allow. The message explains why. */
export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalMoveError";
  }
}
