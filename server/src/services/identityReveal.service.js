const Feedback = require("../models/feedback.model");
const Review = require("../models/review.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { isConfidential } = require("./feedback.privacy");
const {
  assertMayActOnEmployee,
  assertNotInReportingLine,
} = require("./coverageAuth.service");

// ⚠️ The only place a confidential reviewer's name is looked up on purpose. The record is
// addressed by its random label, which is the sole handle anyone reading the feedback holds:
// an officer cannot ask about a record they were never shown.

const HR_ROLES = ["hr", "head_of_hr"];
const ACTION = "reveal who wrote this feedback";

// ⚠️ The reason is not stored anywhere yet: there is no audit collection. The response says so
// rather than implying a record exists, and the field moves to the log when that is built.
exports.revealAuthor = async ({ reviewId, label, reason }, actor) => {
  const review = await Review.findById(reviewId).select("userId");
  if (!review) throw new AppError("Review not found", 404);

  // Nobody reveals an identity on their own appraisal, whatever they hold. The same refusal
  // as a review that does not exist, so the refusal itself tells them nothing.
  if (String(review.userId) === String(actor.id)) {
    throw new AppError("Review not found", 404);
  }

  if (!(actor?.roles || []).some((role) => HR_ROLES.includes(role))) {
    throw new AppError("You do not have permission for this action", 403);
  }

  const now = new Date();
  await assertMayActOnEmployee(actor, review.userId, now, ACTION);
  await assertNotInReportingLine(actor, review.userId, now, ACTION);

  const record = await Feedback.findOne({ reviewId, label }).select("+reviewerId");
  if (!record) throw new AppError("That feedback was not found on this review", 404);

  if (!isConfidential(record.reviewerType)) {
    throw new AppError("That feedback already names its author", 400);
  }

  // An unsubmitted draft has nothing in it to justify breaking the promise.
  if (!record.submittedAt) {
    throw new AppError("That feedback has not been submitted yet", 409);
  }

  const reviewer = await User.findById(record.reviewerId).select("name");

  // ⚠️ Both names are ones the identity guard refuses unmarked, deliberately: if this shape is
  // ever copied to a route that forgets the mark, the guard catches it instead of serving it.
  return {
    reviewId: String(reviewId),
    label,
    reviewerId: String(record.reviewerId),
    reviewerName: reviewer?.name || null,
    submittedAt: record.submittedAt,
    reason: reason.trim(),
    recorded: false,
  };
};
