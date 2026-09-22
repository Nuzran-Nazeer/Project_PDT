// Display names only. The stored value is always the key, so a wording change here never
// touches a record. An unknown key falls back to itself rather than to an empty cell.

const CATEGORY_LABELS = {
  certification: "Certification",
  training: "Training",
  mentoring: "Mentoring",
  shadowing: "Shadowing",
  stretch_assignment: "Stretch assignment",
  taking_ownership: "Taking ownership",
  presenting: "Presenting",
  rotation: "Rotation",
  leading_work: "Leading a piece of work",
  other: "Other",
};

const ACTION_STATUS_LABELS = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  overdue: "Overdue",
  carried_forward: "Carried forward",
};

const PLAN_STATE_LABELS = {
  owed: "No plan yet",
  draft: "Draft",
  shared: "Shared",
};

// ⚠️ Held here rather than fetched, the same as the action states above: these are the
// values the form offers, and the server refuses anything else.
export const CHECK_IN_OUTCOMES = ["on_track", "at_risk", "off_track"];

const CHECK_IN_OUTCOME_LABELS = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

const WINDOW_STATE_LABELS = {
  held: "Held",
  open: "Open now",
  missed: "Missed",
  upcoming: "Upcoming",
};

// The states an action can be moved to. Overdue is worked out when the plan is read and
// carried forward is written when it closes, so neither is a state anyone picks.
export const TRACKABLE_STATUSES = ["not_started", "in_progress", "done"];

export const categoryLabel = (key) => CATEGORY_LABELS[key] || key;
export const actionStatusLabel = (key) => ACTION_STATUS_LABELS[key] || key;
export const planStateLabel = (key) => PLAN_STATE_LABELS[key] || key;
export const checkInOutcomeLabel = (key) => CHECK_IN_OUTCOME_LABELS[key] || key;
export const windowStateLabel = (key) => WINDOW_STATE_LABELS[key] || key;

export const daysSinceLabel = (days) => {
  if (days === null || days === undefined) return null;
  if (days === 0) return "changed today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
};

export const PLAN_STATE_TONE = {
  owed: "text-amber-700 dark:text-amber-400",
  draft: "text-muted",
  shared: "font-medium text-success",
};

export const CHECK_IN_OUTCOME_TONE = {
  on_track: "text-success",
  at_risk: "text-amber-700 dark:text-amber-400",
  off_track: "text-danger",
};

export const WINDOW_STATE_TONE = {
  held: "text-success",
  open: "font-medium text-brand",
  missed: "text-amber-700 dark:text-amber-400",
  upcoming: "text-muted",
};
