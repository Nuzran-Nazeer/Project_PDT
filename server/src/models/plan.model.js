const mongoose = require("mongoose");
const {
  PLAN_TYPES,
  PLAN_STATUS,
  PLAN_ACTION_CATEGORIES,
  PLAN_ACTION_STATUS,
  CHECK_IN_OUTCOMES,
  PLAN_OUTCOMES,
  CARRY_FORWARD_REASONS,
  IMPROVEMENT_PLAN_TYPES,
  IMPROVEMENT_TRIGGERS,
  PLAN_APPROVAL_DECISIONS,
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
  // ⚠️ The date it arrived with is kept so a new one can be told from the stale one. Without
  // it there is no way to know whether the supervisor gave the action a fresh deadline.
  carriedFrom: {
    type: [
      new mongoose.Schema(
        {
          planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
          competency: String,
          targetDate: Date,
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  carryReason: { type: String, enum: CARRY_FORWARD_REASONS, default: null },
});

// ⚠️ Appended, never edited or removed: a check-in records a conversation that happened.
// Position in the array is therefore the check-in number, and nothing stores it.
const checkInSchema = new mongoose.Schema(
  {
    // When the conversation happened against when it was typed up. Both, because that is
    // what separates a late write-up from a back-dated one.
    at: { type: Date, required: true },
    recordedAt: { type: Date, required: true },

    outcome: { type: String, enum: CHECK_IN_OUTCOMES, required: true },
    note: { type: String, required: true },
    byId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false },
);

// What started an improvement plan: a published result low enough to warrant one, or a
// development-plan check-in that went off track. ⚠️ The review is named here and never in
// `reviewId`, which the development plan for that same review already holds.
const triggerSchema = new mongoose.Schema(
  {
    source: { type: String, enum: IMPROVEMENT_TRIGGERS, required: true },
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Review", default: null },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    checkInNumber: { type: Number, default: null },
  },
  { _id: false },
);

// HR's last decision. ⚠️ One record, overwritten rather than appended to, and it survives a
// resubmission so the next officer sees why it was sent back. The sequence is the trail's job.
const approvalSchema = new mongoose.Schema(
  {
    decision: { type: String, enum: PLAN_APPROVAL_DECISIONS, required: true },
    byId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, required: true },

    // Required on a refusal and null on an approval: a plan sent back has to say why.
    reason: { type: String, default: null },
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
    durationDays: { type: Number, default: null },

    // When it last went to HR, and what HR said. Nobody approves a development plan.
    submittedAt: { type: Date, default: null },
    approval: { type: approvalSchema, default: null },

    // The case type. Required when an improvement plan is created, read only by HR, and
    // nothing in the system branches on it.
    improvementType: { type: String, enum: IMPROVEMENT_PLAN_TYPES, default: null },

    // What the plan is about, as a stable key and never a display name. An action carries
    // its own; this is the concern the whole plan was raised over.
    forCompetency: { type: String, default: null },

    // ⚠️ Both are set when the plan is shared, not when it is written: HR's approval can take
    // days, and a window fixed at drafting would start before anybody had agreed to it.
    endDate: { type: Date, default: null },

    trigger: { type: triggerSchema, default: null },

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

// One improvement plan open per employee. ⚠️ Named, because `userId` is indexed above and two
// indexes wanting the name `userId_1` end with Mongoose keeping the first and dropping this one.
planSchema.index(
  { userId: 1 },
  {
    name: "one_open_improvement_plan",
    unique: true,
    partialFilterExpression: { type: "PIP", closeDate: { $type: "null" } },
  },
);

// ⚠️ Mongoose 9 hooks take no `next` callback; writing one throws "next is not a function".
// ⚠️ This never runs under findByIdAndUpdate, so every write goes through find-then-save.
planSchema.pre("save", function stampChangedActions() {
  for (const action of this.actions) {
    if (action.isModified("status")) action.lastUpdatedAt = new Date();
  }
});

module.exports = mongoose.model("Plan", planSchema);
