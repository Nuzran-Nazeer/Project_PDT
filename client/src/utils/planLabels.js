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

// ⚠️ Held here rather than fetched, the same as the check-in outcomes above: these are the
// values the form offers, and the server refuses anything else.
export const CARRY_FORWARD_REASONS = [
  "employee_capacity",
  "company_workload",
  "no_longer_relevant",
  "blocked_externally",
  "blocked_by_plan_owner",
];

const CARRY_REASON_LABELS = {
  employee_capacity: "Employee capacity",
  company_workload: "Company workload",
  no_longer_relevant: "No longer relevant",
  blocked_externally: "Blocked externally",
  blocked_by_plan_owner: "Blocked by the plan owner",
};

// The values the start form offers, held here for the same reason as the check-in outcomes
// above: the server refuses anything else, and its bounds are what the form allows.
export const IMPROVEMENT_PLAN_TYPES = ["performance", "behaviour", "collaboration"];
export const IMPROVEMENT_MIN_DAYS = 30;
export const IMPROVEMENT_MAX_DAYS = 90;

const IMPROVEMENT_TYPE_LABELS = {
  performance: "Performance",
  behaviour: "Behaviour",
  collaboration: "Collaboration",
};

const PLAN_STATUS_LABELS = {
  draft: "Draft",
  awaiting_ack: "Shared, awaiting acknowledgement",
  active: "Active",
  closed: "Closed",
};

const TRIGGER_LABELS = {
  review: "A published result",
  check_in: "A check-in recorded as off track",
};

const PLAN_OUTCOME_LABELS = {
  completed: "Every action completed",
  carried_forward: "Actions carried forward",
  not_completed: "Not completed",
};

const CARRIED_TIMES = { 1: "once", 2: "twice" };

const WINDOW_STATE_LABELS = {
  held: "Held",
  open: "Open now",
  missed: "Missed",
  upcoming: "Upcoming",
};

// The states an action can be moved to. Overdue is worked out when the plan is read and
// carried forward is written when it closes, so neither is a state anyone picks.
export const TRACKABLE_STATUSES = ["not_started", "in_progress", "done"];

export const improvementTypeLabel = (key) => IMPROVEMENT_TYPE_LABELS[key] || key;
export const planStatusLabel = (key) => PLAN_STATUS_LABELS[key] || key;
export const triggerLabel = (key) => TRIGGER_LABELS[key] || key;

export const categoryLabel = (key) => CATEGORY_LABELS[key] || key;
export const actionStatusLabel = (key) => ACTION_STATUS_LABELS[key] || key;
export const planStateLabel = (key) => PLAN_STATE_LABELS[key] || key;
export const checkInOutcomeLabel = (key) => CHECK_IN_OUTCOME_LABELS[key] || key;
export const windowStateLabel = (key) => WINDOW_STATE_LABELS[key] || key;
export const carryReasonLabel = (key) => CARRY_REASON_LABELS[key] || key;
export const planOutcomeLabel = (key) => PLAN_OUTCOME_LABELS[key] || key;

export const carriedTimesLabel = (times) =>
  `Carried forward ${CARRIED_TIMES[times] || `${times} times`}`;

export const daysSinceLabel = (days) => {
  if (days === null || days === undefined) return null;
  if (days === 0) return "changed today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
};

export const daysRemainingLabel = (days) => {
  if (days === null || days === undefined) return null;
  if (days === 0) return "ends today";
  return days === 1 ? "1 day left" : `${days} days left`;
};

// Amber reads as somebody's turn rather than as a problem, which is what a plan waiting on
// a person is.
export const PLAN_STATUS_TONE = {
  draft: "text-muted",
  awaiting_ack: "font-medium text-success",
  active: "font-medium text-success",
  closed: "text-muted",
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
