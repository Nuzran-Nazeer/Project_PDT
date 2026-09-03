const crypto = require("crypto");

const Review = require("../models/review.model");
const Feedback = require("../models/feedback.model");
const AppError = require("../utils/AppError");
const { getCycleById, peopleInCycle } = require("./cycle.service");
const { candidatesFor } = require("./reviewerPool.service");
const { PEER_REVIEWS_TARGET } = require("../config/constants");

// Opening the containers a cycle's feedback hangs off, and choosing who writes it.

// crypto rather than Math.random: this decides whose appraisal somebody contributes to,
// and a predictable shuffle is a question nobody should have to answer.
const shuffled = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * One review per person the cycle covers. Idempotent: running it twice adds nothing,
 * so it is safe to call again after somebody joins the group.
 *
 * Anyone in no unit is skipped rather than given an empty review, which is the same
 * rule the coverage list already applies: no unit means no supervisor and no appraisal.
 */
const openReviewsForCycle = async (cycleId) => {
  const { cycle, items } = await peopleInCycle(cycleId);

  const appraised = items.filter((p) => p.appraised);
  const existing = await Review.find({ cycleId: cycle._id }).select("userId").lean();
  const have = new Set(existing.map((r) => String(r.userId)));

  const missing = appraised.filter((p) => !have.has(String(p._id)));

  // ⚠️ `snapshot` and `periods` are left unset. They are not optional to the design,
  // only to this step: nothing may publish until whatever fills them exists.
  const created = missing.length
    ? await Review.insertMany(
        missing.map((p) => ({ cycleId: cycle._id, userId: p._id, status: "pending" })),
      )
    : [];

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

/**
 * Pick this person's colleague reviewers and record the assignment.
 *
 * ⚠️ ONE POOL PER PERSON PER CYCLE. A second call is refused rather than topping the
 * pool up: re-drawing would let anyone who saw the first list narrow down the second.
 *
 * Labels are dealt here, at selection, so arrival order carries no information later.
 */
const assignPeerReviewers = async (reviewId, { target = PEER_REVIEWS_TARGET } = {}) => {
  const review = await getReviewById(reviewId);
  const cycle = await getCycleById(review.cycleId);

  const already = await Feedback.countDocuments({
    reviewId: review._id,
    reviewerType: "peer",
  });
  if (already > 0) {
    throw new AppError(
      "Colleague reviewers have already been chosen for this review",
      409,
    );
  }

  const { candidates, sources } = await candidatesFor(review.userId._id, {
    from: cycle.startDate,
    to: cycle.endDate,
  });

  const picked = shuffled(candidates).slice(0, target);

  // ⚠️ The form the answers were given against, stored so a later edit to the
  // competency list cannot change what a past review was asking. There is no template
  // collection yet, so the reviewee's job family stands in for one.
  const formTemplateKey = review.userId.jobFamily;
  const formTemplateVersion = 1;

  const assigned = picked.length
    ? await Feedback.insertMany(
        picked.map((person, i) => ({
          reviewId: review._id,
          reviewerId: person.id,
          revieweeId: review.userId._id,
          reviewerType: "peer",
          formTemplateKey,
          formTemplateVersion,
          status: "assigned",
          label: `tm${i + 1}`,
        })),
      )
    : [];

  return {
    reviewId: String(review._id),
    revieweeId: String(review.userId._id),
    assigned: assigned.length,
    available: candidates.length,
    target,
    // Both are shortfalls the caller must be able to state rather than hide.
    short: assigned.length < target,
    sources,
  };
};

module.exports = { openReviewsForCycle, getReviewById, assignPeerReviewers, shuffled };
