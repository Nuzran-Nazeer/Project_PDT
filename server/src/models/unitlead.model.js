const mongoose = require("mongoose");

// ⚠️ Where supervision lives: your supervisor on a date is the lead of your unit on that
// date. There is no `supervisorId` anywhere.
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

unitLeadSchema.index({ unitId: 1, from: 1 });
unitLeadSchema.index({ userId: 1, from: 1 });

// One open lead per unit. ⚠️ Never `index: true` on `unitId`: the names collide and the
// second index is silently dropped.
unitLeadSchema.index(
  { unitId: 1 },
  { unique: true, partialFilterExpression: { to: null } },
);

module.exports = mongoose.model("UnitLead", unitLeadSchema);
