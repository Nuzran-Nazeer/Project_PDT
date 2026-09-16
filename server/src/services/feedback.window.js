const { FEEDBACK_EDIT_WINDOW_HOURS } = require("../config/constants");

// ⚠️ The one home of the edit window: two answers to "is this finished" is how a
// supervisor summarises a document its author is still rewriting.

const HOUR_MS = 60 * 60 * 1000;

// ⚠️ `locksAt` decides, not the status: a record can be loaded a moment before it locks.
const isEditable = (doc, now = new Date()) => {
  if (doc.status === "locked") return false;
  if (!doc.submittedAt) return true;
  return Boolean(doc.locksAt) && now.getTime() < doc.locksAt.getTime();
};

// ⚠️ What every reader who did not write the document must ask, never `status`.
const hasSettled = (doc) => Boolean(doc.submittedAt) && !isEditable(doc);

const lockTimeFor = (submittedAt) =>
  new Date(submittedAt.getTime() + FEEDBACK_EDIT_WINDOW_HOURS * HOUR_MS);

module.exports = { isEditable, hasSettled, lockTimeFor };
