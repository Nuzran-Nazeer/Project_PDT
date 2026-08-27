const mongoose = require("mongoose");

// One record per stint, never overwritten. ⚠️ This is why `unitId` is NOT a field on
// the User record: a single current value destroys every question except "where is
// she now".
//
// Period convention in utils/dateRange.js: `from` is the first day covered, `to` the
// first day NOT covered, `to: null` still open.
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

    // null means still open. One-open-per-person is a rule about the OTHER records,
    // so it lives in the service.
    to: { type: Date, default: null },
  },
  { timestamps: true },
);

// These also cover plain `userId` and `unitId` lookups, which is why neither field
// carries `index: true`. Not tidiness: see below.
unitMembershipSchema.index({ userId: 1, from: 1 });
unitMembershipSchema.index({ unitId: 1, from: 1 });

// A database backstop for "one unit at a time", catching writes that never reach the
// service. `partialFilterExpression` is what makes it possible: applied only where
// `to` is null it reads as "among this person's OPEN memberships, exactly one". It
// cannot cover two overlapping CLOSED records.
//
// ⚠️ A single-field index is named after its field, so `index: true` on `userId` and
// this line both want to be `userId_1`. Mongoose will not alter an index that already
// exists under that name: the first wins, the second is discarded with no error, and
// the unique constraint is simply absent. A stale `userId_1` must be dropped by hand.
unitMembershipSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { to: null } },
);

module.exports = mongoose.model("UnitMembership", unitMembershipSchema);
