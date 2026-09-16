const crypto = require("crypto");

const OrgUnit = require("../models/orgunit.model");
const ProjectAssignment = require("../models/projectassignment.model");
const Review = require("../models/review.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { toDay, dayAfter, overlapping } = require("../utils/dateRange");
const { peopleInCycle } = require("./cycle.service");
const { membershipOn } = require("./unitmembership.service");
const { supervisorPeriods } = require("./supervision.service");

// crypto rather than Math.random: a predictable shuffle decides whose appraisal somebody joins.
const shuffled = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ⚠️ Written once, when the review is created, and never recomputed: a later correction to
// the history must not rewrite what a past review says happened. `rulesInForce` is not here;
// it is written at publication.
const snapshotFor = async (userId, cycle, day) => {
  const user = await User.findById(userId).select("designation level jobFamily parGroup");
  const membership = await membershipOn(userId, day);
  const unit = membership
    ? await OrgUnit.findById(membership.unitId).select("parentUnitId")
    : null;
  const assignments = await ProjectAssignment.find({
    userId,
    ...overlapping(cycle.startDate, dayAfter(cycle.endDate)),
  }).select("projectId");

  return {
    designation: user?.designation ?? null,
    level: user?.level ?? null,
    jobFamily: user?.jobFamily ?? null,
    unitId: membership?.unitId ?? null,
    parentUnitId: unit?.parentUnitId ?? null,
    projectIds: [...new Set(assignments.map((a) => String(a.projectId)))],
    parGroup: user?.parGroup ?? null,
  };
};

// Idempotent: safe to call again after somebody joins the group. Anyone in no unit is skipped.
const openReviewsForCycle = async (cycleId) => {
  const { cycle, items } = await peopleInCycle(cycleId);

  const appraised = items.filter((p) => p.appraised);
  const existing = await Review.find({ cycleId: cycle._id }).select("userId").lean();
  const have = new Set(existing.map((r) => String(r.userId)));

  const missing = appraised.filter((p) => !have.has(String(p._id)));

  const today = toDay(new Date(), "date");
  const docs = [];
  for (const p of missing) {
    docs.push({
      cycleId: cycle._id,
      userId: p._id,
      status: "pending",
      snapshot: await snapshotFor(p._id, cycle, today),
      periods: await supervisorPeriods(p._id, cycle.startDate, dayAfter(cycle.endDate)),
    });
  }

  const created = docs.length ? await Review.insertMany(docs) : [];

  return {
    cycle,
    created: created.length,
    existing: existing.length,
    skipped: items.length - appraised.length,
  };
};

const getReviewById = async (id) => {
  const review = await Review.findById(id).populate(
    "userId",
    "name employeeId jobFamily",
  );
  if (!review) throw new AppError("Review not found", 404);
  return review;
};

module.exports = { openReviewsForCycle, getReviewById, shuffled };
