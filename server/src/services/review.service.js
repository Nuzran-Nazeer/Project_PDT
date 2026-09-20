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
const { normalisationReadiness } = require("./summaryCheck.state");
const { assertMayActOnEmployee } = require("./coverageAuth.service");
const {
  PEER_REVIEWS_TARGET,
  PEER_DISPLAY_THRESHOLD,
  PEER_ELIGIBILITY_MONTHS,
  FEEDBACK_EDIT_WINDOW_HOURS,
  PUBLISHED_STATES,
  hasColleagueSection,
} = require("../config/constants");

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

// The supervisor record and whether there is a colleague section, for every review at once:
// two queries for a cycle rather than two per review.
const normalisationInputsFor = async (reviews) => {
  const ids = reviews.map((r) => r._id);

  const docs = await Feedback.find({ reviewId: { $in: ids }, reviewerType: "supervisor" })
    .select("reviewId status submittedAt locksAt")
    .sort({ submittedAt: -1 });
  const docByReview = new Map();
  for (const doc of docs) {
    const key = String(doc.reviewId);
    if (!docByReview.has(key)) docByReview.set(key, doc);
  }

  const peers = await Feedback.aggregate([
    { $match: { reviewId: { $in: ids }, reviewerType: "peer" } },
    { $group: { _id: "$reviewId", count: { $sum: 1 } } },
  ]);
  const peerCount = new Map(peers.map((p) => [String(p._id), p.count]));

  return (review) => ({
    review,
    supervisorDoc: docByReview.get(String(review._id)) || null,
    colleagueSection: hasColleagueSection(peerCount.get(String(review._id)) || 0),
  });
};

// What a review left behind is waiting on. Named by the supervisor expected to write it today,
// which is a reporting-line fact, never the record's author.
const waitingItemFor = async (review, readiness, day) => {
  const line = await reportingLineOn(review.userId, day);
  return {
    reviewId: String(review._id),
    employee: line.employee,
    supervisor: line.supervisor,
    missing: readiness.missing,
    reason: readiness.reason,
  };
};

const describe = (item) =>
  `${item.employee.name} (supervisor: ${item.supervisor ? item.supervisor.name : "nobody appointed"}), ${item.reason}`;

const liveReviewsIn = (cycleId) =>
  Review.find({ cycleId, status: { $nin: [...PUBLISHED_STATES, "withdrawn"] } });

// Runs as the cycle moves into normalising. Nothing is written: a review is in normalisation
// when it is ready and its cycle has moved, and the rest wait, named with what is missing.
const carryIntoNormalisation = async (cycleId) => {
  const today = toDay(new Date(), "date");
  const reviews = await liveReviewsIn(cycleId);
  const inputsFor = await normalisationInputsFor(reviews);

  let carried = 0;
  const waiting = [];
  for (const review of reviews) {
    const readiness = normalisationReadiness(inputsFor(review));
    if (readiness.ready) carried += 1;
    else waiting.push(await waitingItemFor(review, readiness, today));
  }
  return { carried, waiting };
};

// Runs as the cycle moves into published, before the stage changes. Every review that has
// entered normalisation is published; one whose person is in no unit today and whose supervisor
// review never came is withdrawn, since nobody can write it; the rest wait, named.
const publishCycle = async (cycleId) => {
  const now = new Date();
  const today = toDay(now, "date");
  const reviews = await liveReviewsIn(cycleId);
  const inputsFor = await normalisationInputsFor(reviews);

  let published = 0;
  let withdrawn = 0;
  const waiting = [];

  for (const review of reviews) {
    const readiness = normalisationReadiness(inputsFor(review));
    if (readiness.ready) {
      publishOne(review, now);
      await review.save();
      published += 1;
    } else if (
      readiness.missing === "supervisor_review" &&
      !(await membershipOn(review.userId, today))
    ) {
      review.status = "withdrawn";
      review.withdrawnAt = now;
      await review.save();
      withdrawn += 1;
    } else {
      waiting.push(await waitingItemFor(review, readiness, today));
    }
  }

  return { published, withdrawn, waiting };
};

// Every review a published cycle has not released: the ones still waiting, and any that caught
// up and has not been published on its own yet. ⚠️ Closing the cycle is the end of the road for
// all of them, so the guard on that move reads this list.
const stragglersIn = async (cycleId) => {
  const today = toDay(new Date(), "date");
  const reviews = await liveReviewsIn(cycleId);
  const inputsFor = await normalisationInputsFor(reviews);

  const items = [];
  for (const review of reviews) {
    items.push(
      await waitingItemFor(review, normalisationReadiness(inputsFor(review)), today),
    );
  }
  return items;
};

// One review left waiting by its cycle's publish, once it has caught up.
const publishReview = async (reviewId, actor) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError("Review not found", 404);

  // The role gate on the route is coarse. Publication is irreversible, so the officer's
  // coverage decides it, as it does everywhere else an officer acts on one person.
  await assertMayActOnEmployee(actor, review.userId, new Date(), "publish this review");

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

  const wasWithdrawn = review.status === "withdrawn";

  const now = new Date();
  const inputsFor = await normalisationInputsFor([review]);
  const readiness = normalisationReadiness(inputsFor(review));
  if (!readiness.ready) {
    const item = await waitingItemFor(review, readiness, toDay(now, "date"));
    const error = new AppError(`This review is still waiting: ${describe(item)}.`, 409);
    error.details = { waiting: [item] };
    throw error;
  }

  publishOne(review, now);
  if (wasWithdrawn) review.reinstatedAt = now;
  await review.save();
  return review;
};

module.exports = {
  openReviewsForCycle,
  getReviewById,
  shuffled,
  normalisationInputsFor,
  waitingItemFor,
  carryIntoNormalisation,
  stragglersIn,
  publishCycle,
  publishReview,
  PUBLISHED_STATES,
};
