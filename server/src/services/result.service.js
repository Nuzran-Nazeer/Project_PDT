const Cycle = require("../models/cycle.model");
const Feedback = require("../models/feedback.model");
const Review = require("../models/review.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const {
  competenciesFor,
  hasColleagueSection,
  PEER_DISPLAY_THRESHOLD,
  PUBLISHED_STATES,
} = require("../config/constants");

// The employee's own read of their published result, and the acknowledgement that closes it.
// Everything here is the employee's own record, so there is no coverage or supervision gate:
// the account in the token is the only key.

const asCycle = (cycle) =>
  cycle
    ? {
        id: String(cycle._id),
        parGroup: cycle.parGroup,
        year: cycle.year,
        status: cycle.status,
      }
    : null;

const publishedReviewFor = (userId) =>
  Review.findOne({ userId, status: { $in: PUBLISHED_STATES } }).sort({ publishedAt: -1 });

// ⚠️ Re-selecting the author is allowed only because a supervisor review is attributed by
// design. The name is copied out and the record itself never reaches the response.
const supervisorDocFor = (reviewId) =>
  Feedback.findOne({ reviewId, reviewerType: "supervisor" })
    .select("+reviewerId")
    .populate("reviewerId", "name")
    .sort({ submittedAt: -1 });

const peerCountFor = (reviewId) =>
  Feedback.countDocuments({ reviewId, reviewerType: "peer" });

const noSummary = () => ({
  present: false,
  text: null,
  reason: "below_minimum",
  note: `The minimum peer feedback requirement of ${PEER_DISPLAY_THRESHOLD} has not been met.`,
});

// ⚠️ Evidence without the score. The raw overall is the average of these six, so serving the
// scores lets the employee recover the figure the adjusted overall exists to replace.
const asWords = (ratings = []) =>
  ratings.map((row) => ({
    competencyKey: row.competencyKey,
    notObserved: row.notObserved,
    evidence: row.evidence,
  }));

const asResult = ({ review, cycle, doc, colleagueSection, jobFamily }) => ({
  state: "published",
  reviewId: String(review._id),
  cycle: asCycle(cycle),
  supervisor: doc.reviewerId?.name
    ? { id: String(doc.reviewerId._id), name: doc.reviewerId.name }
    : null,
  publishedAt: review.publishedAt,
  acknowledgedAt: review.acknowledgedAt,
  canAcknowledge: !review.acknowledgedAt,
  supervisorReview: {
    competencies: competenciesFor(jobFamily),
    ratings: asWords(doc.ratings),
    freeText: doc.freeText,
  },
  colleagueSummary: colleagueSection
    ? { present: true, text: doc.colleagueSummary || null, reason: null, note: null }
    : noSummary(),
});

// Nothing published: the most recent review says whether one was withdrawn at publication.
// ⚠️ No reason is served with it, and none is stored, so none can leak.
const emptyResultFor = async (userId) => {
  const latest = await Review.findOne({ userId })
    .sort({ createdAt: -1 })
    .select("status");
  return {
    state: latest?.status === "withdrawn" ? "withdrawn" : "none",
    reviewId: null,
  };
};

const resultFor = async (userId) => {
  const review = await publishedReviewFor(userId);
  if (!review) return emptyResultFor(userId);

  const [cycle, doc, peerCount] = await Promise.all([
    Cycle.findById(review.cycleId).select("parGroup year status"),
    supervisorDocFor(review._id),
    peerCountFor(review._id),
  ]);

  // Publication requires a settled supervisor review, so this cannot be reached by any route
  // through the product; it is here so a repaired record fails plainly instead of throwing.
  if (!doc) {
    throw new AppError(
      "This result cannot be shown: its supervisor review is missing",
      409,
    );
  }

  // The family the review was opened under decides the wording, never today's: a move to
  // another family must not relabel what a past review asked about.
  const jobFamily =
    review.snapshot?.jobFamily ||
    (await User.findById(userId).select("jobFamily"))?.jobFamily ||
    null;

  return asResult({
    review,
    cycle,
    doc,
    jobFamily,
    colleagueSection: hasColleagueSection(peerCount),
  });
};

// One action, recorded once. Reading it back through resultFor keeps the screen and the
// acknowledgement answering from the same function.
const acknowledgeResult = async (userId) => {
  const review = await publishedReviewFor(userId);
  if (!review) throw new AppError("You have no published result to acknowledge", 409);
  if (review.acknowledgedAt) {
    throw new AppError("You have already acknowledged this result", 409);
  }

  review.status = "acknowledged";
  review.acknowledgedAt = new Date();
  await review.save();

  return resultFor(userId);
};

module.exports = { resultFor, acknowledgeResult };
