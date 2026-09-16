const mongoose = require("mongoose");
const { CYCLE_STATUS, PAR_GROUPS } = require("../config/constants");

// One annual run for one PAR group, never the whole company: three groups run staggered.
const cycleSchema = new mongoose.Schema(
  {
    parGroup: {
      type: String,
      enum: PAR_GROUPS,
      required: [true, "parGroup is required"],
    },

    year: { type: Number, required: [true, "year is required"] },

    // The period assessed, not the period administered.
    startDate: { type: Date, required: [true, "startDate is required"] },
    endDate: { type: Date, required: [true, "endDate is required"] },

    status: { type: String, enum: CYCLE_STATUS, default: "draft" },

    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ⚠️ The cancellation window runs from opening, never from `createdAt`.
    openedOn: { type: Date, default: null },

    cancelledOn: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Required only when cancelling, so the service enforces it, not the schema.
    cancelReason: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

// One live cycle per group per year; a cancelled one makes way for its replacement.
cycleSchema.index(
  { parGroup: 1, year: 1 },
  { unique: true, partialFilterExpression: { cancelledOn: null } },
);

cycleSchema.index({ parGroup: 1, status: 1 });

module.exports = mongoose.model("Cycle", cycleSchema);
