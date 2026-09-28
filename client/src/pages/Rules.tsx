import { useEffect, type ReactNode } from "react";
import { SOUTH_AFRICAN_CASINO_RULES as RULES, type PlayerCount } from "@sa-casino/engine";

interface RulesProps {
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-semibold tracking-wider text-amber-200 uppercase">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-emerald-50/90">{children}</div>
    </section>
  );
}

function describeHands(count: PlayerCount): string {
  const cards = RULES.cardsPerPlayer[count];
  return count === 2 && RULES.secondDealForTwoPlayers ? `${cards}, then ${cards} more (Phase 2)` : `${cards}`;
}

/** The rules of South African Casino, shown over the current screen. The numbers come from the rule config. */
export function Rules({ onClose }: RulesProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const points = RULES.scoring;
  const cell = "border-b border-white/10 px-3 py-1.5";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-8"
    >
      <article
        onClick={(event) => event.stopPropagation()}
        className="mx-auto max-w-2xl rounded-2xl bg-emerald-950 p-5 shadow-2xl ring-1 ring-white/15 sm:p-8"
      >
        <header className="flex items-start justify-between gap-4">
          <h2 id="rules-title" className="text-2xl font-bold text-amber-300">
            How to play
          </h2>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Close
          </button>
        </header>

        <Section title="The cards">
          <p>
            A {RULES.deckSize}-card deck: Ace to 10 in each suit, with no Jacks, Queens or Kings. An Ace is worth 1
            and every other card is worth its number.
          </p>
        </Section>

        <Section title="Dealing">
          <table className="w-full text-left">
            <thead>
              <tr className="text-emerald-100/70">
                <th className={cell}>Players</th>
                <th className={cell}>Cards each</th>
                <th className={cell}>Face up on the table</th>
              </tr>
            </thead>
            <tbody>
              {RULES.supportedPlayers.map((count) => (
                <tr key={count}>
                  <td className={cell}>{count}</td>
                  <td className={cell}>{describeHands(count)}</td>
                  <td className={cell}>{RULES.faceUpCards[count] || "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            The first dealer is picked at random, and the player on their left starts. In the next game, the player
            who scored the fewest points starts.
          </p>
        </Section>

        <Section title="Your turn: play one card">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Drift:</b> put it face up on the table without capturing. With nothing on the table, you must drift.
            </li>
            <li>
              <b>Capture:</b> take loose cards that add up to your card, in one group or several (an 8 can take an 8
              and 5 + 3 together), plus any build of the same value. You choose which groups to take. Another
              player's top card of the same value can come too, but never on its own: only when you also take a
              matching card, cards adding up to it, or a build from the floor (floor 5 + their top 5 with your 5).
            </li>
            <li>
              <b>Build:</b> combine your card with loose cards to make a value you hold another card of, e.g. 3 + 5 =
              8 while holding an 8. If the floor cards already make the value, another player's top card of that
              value can go in too (floor 6 + 4, their top 10 and your 10, holding another 10).
            </li>
            <li>
              <b>Add to a build:</b> add a new set of the same value to your build, e.g. 6 + 2 onto a build of 8.
            </li>
            <li>
              <b>Raise:</b> add one card from your hand (plus table cards, if you like) to an opponent's weak build,
              e.g. their 6 + your A + a table 2 = 9 while you hold a 9. The build becomes yours.
            </li>
            <li>
              <b>Steal:</b> take the top card of another player's capture pile and add it, together with a card from
              your hand, to your own build as a new set of its value.
            </li>
          </ul>
        </Section>

        <Section title="Builds">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Builds are worth 2 to {RULES.maxBuildValue}. A build with one set is <b>weak</b>; two or more sets make
              it <b>strong</b>.
            </li>
            <li>
              Opponents can raise ("top") a weak build worth less than 10, and then they own it. They can never add
              a set of the same value to your build. A strong build, or a build of 10, can only be captured.
            </li>
            <li>
              You can own one build at a time. If you make or take over another build worth the same as yours, the
              two join into one.
            </li>
            <li>
              While you own a build you can't drift (except in Phase 2 of a 2-player game), and you must always keep a
              card of its value. Your last one can only be played to capture the build.
            </li>
          </ul>
        </Section>

        <Section title="Capture piles">
          <p>
            Captured cards go face up on your pile in the order they lay on the table (a build in the order it was
            built), with your capturing card on top. Only the top card of a pile can ever be taken: captured with
            a card of the same value together with a matching floor build, built into a build together with
            floor cards that already make its value, or stolen into your own build.
          </p>
        </Section>

        <Section title="End of the game">
          <p>
            When all {RULES.deckSize} cards have been played, the last player to make a capture takes whatever is
            left on the table. Then the points are counted.
          </p>
        </Section>

        <Section title="Scoring">
          <table className="w-full text-left">
            <tbody>
              <tr>
                <td className={cell}>Most cards</td>
                <td className={cell}>
                  {points.mostCards} ({points.tiedMostCards} each if tied)
                </td>
              </tr>
              <tr>
                <td className={cell}>{points.spadesNeededForBonus} or more spades</td>
                <td className={cell}>{points.fiveSpades}</td>
              </tr>
              <tr>
                <td className={cell}>2♠</td>
                <td className={cell}>{points.twoOfSpades}</td>
              </tr>
              <tr>
                <td className={cell}>10♦</td>
                <td className={cell}>{points.tenOfDiamonds}</td>
              </tr>
              <tr>
                <td className={cell}>Each Ace</td>
                <td className={cell}>{points.eachAce}</td>
              </tr>
            </tbody>
          </table>
          <p>The player with the most points wins. Players tied on points share the win.</p>
        </Section>
      </article>
    </div>
  );
}
