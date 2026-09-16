const mongoose = require("mongoose");
const { REVIEW_STATUS } = require("../config/constants");

// One per employee per cycle: the container every feedback record hangs off.
// ⚠️ `snapshot.rulesInForce` is written at publication, which nothing does yet.

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

      // ⚠️ Not derivable: the constants file only ever reports today's numbers. HR-visible only.
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

    rawOverall: { type: Number, default: null },
    normalisedOverall: { type: Number, default: null },
    publishedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One review per employee per cycle.
reviewSchema.index({ cycleId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
