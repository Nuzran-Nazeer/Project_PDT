const mongoose = require("mongoose");
const { REVIEW_STATUS } = require("../config/constants");

// One per employee per cycle: the container every feedback record hangs off. It is what
// ties a piece of feedback to a period, which is why nothing can be assigned without it.

// ⚠️ SHAPE COMPLETE, POPULATION DELIBERATELY NOT. `snapshot` and `periods` are defined
// here and written by nothing yet. They are transcribed rather than left out because a
// half-transcribed schema is how a required field gets forgotten, and because
// `snapshot.rulesInForce` is the one the design specifically warns will be dropped as
// unnecessary. Both MUST be populated before any review publishes.

const periodSchema = new mongoose.Schema(
  {
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "OrgUnit" },
    from: Date,
    to: Date,

    // ⚠️ Informational only. It existed to weight two supervisors' ratings by duration
    // and that weighting was withdrawn. Nothing may calculate with it.
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

    // Freezes who the person was when reviewed, so a historical review stays readable
    // after they move unit or change title.
    snapshot: {
      designation: String,
      level: String,
      jobFamily: String,
      unitId: { type: mongoose.Schema.Types.ObjectId, ref: "OrgUnit" },
      parentUnitId: { type: mongoose.Schema.Types.ObjectId, ref: "OrgUnit" },
      projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
      parGroup: String,

      // ⚠️ The one field here that is NOT derivable from anything else. A constants
      // file has no memory and only ever reports today's numbers, so without this the
      // system cannot tell "handled correctly under the rules of the day" from "broke
      // the rules". HR-visible only, never shown to the employee.
      rulesInForce: {
        peerCount: Number,
        peerDisplayThreshold: Number,
        upwardThreshold: Number,
        eligibilityMonths: Number,
        graceWindowHours: Number,
      },
    },

    // Computed when the cycle opens, from the unit-lead history. What makes a
    // multi-supervisor review work: nothing is merged across periods.
    periods: { type: [periodSchema], default: [] },

    rawOverall: { type: Number, default: null },
    normalisedOverall: { type: Number, default: null },
    publishedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One review per employee per cycle. Neither field carries `index: true`, or this
// compound index would collide with a single-field one and be discarded silently.
reviewSchema.index({ cycleId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
