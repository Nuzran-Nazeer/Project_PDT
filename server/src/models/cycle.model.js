const mongoose = require("mongoose");
const { CYCLE_STATUS, PAR_GROUPS } = require("../config/constants");

// An appraisal cycle: one annual run of the review process for one PAR group.
//
// EVERYTHING ELSE HANGS OFF THIS. A review belongs to a cycle, feedback belongs to a
// review, and a development plan comes out of one. Nothing above it can be built until
// there is a cycle for it to belong to, which is why this is the first piece of the
// Reviews & Feedback epic.
//
// THREE GROUPS RUN STAGGERED, and may all be live at once. Which group a person is in
// is set by the month they joined and never changes, so a cycle covers a group rather
// than the whole company. (Spec §2.1)
//
// The stages are in config/constants.js, in order, because the ORDER is the rule and
// the service checks every requested move against it.
const cycleSchema = new mongoose.Schema(
  {
    parGroup: {
      type: String,
      enum: PAR_GROUPS,
      required: [true, "parGroup is required"],
    },

    year: { type: Number, required: [true, "year is required"] },

    // The period the cycle assesses, not the period it is administered in. Everything
    // -- self-assessments, colleague feedback, the supervisor's review -- happens in
    // the closing stretch, which is why the 30-day cancellation window is safe.
    startDate: { type: Date, required: [true, "startDate is required"] },
    endDate: { type: Date, required: [true, "endDate is required"] },

    status: { type: String, enum: CYCLE_STATUS, default: "draft" },

    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // NOT the same as `createdAt`, and the difference matters. The cancellation window
    // runs from OPENING, so a cycle drafted in January and opened in June would have
    // had its window expire before it ever opened if this were read off the timestamp.
    openedOn: { type: Date, default: null },

    cancelledOn: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Required when cancelling, and only then, so it cannot be required here without
    // blocking every draft. The service refuses a cancel without one. (Spec §2.9)
    cancelReason: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

// ---------------------------------------------------------------------------
// One live cycle per group per year
// ---------------------------------------------------------------------------
// The database-level backstop for criterion 2. The service checks it first and gives a
// readable message; this catches anything that reaches the collection another way.
//
// PARTIAL, ON `cancelledOn: null`, AND THAT IS THE POINT. A plain unique key on
// parGroup + year would make cancelling useless: the whole reason to cancel inside 30
// days is to open a replacement, and a hard constraint would refuse the replacement for
// the rest of the year. A cancelled cycle carries a date here and drops out of the
// index, so it blocks nothing.
//
// ⚠️ Neither field carries `index: true`. A single-field index is named after its
// field, and Mongoose will not alter an index that already exists under a name -- the
// first one wins and the second is discarded with no error and no warning. See the
// build rules.
cycleSchema.index(
  { parGroup: 1, year: 1 },
  { unique: true, partialFilterExpression: { cancelledOn: null } },
);

// "Which cycle is this group in", the question the dashboards ask on every load.
cycleSchema.index({ parGroup: 1, status: 1 });

module.exports = mongoose.model("Cycle", cycleSchema);
