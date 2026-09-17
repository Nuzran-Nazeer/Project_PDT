const crypto = require("crypto");

const Cycle = require("../models/cycle.model");
const Feedback = require("../models/feedback.model");
const OrgUnit = require("../models/orgunit.model");
const ProjectAssignment = require("../models/projectassignment.model");
const Review = require("../models/review.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { toDay, dayAfter, overlapping } = require("../utils/dateRange");
const { peopleInCycle } = require("./cycle.service");
const { membershipOn } = require("./unitmembership.service");
const { supervisorPeriods, reportingLineOn } = require("./supervision.service");
const { hasSettled } = require("./feedback.window");
const {
  PEER_REVIEWS_TARGET,
  PEER_DISPLAY_THRESHOLD,
  PEER_ELIGIBILITY_MONTHS,
  FEEDBACK_EDIT_WINDOW_HOURS,
} = require("../config/constants");

// Once published a review is somebody's record; none of these may be published again.
const PUBLISHED_STATES = ["published", "acknowledged", "under_appeal"];

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

// ⚠️ The one function that decides what a published review carries. Normalisation writes its
// figure onto the review before this runs and changes nothing here. Upward feedback is not
// collected, so its threshold is recorded as none.
const publishOne = (review, now) => {
  review.status = "published";
  review.publishedAt = now;
  review.snapshot.rulesInForce = {
    peerCount: PEER_REVIEWS_TARGET,
    peerDisplayThreshold: PEER_DISPLAY_THRESHOLD,
    upwardThreshold: null,
    eligibilityMonths: PEER_ELIGIBILITY_MONTHS,
    graceWindowHours: FEEDBACK_EDIT_WINDOW_HOURS,
  };
};

// Why this review cannot publish yet, or null. Named by the supervisor expected to write it
// today, which is a reporting-line fact, never the record's author.
const outstandingFor = async (review, day) => {
  const doc = await Feedback.findOne({
    reviewId: review._id,
    reviewerType: "supervisor",
  }).select("status submittedAt locksAt");

  if (doc && hasSettled(doc)) return null;

  const line = await reportingLineOn(review.userId, day);
  return {
    reviewId: String(review._id),
    employee: line.employee,
    supervisor: line.supervisor,
    reason: doc?.submittedAt
      ? `submitted less than ${FEEDBACK_EDIT_WINDOW_HOURS} hours ago`
      : "not submitted",
  };
};

const describe = (item) =>
  `${item.employee.name} (supervisor: ${item.supervisor ? item.supervisor.name : "nobody appointed"}), ${item.reason}`;

const refuseOutstanding = (outstanding) => {
  const error = new AppError(
    `Publishing is refused: ${outstanding.length} supervisor ${
      outstanding.length === 1 ? "review is" : "reviews are"
    } outstanding. ${outstanding.map(describe).join("; ")}.`,
    409,
  );
  error.details = { outstanding };
  return error;
};

// Runs as the cycle moves into published, before the stage changes: a refusal leaves it where
// it was. A review without a settled supervisor review is withdrawn when its person is in no
// unit today, since nobody can write it, and refuses the whole cycle otherwise.
const publishCycle = async (cycleId) => {
  const now = new Date();
  const today = toDay(now, "date");
  const reviews = await Review.find({
    cycleId,
    status: { $nin: [...PUBLISHED_STATES, "withdrawn"] },
  });

  const toWithdraw = [];
  const toPublish = [];
  const outstanding = [];

  for (const review of reviews) {
    const problem = await outstandingFor(review, today);
    if (!problem) toPublish.push(review);
    else if (!(await membershipOn(review.userId, today))) toWithdraw.push(review);
    else outstanding.push(problem);
  }

  if (outstanding.length) throw refuseOutstanding(outstanding);

  for (const review of toWithdraw) {
    review.status = "withdrawn";
    review.withdrawnAt = now;
    await review.save();
  }
  for (const review of toPublish) {
    publishOne(review, now);
    await review.save();
  }

  return { published: toPublish.length, withdrawn: toWithdraw.length };
};

// One review left out of its cycle's publish, once its supervisor review is in.
const publishReview = async (reviewId) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError("Review not found", 404);

  if (PUBLISHED_STATES.includes(review.status)) {
    throw new AppError("This review has already been published", 409);
  }

  const cycle = await Cycle.findById(review.cycleId).select("status");
  if (!cycle || cycle.status !== "published") {
    throw new AppError(
      "A review can only be published on its own once its cycle has been published",
      409,
    );
  }

  const now = new Date();
  const problem = await outstandingFor(review, toDay(now, "date"));
  if (problem) throw refuseOutstanding([problem]);

  publishOne(review, now);
  await review.save();
  return review;
};

module.exports = {
  openReviewsForCycle,
  getReviewById,
  shuffled,
  publishCycle,
  publishReview,
  PUBLISHED_STATES,
};
