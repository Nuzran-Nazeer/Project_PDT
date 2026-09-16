import { useMemo } from "react";

// Assembled from the flat list the server sends. Depth is carried by nesting, not a stored level.
const LEVEL = ["text-[15px] font-semibold", "text-sm font-medium", "text-sm font-normal"];

const levelClass = (depth) => LEVEL[Math.min(depth, LEVEL.length - 1)];

export default function UnitTree({ units, selectedId, onSelect }) {
  // Grouped once, not filtered inside the recursion.
  const childrenOf = useMemo(() => {
    const map = new Map();
    units.forEach((unit) => {
      const key = unit.parentUnitId ? String(unit.parentUnitId) : "root";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(unit);
    });
    return map;
  }, [units]);

  // Recursion: the nesting is what makes a screen reader announce the tree as a tree.
  const branch = (parentKey, depth) => {
    const children = childrenOf.get(parentKey) || [];
    // An empty list would still draw its guide line.
    if (children.length === 0) return null;

    return (
      <ul
        className={
          depth === 0 ? "space-y-px" : "ml-3.5 space-y-px border-l border-line pl-2.5"
        }
      >
        {children.map((unit) => {
          const id = String(unit._id);
          const selected = String(selectedId) === id;

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(unit)}
                className={`flex w-full items-baseline justify-between gap-4 rounded-md px-2.5 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${levelClass(
                  depth,
                )} ${
                  selected
                    ? "bg-brand/10 text-brand"
                    : "text-ink hover:bg-surface hover:text-brand"
                }`}
              >
                <span
                  className={`truncate ${unit.active === false ? "text-muted line-through decoration-1" : ""}`}
                >
                  {unit.name}
                </span>
                <span
                  className={`shrink-0 text-[10px] font-medium uppercase tracking-wider ${
                    selected ? "text-brand/70" : "text-muted"
                  }`}
                >
                  {unit.active === false ? "closed" : unit.type}
                </span>
              </button>

              {branch(id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return branch("root", 0);
}
