# South African Casino — TODO

Stack: MERN (MongoDB, Express, React, Node) + TypeScript, Tailwind, Socket.IO, Vitest.
Mark items with `[x]` when done.

## Stage 0 — Planning
- [x] Read and analyse the full spec
- [x] Confirm open rule & tech questions with the user
- [x] Write confirmed rules to RULES.md
- [x] User signs off on the **(default)** items in RULES.md

## Stages 1–5
- [x] Set up the monorepo (npm workspaces: `packages/engine` + `client` with React, Vite and Tailwind)
- [x] Rule config (`SOUTH_AFRICAN_CASINO_RULES`) in one place
- [x] Stage 1 — Card model + 40-card deck
- [x] Stage 2 — Shuffle (with an optional seed so tests are repeatable)
- [x] Player model
- [x] Stage 3 — Dealing for 2 / 3 / 4 players (incl. the 2-player second deal)
- [x] GameState model + createGame() (random first dealer, previous loser starts later games)
- [x] Stage 4 — Table cards (3-player face-up card)
- [x] Stage 5 — Drifting (canDrift / drift, "must drift" when the table is empty)
- [x] Unit tests: deck, shuffle, dealing, drifting, game engine
- [x] Minimal pass-and-play screen: setup, table, hand, DRIFT button, game log
- [x] Explain how the engine works before moving on to capturing

## Stages 6–14 — Engine
- [x] Stage 6 — Normal capturing (one or several groups, player chooses which; CAPTURE button + capturable cards glow)
- [x] Stage 7 — Capture piles (stack, lowest card on top, top card shown in the UI)
- [x] Stage 8 — Capture-pile stealing (top card only, into your build or an opponent's weak build, with a hand card, one card per move)
- [x] Stage 9 — Builds: create (incl. pairs and multi-set), add sets, raise an opponent's weak build, take over, weak vs strong, one build each, keep-a-card rule
- [x] Stage 10 — Build capturing (any build of the card's value, together with loose groups)
- [x] Stage 11 — Turn management (clockwise order, "is it your turn?" checks, every move type ends the turn)
- [x] Stage 12 — 2-player second deal + Phase 2 rules
  - [x] Automatic second deal once both hands are empty
  - [x] Phase 2: drifting always allowed, even while owning a build (except the last card needed for it)
  - [x] Full play-throughs with builds and steals (75 random games, 2/3/4 players)
- [x] Stage 13 — End of hand
  - [x] Game finishes when all cards have been played
  - [x] Last capturer is tracked (drifts never change it)
  - [x] Remaining table cards (and any builds) go to the last capturer; nobody gets them if nobody captured
  - [x] No build can be left at the end (owners always keep a card to capture it; checked in random-game tests)
- [x] Stage 14 — Scoring + score breakdown (calculated after the leftover cards are awarded)
  - [x] Results screen: totals, winner (ties shared), full breakdown table, "Play again" (loser starts)
  - [x] Points so far shown on every seat

## Stages 15–20 — Product
- [ ] Stage 15 — Playable local game (UI)
  - [x] Setup → play → results → play again, with every move type
  - [x] "Pass the device" panel between turns (hides the hand, shows what happened since your last turn; can be switched off on the setup screen)
  - [x] Rules page (pages/Rules.tsx), opens from the setup screen and mid-game
  - [ ] User plays a full game in a real browser; fix whatever feels awkward ← waiting on feedback
- [x] Stage 16 — Bots (Easy / Medium / Hard)
  - [x] Bot engine (`packages/engine/src/bots/BotPlayer.ts`): easy = random legal move; medium = best immediate gain; hard = also weighs what the next player could capture, using the cards it hasn't seen
  - [x] Bots only choose legal moves (tested in full 2/3/4-player games); medium beats easy, hard beats medium in seeded matches
  - [x] Setup screen: each seat is a person or a bot; bots move by themselves after a 1-second pause
  - [x] Client type-checks and builds; user played against the bots in the browser and confirmed it works
- [ ] Stage 17 — Online multiplayer
  - [x] `server` workspace: Express + Socket.IO, server-authoritative (the engine checks every move; each player only receives their own cards)
  - [x] Private rooms with a link/code, guest names, seat kept after a refresh, host controls, bots on the server, host can hand a departed player's seat to a bot
  - [x] Client: create/join on the start screen, room lobby, online game on the same table as local games
  - [x] Tests: room rules + full online games over real sockets; production server checked end to end
  - [x] Code on GitHub: https://github.com/Ritanzwe/south-african-casino (pushes over SSH from this PC)
  - [ ] Put it online with Render (needs your Render account) ← next
  - [ ] Keep games in MongoDB so they survive restarts (planned with Stage 19)
- [ ] Stage 18 — Authentication & profiles
- [ ] Stage 19 — Game history
- [ ] Stage 20 — Animations, sound, mobile polish

## Bug fixes
- [x] 2026-09-28 bug report (tests in `packages/engine/tests/bugReport.test.ts`)
  - [x] Bug 1: taking over an opponent's build that ends up the same value as your own build joins them into one
  - [x] Bug 2: clear message when a build isn't allowed (e.g. "You need to keep a 9…") instead of a capture error
  - [x] Bug 3: captured cards keep the order they lay in, capturing card on top; builds keep their placement order
  - [x] Bug 4 / Test 5: raising an opponent's weak build can include floor cards
  - [x] Main action button stands out from the others, to avoid e.g. ADD TO BUILD by mistake
- [x] 2026-09-28: a matching card captures other players' top capture-pile cards too (e.g. a 10 takes the floor 10 and an opponent's top 10), for every value
- [x] 2026-09-28: top cards are only captured by the same value (never part of a sum); another player's build can't take same-value sets or steals (only raised if weak and under 10, or captured)
- [x] 2026-09-28: a top card is never taken on its own; only with a matching floor build (floor N, floor cards making N, or a build of N): captured together with it, or built into a new build of N (Examples 1–4 in bugReport.test.ts)
- [x] 2026-09-28: continuing your own build: ADD TO MY BUILD / STEAL INTO MY BUILD aim at your build without clicking it; your build counts as the floor build for other players' top cards; online selections no longer reset on unrelated updates
- [x] 2026-09-28 (screenshot): when the floor already makes N, a build can use another player's top card as part of a sum (floor 9 + your 4 + their top 5 = build of 9); hint shows the real build value
- [x] 2026-09-28 (screenshot 1): a capture can use another player's top card as part of a sum when it also takes a floor build of the value (your build of 9 + floor 6 + their top 3 with your 9); CAPTURE WITH MY BUILD when your build isn't clicked; the 6 and the 3 light up; the hint no longer shows a steal error for a capture
- [x] 2026-09-28 (screenshot 2): their build of 4 + floor 4 + your A (or 2) raise into one build of 9 (or 10), checked with tests; the over-10 message now says what the build would make

## Open questions (ask before the stage that needs them)
- None right now.
