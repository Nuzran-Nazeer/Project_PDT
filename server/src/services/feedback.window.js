const { FEEDBACK_EDIT_WINDOW_HOURS } = require("../config/constants");

// ⚠️ THE ONE HOME OF THE EDIT WINDOW. Two answers to "is this finished yet" is how a
// supervisor ends up summarising a document its author is still rewriting.

const HOUR_MS = 60 * 60 * 1000;

// ⚠️ Editing stays open for a window AFTER submitting, so `submitted` does not mean
// finished. Nothing flips the status to `locked` because no scheduled job exists, so the
// window is computed from `locksAt` on every read and write instead.
const isEditable = (doc, now = new Date()) => {
  if (doc.status === "locked") return false;
  if (!doc.submittedAt) return true;
  return Boolean(doc.locksAt) && now.getTime() < doc.locksAt.getTime();
};

// ⚠️ What every reader who did not write the document must ask, never `status`. A
// summary drawn from an answer that then changes cannot be un-written.
const hasSettled = (doc) => Boolean(doc.submittedAt) && !isEditable(doc);

const lockTimeFor = (submittedAt) =>
  new Date(submittedAt.getTime() + FEEDBACK_EDIT_WINDOW_HOURS * HOUR_MS);

module.exports = { isEditable, hasSettled, lockTimeFor };
