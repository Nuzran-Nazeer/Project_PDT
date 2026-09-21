const mongoose = require("mongoose");
const {
  PLAN_TYPES,
  PLAN_STATUS,
  PLAN_ACTION_CATEGORIES,
  PLAN_ACTION_STATUS,
  CHECK_IN_OUTCOMES,
  PLAN_OUTCOMES,
  CARRY_FORWARD_REASONS,
} = require("../config/constants");

// Development plans and improvement plans share this shape and differ only in their rules,
// so they are one collection separated by `type`.

// ⚠️ No owner field. The right to write, edit, share and close is derived from who leads the
// employee's unit today, which is what makes a plan follow them to a new unit with nothing run.

const progressNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    byId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const actionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  category: { type: String, enum: PLAN_ACTION_CATEGORIES, required: true },

  // ⚠️ The stable competency key, never the display name or a position in an array: a rename
  // would otherwise rewrite every historical record. The employee never sees this field.
  fromCompetency: { type: String, required: true },

  // Either the employee or the supervisor. An action the supervisor owns is why
  // "blocked by the plan owner" can be a real reason for one not finishing.
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  targetDate: { type: Date, required: true },
  successCriteria: { type: String, required: true },

  status: { type: String, enum: PLAN_ACTION_STATUS, default: "not_started" },

  // Tracking is per action, not per plan: one plan-level status hides a plan that has died.
  lastUpdatedAt: { type: Date, default: Date.now },

  progressNotes: { type: [progressNoteSchema], default: [] },

  // Set when an action arrives from a closed plan. It keeps the competency it came from
  // originally and gains the one from the current review, so a second carry stays visible.
  carriedFrom: {
    type: [
      new mongoose.Schema(
        {
          planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
          competency: String,
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  carryReason: { type: String, enum: CARRY_FORWARD_REASONS, default: null },
});

// ⚠️ Appended, never edited or removed: a check-in is the record of a conversation that
// happened on a date. A correction is a further check-in.
const checkInSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    outcome: { type: String, enum: CHECK_IN_OUTCOMES, required: true },
    note: { type: String, default: null },
    byId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
      index: true,
    },

    // How a plan is tied to the review it came from, and how one plan per published review
    // is enforced. ⚠️ Indexed below with options, so never `index: true` here as well:
    // Mongoose keeps the first of two indexes wanting the same name and discards the other.
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Review", default: null },

    type: { type: String, enum: PLAN_TYPES, required: true },
    status: { type: String, enum: PLAN_STATUS, default: "draft" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Improvement-plan fields. They stay null on a development plan and are kept here
    // because both types are one collection with one shape.
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    durationDays: { type: Number, default: null },

    sharedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },

    startDate: { type: Date, default: null },
    closeDate: { type: Date, default: null },

    actions: { type: [actionSchema], default: [] },
    checkIns: { type: [checkInSchema], default: [] },

    outcome: { type: String, enum: PLAN_OUTCOMES, default: null },
    outcomeReason: { type: String, default: null },
  },
  { timestamps: true },
);

// One plan per published review. ⚠️ Partial, because an improvement plan can start from a
// check-in rather than a review and several of those would collide on a null.
planSchema.index(
  { reviewId: 1 },
  { unique: true, partialFilterExpression: { reviewId: { $type: "objectId" } } },
);

// ⚠️ Mongoose 9 hooks take no `next` callback; writing one throws "next is not a function".
// ⚠️ This never runs under findByIdAndUpdate, so every write goes through find-then-save.
planSchema.pre("save", function stampChangedActions() {
  for (const action of this.actions) {
    if (action.isModified("status")) action.lastUpdatedAt = new Date();
  }
});

module.exports = mongoose.model("Plan", planSchema);
