const UnitMembership = require("../models/unitmembership.model");
const UnitLead = require("../models/unitlead.model");
const ProjectAssignment = require("../models/projectassignment.model");
const OrgUnit = require("../models/orgunit.model");
const Project = require("../models/project.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { toDay, assertOrderedRange, overlapping } = require("../utils/dateRange");
const {
  PEER_ELIGIBILITY_MONTHS,
  PEER_ELIGIBILITY_MONTHS_IN_CYCLE,
  PEER_CONTINUITY_GAP_MONTHS,
} = require("../config/constants");

// Who is qualified to review a given person over a given period, derived from the dated
// unit and project records every time. A stored pool would describe a company that has moved.

const addMonths = (date, months) => {
  const shifted = new Date(date.getTime());
  const target = shifted.getUTCMonth() + months;
  shifted.setUTCMonth(target);

  // 31 January plus one month rolls into March, which would over-count the stretch.
  if (shifted.getUTCMonth() !== ((target % 12) + 12) % 12) shifted.setUTCDate(0);
  return shifted;
};

const spansMonths = (from, to, months) =>
  to.getTime() >= addMonths(from, months).getTime();

// Where two dated periods overlap, or null. An open record runs to `openEnd`.
const intersect = (a, b, openEnd) => {
  const from = new Date(Math.max(a.from.getTime(), b.from.getTime()));
  const ends = [a.to, b.to].filter(Boolean).map((d) => d.getTime());
  const to = ends.length ? new Date(Math.min(...ends)) : openEnd;
  if (to.getTime() <= from.getTime()) return null;
  return { from, to };
};

const unique = (values) => [...new Set(values.map(String))];

// ⚠️ Stretches from DIFFERENT sources join into one relationship. Two months on a project
// then, within the allowed break, two months in the same unit is four months together.
const joinStretches = (pieces) => {
  const runs = [];
  for (const piece of [...pieces].sort((a, b) => a.from - b.from)) {
    const last = runs[runs.length - 1];
    const joins =
      last &&
      piece.from.getTime() <= addMonths(last.to, PEER_CONTINUITY_GAP_MONTHS).getTime();

    if (joins) {
      if (piece.to > last.to) last.to = piece.to;
      last.pieces.push(piece);
    } else {
      runs.push({ from: piece.from, to: piece.to, pieces: [piece] });
    }
  }
  return runs;
};

const qualifies = (run, window) => {
  if (!spansMonths(run.from, run.to, PEER_ELIGIBILITY_MONTHS)) return false;
  const inCycle = intersect(run, window, window.to);
  return (
    Boolean(inCycle) &&
    spansMonths(inCycle.from, inCycle.to, PEER_ELIGIBILITY_MONTHS_IN_CYCLE)
  );
};

// The source a review counts against for the per-source limit: most shared time inside the
// run, and on a tie the one worked in most recently.
const attributeTo = (run) => {
  const bySource = new Map();
  for (const piece of run.pieces) {
    const key = `${piece.source.kind}:${piece.source.id}`;
    const entry = bySource.get(key) || { source: piece.source, span: 0, lastTo: 0 };
    entry.span += piece.to.getTime() - piece.from.getTime();
    entry.lastTo = Math.max(entry.lastTo, piece.to.getTime());
    bySource.set(key, entry);
  }
  return [...bySource.values()].sort((a, b) => b.span - a.span || b.lastTo - a.lastTo)[0]
    .source;
};

const ancestorsOf = async (unitIds) => {
  const found = new Set();
  let frontier = unique(unitIds);
  while (frontier.length) {
    frontier.forEach((id) => found.add(id));
    const units = await OrgUnit.find({ _id: { $in: frontier } }).select("parentUnitId");
    frontier = unique(units.map((u) => u.parentUnitId).filter(Boolean)).filter(
      (id) => !found.has(id),
    );
  }
  return [...found];
};

const descendantsOf = async (unitIds) => {
  const found = new Set();
  let frontier = unique(unitIds);
  while (frontier.length) {
    frontier.forEach((id) => found.add(id));
    const children = await OrgUnit.find({ parentUnitId: { $in: frontier } }).select(
      "_id",
    );
    frontier = unique(children.map((c) => c._id)).filter((id) => !found.has(id));
  }
  return [...found];
};

// ⚠️ Anyone above or below the reviewee in the tree is not a peer. Leads sitting in the
// parent unit keeps them out of a unit-only pool, but a shared project crosses the tree.
const outsidePeerRelationship = async (userId, unitIds, inReach) => {
  const above = await ancestorsOf(unitIds);
  const ledByReviewee = await UnitLead.find({ userId, ...inReach }).select("unitId");
  const below = await descendantsOf(ledByReviewee.map((r) => r.unitId));

  const [leadsAbove, reportsBelow] = await Promise.all([
    UnitLead.find({ unitId: { $in: above }, ...inReach }).select("userId"),
    below.length
      ? UnitMembership.find({ unitId: { $in: below }, ...inReach }).select("userId")
      : [],
  ]);

  return new Set([...leadsAbove, ...reportsBelow].map((r) => String(r.userId)));
};

/**
 * Everyone eligible to give peer feedback on `userId` over the period [from, to).
 *
 * Qualifying is ONE CONTINUOUS run of working together of at least four months, at least
 * two of them inside the period. Shared unit and project stretches join into a run across a
 * break of up to a month; separate runs are never added together.
 */
const candidatesFor = async (userId, { from, to }) => {
  const start = toDay(from, "from");
  const end = toDay(to, "to");
  assertOrderedRange(start, end);

  const reviewee = await User.findById(userId).select("_id");
  if (!reviewee) throw new AppError("User not found", 404);

  const window = { from: start, to: end };
  const empty = { revieweeId: String(userId), from: start, to: end, candidates: [] };

  // Far enough back that a run starting before the period, and joined across a break,
  // is still seen whole.
  const lookback = addMonths(
    start,
    -(PEER_ELIGIBILITY_MONTHS + PEER_CONTINUITY_GAP_MONTHS),
  );
  const inReach = overlapping(lookback, end);

  const [myUnits, myProjects] = await Promise.all([
    UnitMembership.find({ userId, ...inReach }),
    ProjectAssignment.find({ userId, ...inReach }),
  ]);

  // Somebody in no unit has no supervisor and is not appraised.
  if (!myUnits.length) return empty;

  const unitIds = unique(myUnits.map((m) => m.unitId));
  const projectIds = unique(myProjects.map((p) => p.projectId));

  const [theirUnits, theirProjects, excluded] = await Promise.all([
    UnitMembership.find({
      unitId: { $in: unitIds },
      userId: { $ne: userId },
      ...inReach,
    }),
    projectIds.length
      ? ProjectAssignment.find({
          projectId: { $in: projectIds },
          userId: { $ne: userId },
          ...inReach,
        })
      : [],
    outsidePeerRelationship(userId, unitIds, inReach),
  ]);

  const piecesByPerson = new Map();
  const collect = (mine, theirs, field, kind) => {
    for (const ours of mine) {
      for (const other of theirs) {
        if (String(ours[field]) !== String(other[field])) continue;

        const shared = intersect(ours, other, end);
        if (!shared) continue;
        if (shared.to > end) shared.to = end;
        if (shared.to <= shared.from) continue;

        const id = String(other.userId);
        if (!piecesByPerson.has(id)) piecesByPerson.set(id, []);
        piecesByPerson
          .get(id)
          .push({ ...shared, source: { kind, id: String(ours[field]) } });
      }
    }
  };
  collect(myUnits, theirUnits, "unitId", "unit");
  collect(myProjects, theirProjects, "projectId", "project");

  const qualifying = new Map();
  for (const [personId, pieces] of piecesByPerson) {
    if (excluded.has(personId)) continue;

    // The most recent qualifying run decides, so attribution follows the current relationship.
    const run = joinStretches(pieces)
      .filter((r) => qualifies(r, window))
      .sort((a, b) => b.to - a.to)[0];
    if (run) qualifying.set(personId, run);
  }

  if (!qualifying.size) return empty;

  // An invited or deactivated account cannot write a review, so offering one builds a pool
  // that cannot be filled.
  const [people, units, projects] = await Promise.all([
    User.find({ _id: { $in: [...qualifying.keys()] }, status: "active" }).select(
      "name employeeId designation jobFamily",
    ),
    OrgUnit.find({ _id: { $in: unitIds } }).select("name"),
    projectIds.length ? Project.find({ _id: { $in: projectIds } }).select("name") : [],
  ]);

  const nameOf = new Map(
    [...units, ...projects].map((doc) => [String(doc._id), doc.name]),
  );

  const candidates = people
    .map((person) => {
      const run = qualifying.get(String(person._id));
      const source = attributeTo(run);
      return {
        id: String(person._id),
        name: person.name,
        employeeId: person.employeeId,
        designation: person.designation,
        jobFamily: person.jobFamily,
        sharedFrom: run.from,
        sharedTo: run.to,
        via: { ...source, name: nameOf.get(source.id) || null },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { ...empty, candidates };
};

// The same exclusion, asked on its own: whoever an addition to a list must not be.
const notPeersOf = async (userId, { from, to }) => {
  const start = toDay(from, "from");
  const end = toDay(to, "to");
  const inReach = overlapping(
    addMonths(start, -(PEER_ELIGIBILITY_MONTHS + PEER_CONTINUITY_GAP_MONTHS)),
    end,
  );
  const units = await UnitMembership.find({ userId, ...inReach }).select("unitId");
  return outsidePeerRelationship(userId, unique(units.map((u) => u.unitId)), inReach);
};

module.exports = {
  candidatesFor,
  notPeersOf,
  spansMonths,
  addMonths,
  intersect,
  joinStretches,
};
