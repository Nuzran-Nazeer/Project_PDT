const mongoose = require("mongoose");
const { LIST_CHANGE_TYPES, LIST_CHANGE_STATUS } = require("../config/constants");

// Saved when the supervisor confirms it, so HR draws from the list somebody checked.

const { ObjectId } = mongoose.Schema.Types;

// `sourceId`, not `id`: a path named `id` collides with the id virtual Mongoose adds.
const sourceShape = { kind: String, sourceId: String, name: String };

const candidateSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    via: sourceShape,
    sharedFrom: { type: Date, default: null },
    sharedTo: { type: Date, default: null },
  },
  { _id: false },
);

// Keeps its own `_id`: HR decides each request by it.
const changeSchema = new mongoose.Schema({
  type: { type: String, enum: LIST_CHANGE_TYPES, required: true },
  userId: { type: ObjectId, ref: "User", required: true },
  reason: { type: String, trim: true, required: [true, "A reason is required"] },
  status: { type: String, enum: LIST_CHANGE_STATUS, default: "pending" },
  requestedBy: { type: ObjectId, ref: "User", required: true },
  decidedBy: { type: ObjectId, ref: "User", default: null },
  decidedAt: { type: Date, default: null },
});

const reviewerListSchema = new mongoose.Schema(
  {
    reviewId: { type: ObjectId, ref: "Review", required: true },
    cycleId: { type: ObjectId, ref: "Cycle", required: true },
    revieweeId: { type: ObjectId, ref: "User", required: true },

    candidates: { type: [candidateSchema], default: [] },
    confirmedBy: { type: ObjectId, ref: "User", required: true },
    confirmedAt: { type: Date, required: true },

    changes: { type: [changeSchema], default: [] },

    // ⚠️ A count and nothing else. Who was picked lives only on the feedback records, and no
    // screen names them.
    drawnBy: { type: ObjectId, ref: "User", default: null },
    drawnAt: { type: Date, default: null },
    drawnCount: { type: Number, default: null },
    shortfallAcknowledged: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ⚠️ Never `index: true` on `reviewId`: the names collide and this unique one is silently dropped.
reviewerListSchema.index({ reviewId: 1 }, { unique: true });
reviewerListSchema.index({ cycleId: 1 });

module.exports = mongoose.model("ReviewerList", reviewerListSchema);
