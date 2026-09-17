const { CYCLE_STAGES, PUBLISHED_STATES } = require("../config/constants");
const { hasSettled } = require("./feedback.window");

// ⚠️ The one home of "is this summary cleared" and "has this review entered normalisation".
// Both are read off the check history and the supervisor record; nothing stores either.

const lastCheck = (review) => {
  const checks = review?.checks || [];
  return checks.length ? checks[checks.length - 1] : null;
};

// ⚠️ Later than the current submission, or a resubmit would inherit an old clearance.
const isCleared = (review, supervisorDoc) => {
  const last = lastCheck(review);
  return Boolean(
    last &&
    last.action === "cleared" &&
    supervisorDoc?.submittedAt &&
    last.at.getTime() > supervisorDoc.submittedAt.getTime(),
  );
};

// A send-back the supervisor has not yet answered with a resubmission.
const pendingSendBack = (review, supervisorDoc) => {
  const last = lastCheck(review);
  if (!last || last.action !== "sent_back") return null;
  if (
    supervisorDoc?.submittedAt &&
    supervisorDoc.submittedAt.getTime() > last.at.getTime()
  ) {
    return null;
  }
  return last;
};

const stageAtOrPast = (cycle, stage) =>
  CYCLE_STAGES.indexOf(cycle?.status) >= CYCLE_STAGES.indexOf(stage);

// ⚠️ The door normalisation works behind: once a review is through it, nothing it was
// computed from may reopen. Settled and cleared, or settled with no colleague section, with
// the cycle at normalising or later.
const hasEnteredNormalisation = ({ review, cycle, supervisorDoc, colleagueSection }) => {
  if ([...PUBLISHED_STATES, "withdrawn"].includes(review.status)) return true;
  if (!stageAtOrPast(cycle, "normalising")) return false;
  if (!supervisorDoc || !hasSettled(supervisorDoc)) return false;
  return !colleagueSection || isCleared(review, supervisorDoc);
};

module.exports = { lastCheck, isCleared, pendingSendBack, hasEnteredNormalisation };
