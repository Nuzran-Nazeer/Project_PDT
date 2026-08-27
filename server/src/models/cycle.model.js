const mongoose = require("mongoose");
const { CYCLE_STATUS, PAR_GROUPS } = require("../config/constants");

// One annual run of the review process for one PAR group. Three groups run staggered
// and may all be live at once, so a cycle covers a group, never the whole company.
// The stages are in config/constants.js, where the ORDER is the rule.
const cycleSchema = new mongoose.Schema(
  {
    parGroup: {
      type: String,
      enum: PAR_GROUPS,
      required: [true, "parGroup is required"],
    },

    year: { type: Number, required: [true, "year is required"] },

    // The period assessed, not the period administered. All the work happens in the
    // closing stretch, which is why the 30-day cancellation window is safe.
    startDate: { type: Date, required: [true, "startDate is required"] },
    endDate: { type: Date, required: [true, "endDate is required"] },

    status: { type: String, enum: CYCLE_STATUS, default: "draft" },

    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ⚠️ Not `createdAt`: the cancellation window runs from OPENING, so a cycle
    // drafted in January and opened in June would expire before it opened.
    openedOn: { type: Date, default: null },

    cancelledOn: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Required when cancelling and only then, so the service enforces it rather than
    // the schema, which would block every draft.
    cancelReason: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

// One live cycle per group per year. Partial on `cancelledOn: null` deliberately: a
// plain unique key would refuse the replacement that cancelling exists to allow.
//
// ⚠️ Neither field carries `index: true`. Mongoose will not alter an index already
// existing under that name: the first wins and the second is discarded silently.
cycleSchema.index(
  { parGroup: 1, year: 1 },
  { unique: true, partialFilterExpression: { cancelledOn: null } },
);

cycleSchema.index({ parGroup: 1, status: 1 });

module.exports = mongoose.model("Cycle", cycleSchema);
