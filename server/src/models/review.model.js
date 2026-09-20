const mongoose = require("mongoose");
const { REVIEW_STATUS, SUMMARY_CHECK_ACTIONS } = require("../config/constants");

// One per employee per cycle: the container every feedback record hangs off.

const periodSchema = new mongoose.Schema(
  {
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "OrgUnit" },
    from: Date,
    to: Date,

    // ⚠️ Informational only; the duration weighting was withdrawn. Nothing may calculate with it.
    months: Number,
  },
  { _id: false },
);

// HR's check of the supervisor's colleague summary. Appended, never edited: a clearance counts
// only while it is later than the supervisor record's current submission.
const summaryCheckSchema = new mongoose.Schema(
  {
    action: { type: String, enum: SUMMARY_CHECK_ACTIONS, required: true },
    officerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, default: null },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const reviewSchema = new mongoose.Schema(
  {
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cycle",
      required: [true, "cycleId is required"],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
      index: true,
    },

    status: { type: String, enum: REVIEW_STATUS, default: "pending" },

    // Who the person was when the review was created. Never recomputed.
    snapshot: {
      designation: String,
      level: String,
      jobFamily: String,
      unitId: { type: mongoose.Schema.Types.ObjectId, ref: "OrgUnit" },
      parentUnitId: { type: mongoose.Schema.Types.ObjectId, ref: "OrgUnit" },
      projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
      parGroup: String,

      // ⚠️ Written at publication and never recomputed: the constants file only ever reports
      // today's numbers. HR-visible only.
      rulesInForce: {
        peerCount: Number,
        peerDisplayThreshold: Number,
        upwardThreshold: Number,
        eligibilityMonths: Number,
        graceWindowHours: Number,
      },
    },

    // From the unit-lead history at creation, [from, to); nothing is merged across periods.
    periods: { type: [periodSchema], default: [] },

    // ⚠️ For HR and the supervisor's send-back notice only. The employee never learns that a
    // check happened, that a summary went back, or why.
    checks: { type: [summaryCheckSchema], default: [] },

    rawOverall: { type: Number, default: null },
    normalisedOverall: { type: Number, default: null },
    publishedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },

    // A withdrawn review that is later published keeps its withdrawal date, so the record
    // shows it was set aside and picked up again rather than quietly reappearing.
    reinstatedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One review per employee per cycle.
reviewSchema.index({ cycleId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
