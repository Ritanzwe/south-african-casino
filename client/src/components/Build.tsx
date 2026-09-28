import { isStrongBuild, type Build as BuildData } from "@sa-casino/engine";
import { Card } from "./Card";

interface BuildProps {
  build: BuildData;
  ownerName: string;
  selected: boolean;
  /** Draws a glow round the build, e.g. to show it can be captured. */
  highlighted: boolean;
  /** Makes the build clickable. */
  onClick?: () => void;
}

/** A build on the table: whose it is, weak or strong, and each set, e.g. "5 + 3 = 8". */
export function Build({ build, ownerName, selected, highlighted, onClick }: BuildProps) {
  const stateClasses = selected ? "-translate-y-1 ring-4 ring-amber-400" : highlighted ? "ring-4 ring-sky-300/80" : "";
  const classes = `flex flex-col gap-1.5 rounded-xl border-2 border-amber-300/60 bg-emerald-900/80 p-2 text-left text-white transition ${stateClasses}`;
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold tracking-wide text-amber-200 uppercase">{ownerName}'s build</span>
        <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
          {isStrongBuild(build) ? "Strong" : "Weak"}
        </span>
      </div>
      {build.sets.map((set) => (
        <div key={set.map((card) => card.id).join()} className="flex items-center gap-2">
          <div className="flex gap-1">
            {set.map((card) => (
              <Card key={card.id} card={card} size="sm" />
            ))}
          </div>
          <span className="text-sm whitespace-nowrap">
            {set.map((card) => card.rank).join(" + ")} = {build.value}
          </span>
        </div>
      ))}
    </>
  );

  if (!onClick) {
    return <div className={classes}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${ownerName}'s build of ${build.value}`}
      className={`${classes} cursor-pointer`}
    >
      {content}
    </button>
  );
}
