const mongoose = require("mongoose");

// A piece of work that runs across units. The org tree says who someone reports to;
// a project says who they work WITH, which is why cross-unit collaboration is
// invisible without this collection.
//
// ⚠️ THE MODEL NAME IS LOAD-BEARING. `feedback.model.js` and `review.model.js` were
// written with `ref: "Project"` before this file existed, so registering it under any
// other name leaves those refs pointing at nothing and populating to null with no
// error.
//
// Period convention as everywhere else, see utils/dateRange.js: `startDate` is the
// first day covered, `endDate` the first day NOT covered, `endDate: null` still
// running. There is no `active` flag: two fields answering the same question drift.
const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
    },

    // Who runs the project. A field on the project rather than a dated record,
    // because nothing in this story changes a project's lead. Distinct from the TEAM
    // LEAD, which is a property of an assignment -- REVIEWER_TYPES carries
    // `project_lead` and `team_lead` as two separate things.
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "leadId is required"],
    },

    startDate: { type: Date, required: [true, "startDate is required"] },

    // Set once, by closeProject. Never cleared: a closed project stays closed, the
    // same way a discontinued unit stays discontinued.
    endDate: { type: Date, default: null },
  },
  { timestamps: true },
);

projectSchema.index({ leadId: 1, startDate: 1 });

// Two projects called "Apollo" cannot both be RUNNING, or HR cannot tell which one
// they are assigning someone to. Closed ones are exempt, so the name can be reused
// years later.
//
// Three parts, all needed:
//   partialFilterExpression  scopes the rule to open projects only
//   collation strength 2     makes it case-insensitive, so "apollo" collides with
//                            "Apollo" (strength 2 folds case but keeps accents)
//   unique                   makes the database the backstop, so two concurrent
//                            requests cannot both pass the service's check and both
//                            insert. The service converts the resulting duplicate-key
//                            error into a 409.
//
// ⚠️ The service's own lookup MUST pass the same collation, or it does a
// case-SENSITIVE search, finds nothing, and leaves the index to do the refusing.
projectSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { endDate: null },
    collation: { locale: "en", strength: 2 },
  },
);

module.exports = mongoose.model("Project", projectSchema);
