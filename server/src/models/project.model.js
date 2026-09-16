const mongoose = require("mongoose");

// ⚠️ Other models carry `ref: "Project"`; registering under any other name populates to
// null with no error. `endDate` is the first day not covered, null while running.
const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
    },

    // Distinct from the team lead, which is a property of an assignment.
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "leadId is required"],
    },

    startDate: { type: Date, required: [true, "startDate is required"] },

    // Set once by closeProject, never cleared.
    endDate: { type: Date, default: null },
  },
  { timestamps: true },
);

projectSchema.index({ leadId: 1, startDate: 1 });

// No two running projects share a name, case-insensitively (strength 2 folds case, keeps
// accents). ⚠️ The service's lookup must pass the same collation or it finds nothing.
projectSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { endDate: null },
    collation: { locale: "en", strength: 2 },
  },
);

module.exports = mongoose.model("Project", projectSchema);
