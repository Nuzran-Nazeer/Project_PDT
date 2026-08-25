const mongoose = require("mongoose");

// Who belongs to which unit, and WHEN. One record per stint, never overwritten:
// moving someone closes the old record with an end date and opens a new one, so
// "which unit was she in last March" stays answerable forever.  (System spec §0.7)
//
// This is why `unitId` is deliberately NOT a field on the User record. A single
// current value answers "where is she now" and destroys every other question the
// moment anyone moves -- and every rule in this system is about a period.
//
// The period convention lives in utils/dateRange.js: `from` is the first day
// covered, `to` the first day NOT covered, `to: null` still open. Read that file
// before writing any query against this collection.
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

    // null means the membership is still open. Enforced nowhere on this model:
    // "one open membership per person" is a rule about the OTHER records in the
    // collection, so it lives in the service, like every other rule here.
    to: { type: Date, default: null },
  },
  { timestamps: true },
);

// The two shapes every query takes: one person's history in date order, and one
// unit's roster. Both are read on every appraisal, so neither should be a scan.
//
// These also cover plain `userId` and `unitId` lookups on their own, which is why
// neither field carries `index: true`. That is not tidiness -- see the warning on
// the partial index below, where it matters.
unitMembershipSchema.index({ userId: 1, from: 1 });
unitMembershipSchema.index({ unitId: 1, from: 1 });

// A BACKSTOP for "one unit at a time", enforced by the database rather than by us.
//
// The service already refuses an overlapping membership, and that check is what
// produces the readable error. This is for the writes that never reach the service:
// the seed script, a correction typed into the Atlas console, or a future
// `UnitMembership.create()` by someone who did not know the service existed. All
// three would otherwise open a second membership in silence, and the person would
// be in two units at once with nothing to show for it until a supervisor or a peer
// pool came out wrong months later.
//
// `partialFilterExpression` is what makes this possible. `userId` cannot be unique
// outright -- a person is SUPPOSED to have many membership records. Applied only
// where `to` is null, it reads as: among this person's OPEN memberships, there may
// be exactly one. Closed records are ignored entirely.
//
// What it does NOT cover: two overlapping CLOSED records. "These date ranges
// overlap" is not something a unique index can express, so that case is still the
// service's alone. This closes the likeliest hole, not every hole.
//
// ⚠️ THE TRAP THAT COST TIME HERE, 2026-08-25. A single-field index is named after
// its field, so `index: true` on `userId` and this line BOTH want to be `userId_1`.
// Mongoose will not alter an index that already exists under that name, so whichever
// was created first wins and the other is dropped on the floor -- **silently, with
// no error and no warning**. The unique constraint simply was not there, and a raw
// insert of a second open membership went straight through.
//
// So: `userId` must NOT carry `index: true`, and if this collection already has a
// plain `userId_1` from an earlier run, it has to be dropped before this one can
// build. Same trap waits on the leadership model.
unitMembershipSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { to: null } },
);

module.exports = mongoose.model("UnitMembership", unitMembershipSchema);
