const crypto = require("crypto");

const Review = require("../models/review.model");
const AppError = require("../utils/AppError");
const { peopleInCycle } = require("./cycle.service");

// Opening the containers a cycle's feedback hangs off. Choosing who writes it is
// reviewerList.service.js, and goes through a confirmed list.

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
 * Anyone in no unit is skipped rather than given an empty review: no unit means no
 * supervisor and no appraisal.
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

module.exports = { openReviewsForCycle, getReviewById, shuffled };
