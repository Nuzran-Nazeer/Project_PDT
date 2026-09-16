const mongoose = require("mongoose");
const { HR_COVERAGE_ROLES } = require("../config/constants");

// Direct facts only; coverageOn() in hrcoverage.service.js resolves inheritance. A unit
// may hold two open records at once, one per role.
const hrCoverageSchema = new mongoose.Schema(
  {
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      required: [true, "unitId is required"],
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
    },

    role: {
      type: String,
      required: [true, "role is required"],
      enum: {
        values: HR_COVERAGE_ROLES,
        message: "{VALUE} is not a valid coverage role",
      },
    },

    from: { type: Date, required: [true, "from is required"] },

    to: { type: Date, default: null },
  },
  { timestamps: true },
);

hrCoverageSchema.index({ unitId: 1, from: 1 });
hrCoverageSchema.index({ userId: 1, from: 1 });

// One open record per unit and role. ⚠️ Never `index: true` on `unitId`: the names collide
// and the second index is silently dropped.
hrCoverageSchema.index(
  { unitId: 1, role: 1 },
  { unique: true, partialFilterExpression: { to: null } },
);

module.exports = mongoose.model("HrCoverage", hrCoverageSchema);
