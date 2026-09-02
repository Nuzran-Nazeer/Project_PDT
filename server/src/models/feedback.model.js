const mongoose = require("mongoose");
const {
  REVIEWER_TYPES,
  FEEDBACK_STATUS,
  IDENTIFYING_FIELDS,
} = require("../config/constants");

// One collection for all six reviewer types, so stripping the reviewer's identity is
// ONE function rather than six places to remember. (Design decision L1-9)

const ratingSchema = new mongoose.Schema(
  {
    // ⚠️ The stable key, NEVER the display name and never an array index. Renaming a
    // competency must leave every stored record meaning what it meant.
    competencyKey: { type: String, required: [true, "competencyKey is required"] },

    // A real answer, not a blank: a declined competency stores no score and needs no
    // evidence, which is why both below are nullable.
    notObserved: { type: Boolean, default: false },
    score: { type: Number, min: 1, max: 5, default: null },
    evidence: { type: String, default: null },
  },
  { _id: false },
);

const feedbackSchema = new mongoose.Schema(
  {
    // Nullable: a project lead writes at project close, when no cycle may be open. The
    // record is stored with `projectId` set and adopted when a cycle opens.
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      default: null,
      index: true,
    },

    // ⚠️ THE FIELD THE WHOLE PRODUCT RESTS ON. `select: false` keeps it out of every
    // query result, so an endpoint cannot leak what it never loaded. Ask for it back
    // only through services/feedback.privacy.js, never with a bare .select().
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "reviewerId is required"],
      select: false,
      index: true,
    },

    revieweeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "revieweeId is required"],
      index: true,
    },

    reviewerType: {
      type: String,
      required: [true, "reviewerType is required"],
      enum: {
        values: REVIEWER_TYPES,
        message: "{VALUE} is not a valid reviewer type",
      },
    },

    // Which stretch of the cycle this covers, for somebody who changed supervisor
    // mid-year. Nothing is averaged across periods.
    periodIndex: { type: Number, default: 0 },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    // ⚠️ Stored, not derived. Editing a form creates a NEW version, so without this
    // an edit retroactively changes the questions last year's answers were given to.
    formTemplateKey: { type: String, required: [true, "formTemplateKey is required"] },
    formTemplateVersion: {
      type: Number,
      required: [true, "formTemplateVersion is required"],
    },

    ratings: { type: [ratingSchema], default: [] },

    freeText: {
      strengths: { type: String, default: null },
      development: { type: String, default: null },
    },

    status: { type: String, enum: FEEDBACK_STATUS, default: "assigned" },

    // Assigned when the reviewers are picked, NOT in submission order, so arrival
    // order carries no information. It is the only handle a consumer ever gets.
    label: { type: String, default: null },

    submittedAt: { type: Date, default: null },
    locksAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One submission per reviewer, per reviewee, per review.
feedbackSchema.index(
  { reviewId: 1, revieweeId: 1, reviewerId: 1 },
  { unique: true, partialFilterExpression: { reviewId: { $type: "objectId" } } },
);

feedbackSchema.index({ revieweeId: 1, reviewerType: 1, status: 1 });

// Belt and braces alongside `select: false`, and the same treatment the password
// field gets: a query that re-selects the reviewer still cannot leak it through a
// response. Anything needing these fields must build its own object explicitly.
feedbackSchema.set("toJSON", {
  transform: (doc, ret) => {
    for (const field of IDENTIFYING_FIELDS) delete ret[field];
    return ret;
  },
});

module.exports = mongoose.model("Feedback", feedbackSchema);
