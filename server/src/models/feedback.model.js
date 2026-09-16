const mongoose = require("mongoose");
const {
  REVIEWER_TYPES,
  FEEDBACK_STATUS,
  IDENTIFYING_FIELDS,
} = require("../config/constants");

// One collection for all six reviewer types, so stripping the reviewer's identity is one
// function rather than six places to remember.

const ratingSchema = new mongoose.Schema(
  {
    // ⚠️ The stable key, never the display name and never an array index.
    competencyKey: { type: String, required: [true, "competencyKey is required"] },

    // A declined competency stores no score and no evidence.
    notObserved: { type: Boolean, default: false },
    score: { type: Number, min: 1, max: 5, default: null },
    evidence: { type: String, default: null },
  },
  { _id: false },
);

// `sourceId`, not `id`: a path named `id` collides with the id virtual Mongoose adds.
const drawnFromSchema = new mongoose.Schema(
  { kind: { type: String, enum: ["unit", "project"] }, sourceId: String },
  { _id: false },
);

const feedbackSchema = new mongoose.Schema(
  {
    // Nullable: a project lead writes at project close and the record is adopted later.
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      default: null,
      index: true,
    },

    // ⚠️ `select: false` so an endpoint cannot leak what it never loaded. Ask for it back
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

    // Which stretch of the cycle this covers; nothing is averaged across periods.
    periodIndex: { type: Number, default: 0 },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    // ⚠️ Stored, not derived, or a form edit changes the questions past answers were given to.
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

    // The digest of colleague feedback the employee eventually reads. Written by hand.
    colleagueSummary: { type: String, default: null },

    status: { type: String, enum: FEEDBACK_STATUS, default: "assigned" },

    // ⚠️ Assigned when the reviewers are picked, never in submission order.
    label: { type: String, default: null },

    // ⚠️ Identifying: in a project of three the source is a name. Never served.
    drawnFrom: { type: drawnFromSchema, select: false, default: null },

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

// A query that re-selects the reviewer still cannot leak it through a response.
feedbackSchema.set("toJSON", {
  transform: (doc, ret) => {
    for (const field of IDENTIFYING_FIELDS) delete ret[field];
    return ret;
  },
});

module.exports = mongoose.model("Feedback", feedbackSchema);
