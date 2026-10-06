const {
  CYCLE_STAGES,
  PUBLISHED_STATES,
  FEEDBACK_EDIT_WINDOW_HOURS,
} = require("../config/constants");
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

// What a review still needs before normalisation, or null when it is ready.
// ⚠️ A sent-back review reads as waiting on the check, not the supervisor, although its record
// is a draft: what is being waited on is the outcome of the check.
const normalisationReadiness = ({ review, supervisorDoc, colleagueSection }) => {
  if (pendingSendBack(review, supervisorDoc)) {
    return {
      ready: false,
      missing: "summary_check",
      reason: "the summary was sent back",
    };
  }
  if (!supervisorDoc?.submittedAt) {
    return { ready: false, missing: "supervisor_review", reason: "not submitted" };
  }
  if (!hasSettled(supervisorDoc)) {
    return {
      ready: false,
      missing: "supervisor_review",
      reason: `submitted less than ${FEEDBACK_EDIT_WINDOW_HOURS} hours ago`,
    };
  }
  if (colleagueSection && !isCleared(review, supervisorDoc)) {
    return {
      ready: false,
      missing: "summary_check",
      reason: "the summary is not yet checked",
    };
  }
  return { ready: true, missing: null, reason: null };
};

// ⚠️ The door normalisation works behind: once a review is through it, nothing it was
// computed from may reopen. Ready, with the cycle at normalising or later.
const hasEnteredNormalisation = ({ review, cycle, supervisorDoc, colleagueSection }) => {
  if ([...PUBLISHED_STATES, "withdrawn"].includes(review.status)) return true;
  if (!stageAtOrPast(cycle, "normalising")) return false;
  return normalisationReadiness({ review, supervisorDoc, colleagueSection }).ready;
};

// Left behind by a cycle that has moved on, and not yet caught up. Derived, never stored.
const isWaiting = ({ review, cycle, supervisorDoc, colleagueSection }) =>
  stageAtOrPast(cycle, "normalising") &&
  !hasEnteredNormalisation({ review, cycle, supervisorDoc, colleagueSection });

module.exports = {
  lastCheck,
  isCleared,
  pendingSendBack,
  normalisationReadiness,
  hasEnteredNormalisation,
  isWaiting,
};
