const mongoose = require("mongoose");

// Who worked on what, and when. One record per stint, never overwritten -- the same
// shape as UnitMembership, with one deliberate difference stated below.
//
// Period convention in utils/dateRange.js: `from` is the first day covered, `to` the
// first day NOT covered, `to: null` still open.
const projectAssignmentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "projectId is required"],
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
    },

    from: { type: Date, required: [true, "from is required"] },

    to: { type: Date, default: null },

    // ⚠️ NOT a flag that gets flipped. Changing who leads the team CLOSES this record
    // and opens a new one, so "who led in March" stays answerable. A boolean edited in
    // place would erase exactly that. See markTeamLead in the service.
    isTeamLead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Neither field carries `index: true`, for the naming reason on the membership model.
projectAssignmentSchema.index({ projectId: 1, from: 1 });
projectAssignmentSchema.index({ userId: 1, from: 1 });

// ⚠️ THE ONE PLACE THIS DIFFERS FROM UnitMembership: there is deliberately NO unique
// index on `userId`. A person holds one unit membership at a time, but working on two
// projects at once is the normal case and the whole point of recording projects
// separately from the tree. Overlap is refused only within ONE project, and that rule
// is about other records so it lives in the service.

// One open team lead per project. Partial on BOTH fields: it constrains only the rows
// that are currently leading, so the closed history of previous team leads sits
// outside it and is never in the way.
//
// ⚠️ This protects OPEN rows only. A backdated change clashing with a CLOSED
// team-lead period is invisible to it, so the service checks that separately.
projectAssignmentSchema.index(
  { projectId: 1, isTeamLead: 1 },
  { unique: true, partialFilterExpression: { to: null, isTeamLead: true } },
);

module.exports = mongoose.model("ProjectAssignment", projectAssignmentSchema);
