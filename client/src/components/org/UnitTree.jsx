import { useMemo } from "react";

// The tree, assembled here from the flat list the server sends. No expand and
// collapse: Altrium's tree is a handful of units, and hiding four of them behind a
// chevron would be machinery in place of information.

// Depth is carried by nesting rather than a stored level, so nothing needs keeping in
// sync when a unit moves. Indentation alone is a weak signal ("Backend" exists under
// two different parents), so each level also gets a guide line and a size step.
const LEVEL = ["text-[15px] font-semibold", "text-sm font-medium", "text-sm font-normal"];

const levelClass = (depth) => LEVEL[Math.min(depth, LEVEL.length - 1)];

export default function UnitTree({ units, selectedId, onSelect }) {
  // Grouped once per change of the list rather than filtered inside the recursion,
  // which would be a pass over every unit for every unit.
  const childrenOf = useMemo(() => {
    const map = new Map();
    units.forEach((unit) => {
      const key = unit.parentUnitId ? String(unit.parentUnitId) : "root";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(unit);
    });
    return map;
  }, [units]);

  // Recursion rather than a flattened list: the nesting is what makes a screen reader
  // announce the tree as a tree.
  const branch = (parentKey, depth) => {
    const children = childrenOf.get(parentKey) || [];
    // A leaf renders no list at all. An empty one would still draw its guide line,
    // leaving a stub under every unit with no children.
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
                // Name left, type flush right, so the types line up as a column
                // instead of starting wherever each name happened to end.
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
