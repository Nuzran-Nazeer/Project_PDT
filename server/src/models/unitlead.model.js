const mongoose = require("mongoose");

// ⚠️ Where supervision lives. There is no supervisor collection and no `supervisorId`
// on the User record, because your supervisor on a date is the lead of your unit on
// that date. That indirection is what makes two supervisor periods in one year fall
// out on their own.
//
// Period convention as every dated collection; see utils/dateRange.js.
const unitLeadSchema = new mongoose.Schema(
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

    from: { type: Date, required: [true, "from is required"] },

    to: { type: Date, default: null },
  },
  { timestamps: true },
);

// Neither field carries `index: true`, for the naming reason on the membership
// model.
unitLeadSchema.index({ unitId: 1, from: 1 });
unitLeadSchema.index({ userId: 1, from: 1 });

// The same backstop the membership model carries, keyed on the UNIT, not the person:
// one person may lead several units, but a unit with two leads makes "the lead of your
// unit on that date" ambiguous.
unitLeadSchema.index(
  { unitId: 1 },
  { unique: true, partialFilterExpression: { to: null } },
);

module.exports = mongoose.model("UnitLead", unitLeadSchema);
