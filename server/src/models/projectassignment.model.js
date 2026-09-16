const mongoose = require("mongoose");

// One record per stint, never overwritten. `to` is the first day not covered, null while open.
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

    // ⚠️ Never flipped in place: changing the team lead closes this record and opens another.
    isTeamLead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ⚠️ Never `index: true` on a field also indexed here: both want the same name and the second is dropped.
projectAssignmentSchema.index({ projectId: 1, from: 1 });
projectAssignmentSchema.index({ userId: 1, from: 1 });

// Deliberately no unique index on `userId`: two projects at once is the normal case.

// One open team lead per project. ⚠️ Open rows only: a backdated clash with a closed
// period is invisible to it, so the service checks that separately.
projectAssignmentSchema.index(
  { projectId: 1, isTeamLead: 1 },
  { unique: true, partialFilterExpression: { to: null, isTeamLead: true } },
);

module.exports = mongoose.model("ProjectAssignment", projectAssignmentSchema);
