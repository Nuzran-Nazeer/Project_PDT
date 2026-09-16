const mongoose = require("mongoose");

// ⚠️ One record per stint, never overwritten, and never a `unitId` on the User record.
// `to` is the first day not covered, null while open.
const unitMembershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
    },

    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      required: [true, "unitId is required"],
    },

    from: { type: Date, required: [true, "from is required"] },

    to: { type: Date, default: null },
  },
  { timestamps: true },
);

unitMembershipSchema.index({ userId: 1, from: 1 });
unitMembershipSchema.index({ unitId: 1, from: 1 });

// One open membership per person. ⚠️ Never `index: true` on `userId`: both want the name
// `userId_1`, Mongoose keeps the first and silently drops this one. Drop a stale one by hand.
unitMembershipSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { to: null } },
);

module.exports = mongoose.model("UnitMembership", unitMembershipSchema);
