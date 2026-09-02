const UnitMembership = require("../models/unitmembership.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { toDay, assertOrderedRange, overlapping } = require("../utils/dateRange");
const {
  PEER_ELIGIBILITY_MONTHS,
  PEER_ELIGIBILITY_MONTHS_IN_CYCLE,
} = require("../config/constants");

// Who is qualified to review a given person over a given period, derived from the dated
// membership records. Nothing here is stored: the answer changes as people move, and a
// stored pool would be answering a question about a company that has changed.

const addMonths = (date, months) => {
  const shifted = new Date(date.getTime());
  const target = shifted.getUTCMonth() + months;
  shifted.setUTCMonth(target);

  // 31 January plus one month rolls into March, which would over-count the stretch.
  // Falling back to the last day of the intended month keeps the comparison honest.
  if (shifted.getUTCMonth() !== ((target % 12) + 12) % 12) shifted.setUTCDate(0);
  return shifted;
};

const spansMonths = (from, to, months) =>
  to.getTime() >= addMonths(from, months).getTime();

// Where two dated periods overlap, or null. An open record runs to `openEnd` rather
// than forever: eligibility is always asked about a period that ends, so an unbounded
// stretch cannot be measured and does not need to be.
const intersect = (a, b, openEnd) => {
  const from = new Date(Math.max(a.from.getTime(), b.from.getTime()));
  const ends = [a.to, b.to].filter(Boolean).map((d) => d.getTime());
  const to = ends.length ? new Date(Math.min(...ends)) : openEnd;
  if (to.getTime() <= from.getTime()) return null;
  return { from, to };
};

/**
 * Everyone eligible to give peer feedback on `userId` over the period [from, to).
 *
 * Two people qualify by having shared a unit for ONE CONTINUOUS stretch of at least
 * four months, of which at least two fall inside the period. Separate stints are never
 * added together, so each is measured on its own and the longest one decides.
 *
 * A unit's lead belongs to the unit ABOVE the one they lead, so a supervisor never
 * appears in their own reports' pool. That falls out of the tree rule rather than
 * being filtered here.
 *
 * ⚠️ NARROWED, DELIBERATELY. The rule reads "unit membership AND project assignment",
 * and project assignments do not exist yet. Anyone reachable only through a shared
 * project is missing, which is why every result carries `sources`.
 */
const candidatesFor = async (userId, { from, to }) => {
  const start = toDay(from, "from");
  const end = toDay(to, "to");
  assertOrderedRange(start, end);

  const reviewee = await User.findById(userId);
  if (!reviewee) throw new AppError("User not found", 404);

  const window = { from: start, to: end };
  const empty = { revieweeId: String(userId), from: start, to: end, sources: ["unit"] };

  const mine = await UnitMembership.find({ userId, ...overlapping(start, end) });

  // Nobody shares a unit with somebody who was in none. A real answer, not a missing
  // one: a person outside the structure is not appraised.
  if (!mine.length) return { ...empty, candidates: [] };

  const unitIds = [...new Set(mine.map((m) => String(m.unitId)))];

  const theirs = await UnitMembership.find({
    unitId: { $in: unitIds },
    userId: { $ne: userId },
    ...overlapping(start, end),
  }).populate("userId", "name employeeId designation jobFamily status");

  const best = new Map();

  for (const ours of mine) {
    for (const other of theirs) {
      if (!other.userId || String(other.unitId) !== String(ours.unitId)) continue;

      // An invited or deactivated account cannot write a review, so offering it would
      // build a pool that cannot be filled.
      if (other.userId.status !== "active") continue;

      const shared = intersect(ours, other, end);
      if (!shared) continue;

      const inCycle = intersect(shared, window, end);
      const eligible =
        spansMonths(shared.from, shared.to, PEER_ELIGIBILITY_MONTHS) &&
        Boolean(inCycle) &&
        spansMonths(inCycle.from, inCycle.to, PEER_ELIGIBILITY_MONTHS_IN_CYCLE);

      const id = String(other.userId._id);
      const span = shared.to.getTime() - shared.from.getTime();
      const current = best.get(id);

      if (!current || span > current.span) {
        best.set(id, {
          span,
          eligible,
          person: other.userId,
          unitId: other.unitId,
          shared,
        });
      }
    }
  }

  const candidates = [...best.values()]
    .filter((entry) => entry.eligible)
    .map((entry) => ({
      id: String(entry.person._id),
      name: entry.person.name,
      employeeId: entry.person.employeeId,
      designation: entry.person.designation,
      jobFamily: entry.person.jobFamily,
      unitId: entry.unitId,
      sharedFrom: entry.shared.from,
      sharedTo: entry.shared.to,
      via: "unit",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // `sources` is not decoration: the caller has to be able to say what the pool was
  // built from, because it is not yet everything the rule asks for.
  return { ...empty, candidates };
};

module.exports = { candidatesFor, spansMonths, addMonths, intersect };
