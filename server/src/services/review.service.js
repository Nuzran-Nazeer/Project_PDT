const crypto = require("crypto");

const Review = require("../models/review.model");
const AppError = require("../utils/AppError");
const { peopleInCycle } = require("./cycle.service");

// crypto rather than Math.random: a predictable shuffle decides whose appraisal somebody joins.
const shuffled = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Idempotent: safe to call again after somebody joins the group. Anyone in no unit is skipped.
const openReviewsForCycle = async (cycleId) => {
  const { cycle, items } = await peopleInCycle(cycleId);

  const appraised = items.filter((p) => p.appraised);
  const existing = await Review.find({ cycleId: cycle._id }).select("userId").lean();
  const have = new Set(existing.map((r) => String(r.userId)));

  const missing = appraised.filter((p) => !have.has(String(p._id)));

  // ⚠️ `snapshot` and `periods` are left unset. Nothing may publish until something fills them.
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
