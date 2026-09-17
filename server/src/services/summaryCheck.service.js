const Cycle = require("../models/cycle.model");
const Feedback = require("../models/feedback.model");
const Review = require("../models/review.model");
const AppError = require("../utils/AppError");
const { assertHrMayRead, readScopeFor } = require("./coverageAuth.service");
const { collectedFor } = require("./feedback.service");
const { reportingLineOn } = require("./supervision.service");
const { hasSettled } = require("./feedback.window");
const {
  lastCheck,
  isCleared,
  pendingSendBack,
  hasEnteredNormalisation,
} = require("./summaryCheck.state");
const {
  competenciesFor,
  hasColleagueSection,
  FEEDBACK_EDIT_WINDOW_HOURS,
  PUBLISHED_STATES,
  CYCLE_CANCELLED,
} = require("../config/constants");

// HR's check of the supervisor's colleague summary against the raw responses, before
// normalisation. The check is owed while the supervisor record is settled, the review has a
// colleague section, and no clearance is later than the current submission.

const notFound = () => new AppError("Review not found", 404);

const asPerson = (user) =>
  user
    ? {
        id: String(user._id),
        name: user.name,
        employeeId: user.employeeId,
        designation: user.designation,
      }
    : null;

const asCycle = (cycle) =>
  cycle
    ? {
        id: String(cycle._id),
        parGroup: cycle.parGroup,
        year: cycle.year,
        status: cycle.status,
      }
    : null;

const asCheck = (check) => ({
  action: check.action,
  officer: check.officerId?.name
    ? { id: String(check.officerId._id), name: check.officerId.name }
    : { id: String(check.officerId), name: null },
  at: check.at,
  reason: check.reason,
});

// Time-bearing fields on this record are the supervisor's, who is attributed by design.
const supervisorDocFor = (reviewId) =>
  Feedback.findOne({ reviewId, reviewerType: "supervisor" }).sort({ submittedAt: -1 });

const peerCountFor = (reviewId) =>
  Feedback.countDocuments({ reviewId, reviewerType: "peer" });

// ⚠️ A coverage refusal is "not found": a 403 naming the unit tells an officer where a
// person sits, which is what coverage exists to hide. The author of the summary is refused
// openly, since they already know the review exists; the other covering officer or the Head
// of HR checks it instead.
const isSupervisorToday = (line, viewer) =>
  Boolean(line.supervisor && String(line.supervisor.id) === String(viewer.id));

const ownSummaryError = () =>
  new AppError(
    "You are this person's supervisor, so another HR officer or the Head of HR must check this summary",
    409,
  );

const assertMayCheck = async (review, viewer, line) => {
  if (String(review.userId?._id || review.userId) === String(viewer.id)) throw notFound();
  await assertHrMayRead(viewer, review.userId?._id || review.userId).catch(() => {
    throw notFound();
  });
  if (isSupervisorToday(line, viewer)) throw ownSummaryError();
};

// ⚠️ Published or withdrawn first: past that door the check history no longer matters.
const stateOf = ({ review, cycle, doc, colleagueSection }) => {
  if ([...PUBLISHED_STATES, "withdrawn"].includes(review.status))
    return "in_normalisation";
  if (pendingSendBack(review, doc)) return "sent_back";
  if (!doc?.submittedAt) return "not_submitted";
  if (!hasSettled(doc)) return "in_window";
  if (!colleagueSection) return "no_section";
  if (hasEnteredNormalisation({ review, cycle, supervisorDoc: doc, colleagueSection })) {
    return "in_normalisation";
  }
  if (isCleared(review, doc)) return "cleared";
  return "owed";
};

const REFUSALS = {
  sent_back: "This summary has been sent back and is with the supervisor",
  not_submitted:
    "The supervisor's review has not been submitted, so there is no summary to check yet",
  in_window: `The supervisor's review was submitted less than ${FEEDBACK_EDIT_WINDOW_HOURS} hours ago and may still change; the check opens once it settles`,
  no_section: "This review has no colleague section, so there is no summary to check",
  in_normalisation:
    "This review has entered normalisation, so its summary can no longer be sent back",
  cleared: "This summary has already been cleared",
};

const loadContext = async (reviewId, viewer) => {
  const review = await Review.findById(reviewId)
    .populate("userId", "name employeeId designation jobFamily")
    .populate("checks.officerId", "name");
  if (!review || !review.userId) throw notFound();

  const line = await reportingLineOn(review.userId._id, new Date());
  await assertMayCheck(review, viewer, line);

  const [cycle, doc, peerCount] = await Promise.all([
    Cycle.findById(review.cycleId).select("parGroup year status"),
    supervisorDocFor(review._id),
    peerCountFor(review._id),
  ]);

  const colleagueSection = hasColleagueSection(peerCount);
  return {
    review,
    line,
    cycle,
    doc,
    colleagueSection,
    state: stateOf({ review, cycle, doc, colleagueSection }),
  };
};

// The supervisor's record, released to HR once settled: what is written and not sent is theirs.
const asSupervisorReview = (doc, state, jobFamily) => {
  const shell = { competencies: competenciesFor(jobFamily) };
  if (!doc || ["not_submitted", "in_window", "sent_back"].includes(state)) {
    return {
      ...shell,
      available: false,
      reason: state === "in_window" ? "in_window" : "not_submitted",
      ratings: [],
      freeText: { strengths: null, development: null },
      colleagueSummary: null,
    };
  }
  return {
    ...shell,
    available: true,
    reason: null,
    ratings: doc.ratings,
    freeText: doc.freeText,
    colleagueSummary: doc.colleagueSummary,
  };
};

const checkScreenFrom = async (context, viewer) => {
  const { review, line, cycle, doc, colleagueSection, state } = context;

  return {
    reviewId: String(review._id),
    employee: asPerson(review.userId),
    supervisor: line.supervisor,
    cycle: asCycle(cycle),
    colleagueSection,
    state,
    canClear: state === "owed",
    canSendBack: state === "owed" || state === "cleared",
    supervisorReview: asSupervisorReview(doc, state, review.userId.jobFamily),
    responses: colleagueSection ? await collectedFor(review._id, viewer) : null,
    history: (review.checks || []).map(asCheck),
  };
};

const checkScreenFor = async (reviewId, viewer) =>
  checkScreenFrom(await loadContext(reviewId, viewer), viewer);

const clearSummary = async (reviewId, viewer) => {
  const context = await loadContext(reviewId, viewer);
  if (context.state !== "owed") throw new AppError(REFUSALS[context.state], 409);

  context.review.checks.push({ action: "cleared", officerId: viewer.id, at: new Date() });
  await context.review.save();
  await context.review.populate("checks.officerId", "name");

  return checkScreenFrom({ ...context, state: "cleared" }, viewer);
};

// ⚠️ The supervisor record goes back to a draft in full, not the summary alone: the next
// submission gets a fresh time, so the clearance rule re-owes the check on its own.
const sendBack = async (reviewId, viewer, reason) => {
  const context = await loadContext(reviewId, viewer);
  if (!["owed", "cleared"].includes(context.state)) {
    throw new AppError(REFUSALS[context.state], 409);
  }

  const { review, doc } = context;
  const at = new Date();
  review.checks.push({ action: "sent_back", officerId: viewer.id, reason, at });
  await review.save();
  await review.populate("checks.officerId", "name");

  doc.status = "draft";
  doc.submittedAt = null;
  doc.locksAt = null;
  await doc.save();

  return checkScreenFrom({ ...context, state: "sent_back" }, viewer);
};

// Every summary owed a check within the viewer's coverage, oldest settlement first. The
// list and the screen answer "owed" with the same function, so they can never disagree.
const listOwed = async (viewer) => {
  const now = new Date();

  // ⚠️ Settled means past `locksAt`, never `status: "locked"`, which is only set on load.
  const settledDocs = await Feedback.find({
    reviewerType: "supervisor",
    submittedAt: { $ne: null },
    locksAt: { $lte: now },
  }).select("reviewId submittedAt locksAt status colleagueSummary");

  const docByReview = new Map(settledDocs.map((d) => [String(d.reviewId), d]));
  const reviews = await Review.find({
    _id: { $in: [...docByReview.keys()] },
    status: { $nin: [...PUBLISHED_STATES, "withdrawn"] },
  })
    .populate("userId", "name employeeId designation")
    .populate("checks.officerId", "name");

  const inScope = await readScopeFor(viewer, {
    on: now,
    asHr: true,
    includeUnplaced: false,
  });
  const candidates = reviews.filter(
    (r) =>
      r.userId && inScope(r.userId._id) && String(r.userId._id) !== String(viewer.id),
  );

  const cycleIds = [...new Set(candidates.map((r) => String(r.cycleId)))];
  const cycles = await Cycle.find({ _id: { $in: cycleIds } }).select(
    "parGroup year status",
  );
  const cycleById = new Map(cycles.map((c) => [String(c._id), c]));

  const peers = await Feedback.aggregate([
    { $match: { reviewId: { $in: candidates.map((r) => r._id) }, reviewerType: "peer" } },
    { $group: { _id: "$reviewId", count: { $sum: 1 } } },
  ]);
  const peerCount = new Map(peers.map((p) => [String(p._id), p.count]));

  const items = [];
  for (const review of candidates) {
    const cycle = cycleById.get(String(review.cycleId));
    if (!cycle || cycle.status === CYCLE_CANCELLED) continue;

    const doc = docByReview.get(String(review._id));
    const colleagueSection = hasColleagueSection(peerCount.get(String(review._id)) || 0);
    if (stateOf({ review, cycle, doc, colleagueSection }) !== "owed") continue;

    const line = await reportingLineOn(review.userId._id, now);
    if (isSupervisorToday(line, viewer)) continue;

    const last = lastCheck(review);
    items.push({
      reviewId: String(review._id),
      employee: asPerson(review.userId),
      supervisor: line.supervisor,
      cycle: asCycle(cycle),
      settledAt: doc.locksAt,
      summaryEmpty: !doc.colleagueSummary || !doc.colleagueSummary.trim(),
      lastCheck: last ? asCheck(last) : null,
    });
  }

  items.sort((a, b) => a.settledAt.getTime() - b.settledAt.getTime());
  return { items, total: items.length };
};

module.exports = { listOwed, checkScreenFor, clearSummary, sendBack };
