# South African Casino — Confirmed Rules

This file is the source of truth for the game engine. It combines the original spec
with the answers confirmed in planning. Where the two disagree, this file wins.

Items marked **(default)** were not asked explicitly. Change them here if they are wrong.

## Game structure
- One game = one pass through all 40 cards, scored once at the end. There is no match or target score.
- Deal by player count:
  - 2 players: 10 cards each, then after both hands are empty another 10 each (Phase 1 → Phase 2). No table cards.
  - 3 players: 13 cards each plus 1 face-up table card.
  - 4 players: 10 cards each, no table cards. Everyone plays for themselves (no teams).
- No scoring between Phase 1 and Phase 2. Builds and table cards carry over into Phase 2. **(default)**
- First game: the dealer is picked at random, and the player to the dealer's left is dealt first and starts. **(default)**
- "Play again": the lowest scorer (the loser) is dealt first and starts. A tie for lowest is broken at random. **(default)**
- The winner is the player with the most points. Players tied on points share the win. **(default)**

## Turns
- On each turn exactly one card leaves the player's hand, via drift, capture or a build move.
- Turn order is clockwise: P1 → P2 → … → P1.

## Drifting
- Play a card face up to the table without capturing.
- A player who owns a build cannot drift. They must add to their build, steal into it, or capture something.
- Exception: in Phase 2 of a 2-player game, drifting is always allowed, except for an owner's last card of their build's value (see "Keep a card").
- If there is nothing on the table to capture, the player must drift.

## Capturing
- Play a hand card of value V to take any combination of:
  - loose table cards or groups of loose cards that add up to V
  - builds of value V (anyone's build)
- The player chooses which sets to take, and does not have to take every matching set.
- Capturing is optional. A player may drift instead, unless they own a build. **(default)**
- The **top card of another player's capture pile** can be captured like a loose card: on its own when it matches (a 10 takes their top 10, together with a 10 on the floor), or as part of a group (a 10 takes their top 4 with a floor 6). This works for every value. Only the top card of each pile, and never from your own pile. (Changed 2026-09-28; previously top cards could only be stolen into builds.)
- The captured cards go onto the player's capture pile **in the order they lay on the table**: a build in the order it was built, loose cards in their table order. The **capturing card goes on top**. Nothing is sorted. (Changed 2026-09-28; the original spec sorted the lowest card to the top.)
- Only a real capture sets `lastCapturePlayerId`. A drift never does.

## Builds
- A build has a value from 2 to 10, an owner, and one or more **sets**, where each set is a group of cards adding up to the value.
- **Weak build**: exactly one set (the original combination, e.g. 2+5 = 7).
- **Strong build**: two or more sets (e.g. [2,5] + [6,1] = 7, or a hand 2 placed on a floor 2 = 2-build).
- To create or take over a build, the player must still hold a card of the build's value after the move.
- **Keep a card:** a build owner must always hold a card of the build's value. Their last such card can only be played by capturing that build. It can't be used for another capture, drifted (even in Phase 2), or added to the build.
- A player can own **only one build at a time**. If they make or take over another build worth the **same value** as the one they own, the two join into one (strong) build. A build of a different value is refused. (Added 2026-09-28.)
- While on the table, cards in a build keep the order they were placed in. Nothing is re-sorted.
- Build values go from 2 to 10.

### Creating a build
- Combine a hand card with loose table cards to make value V, while holding another card of value V.
- Pairing counts: a hand 2 played onto a floor 2 makes a strong 2-build, and the player must hold another 2.
- A build created with more than one set is strong straight away. **(default)**

### Your own build
- You **can** add another set with the same value. This uses a hand card, optionally with loose table cards, and makes the build strong.
- You **cannot** raise the value of your own build, whether it is weak or strong.

### An opponent's build
- **Weak**: you may take it over by either:
  - raising its value with **one card from your hand, plus any loose table cards** (e.g. 2+4 = 6, add a hand A and a table 2 → 9, while holding a 9). A raised build is still weak, so another player can raise it again, or (changed 2026-09-28; previously the hand card only)
  - adding a same-value set (hand card and/or loose table cards). The build becomes strong.
  In both cases you become the owner.
- **Strong**: you cannot change it. You can only capture it.

### Stealing a capture-pile top card into a build (single atomic move)
- Only the **top** card of an opponent's capture pile is available. Cards underneath can never be touched.
- The stolen card must form part of a **same-value set** added to a build, either your own build or an opponent's weak build as a takeover.
- The stolen card can be combined with loose table cards.
- The player **must** contribute a hand card in the same move. That card can either:
  - form part of the set with the stolen card (hand 7 + stolen A♠ = 8), or
  - be a matching-value card added as its own set (hand 8 onto the 8-build).
- A stolen card can **never** raise a build's value or start a new build.
- The player must still hold a card of the build's value after the move.

## End of game
- When all cards have been played, the last capturer receives all remaining loose table cards **and any remaining builds**. **(default)**
- If nobody captured anything, the remaining cards are not awarded. **(default)**
- Scoring happens after the remaining cards have been awarded.

## Scoring (per game)
| Category | Points |
|---|---|
| Most cards | 2 (a tie for most: 1 each) |
| 5 or more spades | 1 |
| 2♠ | 1 |
| 10♦ | 2 |
| Each Ace | 1 |

## Tech stack
- MERN monorepo using npm workspaces:
  - `packages/engine`: pure TypeScript rules, shared by client and server, tested with Vitest
  - `client`: Vite + React + TypeScript + Tailwind CSS
  - `server`: Node + Express + Socket.IO + Mongoose (MongoDB Atlas, from Stage 17), server-authoritative
