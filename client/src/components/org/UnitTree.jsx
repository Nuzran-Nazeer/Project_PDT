import { useMemo } from "react";

// The tree, drawn from the flat list the server sends.
//
// The server returns units flat, each carrying its parent, and says so on purpose:
// a collection is honestly a list, and a nested response has to decide what to do
// with an orphan. Assembling the shape here keeps that decision on the screen that
// draws it.
//
// No expand and collapse: Altrium's tree is a handful of units and hiding four of
// them behind a chevron would be machinery in place of information. It can be added
// when a tree is big enough to need it.

// Depth is carried by nesting rather than by a stored level, so nothing has to be
// kept in sync when a unit moves.
//
// Three things say how deep a unit sits, because indentation alone is a weak signal
// and this data proves it — "Backend" exists under two different parents, and with
// only an offset to go on you have to measure the left edge by eye to tell them
// apart. So each level also gets a GUIDE LINE down its left side, and the name steps
// down in size and weight.
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

  // Recursion, not a flattened depth-first list: the nesting is what makes a screen
  // reader announce the tree as a tree.
  const branch = (parentKey, depth) => {
    const children = childrenOf.get(parentKey) || [];
    // A leaf renders no list at all. An empty one would still draw its guide line,
    // leaving a stub hanging under every unit that has no children.
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
                // Name left, type hard right. The type used to start wherever the
                // name happened to end, which scattered COMPANY / UNIT / SUB-UNIT
                // across the card instead of lining them up; flush right makes it a
                // column, and puts content at both edges of a row that was mostly
                // empty in the middle.
                className={`flex w-full items-baseline justify-between gap-4 rounded-md px-2.5 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${levelClass(
                  depth,
                )} ${
                  selected
                    ? "bg-brand/10 text-brand"
                    : "text-ink hover:bg-surface hover:text-brand"
                }`}
              >
                <span className="truncate">{unit.name}</span>
                <span
                  className={`shrink-0 text-[10px] font-medium uppercase tracking-wider ${
                    selected ? "text-brand/70" : "text-muted"
                  }`}
                >
                  {unit.type}
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
