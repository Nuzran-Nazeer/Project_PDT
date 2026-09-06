const mongoose = require("mongoose");
const { HR_COVERAGE_ROLES } = require("../config/constants");

// Which HR officer is responsible for a unit. Coverage reaches a unit's sub-units too,
// unless a sub-unit has its own direct record, which takes over entirely for that
// sub-unit -- see coverageOn() in hrcoverage.service.js, the one place that resolves
// this. Nothing here stores the resolved answer, only the direct facts it is built
// from.
//
// A unit may hold TWO open records at once, one per role, unlike UnitLead's single
// slot: a primary and a backup are both real coverage, not a handover in progress.
//
// Period convention as every dated collection; see utils/dateRange.js.
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

// Neither field carries `index: true`, for the naming reason on the membership model.
hrCoverageSchema.index({ unitId: 1, from: 1 });
hrCoverageSchema.index({ userId: 1, from: 1 });

// A database backstop for "one primary and one backup at a time", scoped to the
// UNIT+ROLE pair so a primary and a backup can both be open without tripping it, but
// two open primaries on the same unit cannot. `partialFilterExpression` applied only
// where `to` is null reads as "among this unit's OPEN records for this role, exactly
// one".
hrCoverageSchema.index(
  { unitId: 1, role: 1 },
  { unique: true, partialFilterExpression: { to: null } },
);

module.exports = mongoose.model("HrCoverage", hrCoverageSchema);
