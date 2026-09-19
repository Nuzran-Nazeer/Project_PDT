const mongoose = require("mongoose");
const { MONITORING_FLAG_TYPES, MONITORING_FLAG_STATUS } = require("../config/constants");

// What the trail raised on its own, so that misuse is found without reading the whole log.
// ⚠️ A flag names the officer it concerns and never a reviewer: it is raised from audit
// entries, which do not carry one either.
const monitoringFlagSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, "type is required"],
      enum: { values: MONITORING_FLAG_TYPES, message: "{VALUE} is not a monitoring flag" },
    },

    officerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "officerId is required"],
    },

    // The cycle the activity belongs to. Null only where no cycle could be resolved.
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: "Cycle", default: null },

    // How many times this has now happened, and the line it crossed where there is one.
    count: { type: Number, default: 1 },
    threshold: { type: Number, default: null },

    detail: { type: String, default: null, trim: true },

    raisedAt: { type: Date, required: true, default: Date.now },
    lastEventAt: { type: Date, required: true, default: Date.now },

    status: {
      type: String,
      enum: { values: MONITORING_FLAG_STATUS, message: "{VALUE} is not a flag status" },
      default: "open",
    },

    note: { type: String, default: null, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: false },
);

// ⚠️ Neither field carries `index: true` as well: two definitions fight over the same index
// name and Mongoose keeps the first, silently discarding the second.
monitoringFlagSchema.index({ type: 1, officerId: 1, cycleId: 1, status: 1 });
monitoringFlagSchema.index({ status: 1, lastEventAt: -1 });

module.exports = mongoose.model("MonitoringFlag", monitoringFlagSchema);
