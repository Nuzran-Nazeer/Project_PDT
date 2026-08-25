const mongoose = require("mongoose");

// Who leads which unit, and WHEN. **This is where supervision lives** -- there is no
// supervisor collection and no `supervisorId` on the User record, because your
// supervisor on a date is simply the lead of your unit on that date.  (System spec §0.7)
//
// That indirection is what makes two supervisor periods in one year fall out on
// their own, whether the employee changed unit or the unit changed lead. Nobody has
// to remember to write anything down, so nobody can forget to.
//
// Reading this collection to actually ANSWER "who supervises whom" is the next story
// -- it has to resolve upward when a unit has no lead, and that is not this file's
// job. This one only records the facts.
//
// Same period convention as every dated collection; see utils/dateRange.js.
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

// A unit's leadership history, and the reverse question -- which units has this
// person led -- which the oversight screens ask. Neither field carries
// `index: true`, for the naming reason spelled out on the membership model.
unitLeadSchema.index({ unitId: 1, from: 1 });
unitLeadSchema.index({ userId: 1, from: 1 });

// The same database-level backstop the membership model carries, and see that file
// for the full reasoning. Here it is keyed on the UNIT, not the person: one person
// may lead several units at once, which is ordinary in a company this size, but a
// unit having two leads at once makes "the lead of your unit on that date"
// ambiguous -- and that is the one thing supervision cannot be.
unitLeadSchema.index(
  { unitId: 1 },
  { unique: true, partialFilterExpression: { to: null } },
);

module.exports = mongoose.model("UnitLead", unitLeadSchema);
