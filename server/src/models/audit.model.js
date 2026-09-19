const mongoose = require("mongoose");
const { AUDIT_ACTIONS, AUDIT_OUTCOMES, AUDIT_TARGETS } = require("../config/constants");

// The record that makes the confidentiality promise provable. Append only: every write path
// below refuses, so a later endpoint cannot quietly rewrite history.
//
// ⚠️ An entry never carries a reviewer's name or id, not even on a reveal. It records that a
// name was handed over and to whom, never which colleague was behind the feedback — otherwise
// the log becomes a second, permanent copy of the thing the whole design exists to protect.
const auditSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "actorId is required"],
    },

    action: {
      type: String,
      required: [true, "action is required"],
      enum: { values: AUDIT_ACTIONS, message: "{VALUE} is not an audited action" },
    },

    outcome: {
      type: String,
      required: [true, "outcome is required"],
      enum: { values: AUDIT_OUTCOMES, message: "{VALUE} is not a valid outcome" },
      default: "allowed",
    },

    // Null where the action concerns a group rather than one person, as a cancelled cycle does.
    subjectUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    targetType: {
      type: String,
      required: [true, "targetType is required"],
      enum: { values: AUDIT_TARGETS, message: "{VALUE} is not an audited record type" },
    },

    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Present only where the action required one. A gated read would carry none by design.
    reason: { type: String, default: null, trim: true },

    // One short line for the reader: what was done, in the words of the thing that did it.
    detail: { type: String, default: null, trim: true },

    // Filled for an edit to a dated history record, where the change is the point.
    change: {
      from: { type: String, default: null },
      to: { type: String, default: null },
    },

    at: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

auditSchema.index({ at: -1 });
auditSchema.index({ subjectUserId: 1, at: -1 });
auditSchema.index({ actorId: 1, action: 1, at: -1 });

// ⚠️ Immutability, as far as a database on this tier allows. Nothing here stops somebody with
// the connection string editing a document by hand; it stops our own code doing it by accident.
const REFUSAL = "An audit entry cannot be changed or removed once written";

auditSchema.pre("save", function () {
  if (!this.isNew) throw new Error(REFUSAL);
});

for (const op of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
  "findOneAndReplace",
]) {
  auditSchema.pre(op, { query: true, document: false }, function () {
    throw new Error(REFUSAL);
  });
}

module.exports = mongoose.model("Audit", auditSchema);
