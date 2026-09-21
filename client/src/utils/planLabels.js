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

export const categoryLabel = (key) => CATEGORY_LABELS[key] || key;
export const actionStatusLabel = (key) => ACTION_STATUS_LABELS[key] || key;
export const planStateLabel = (key) => PLAN_STATE_LABELS[key] || key;

export const PLAN_STATE_TONE = {
  owed: "text-amber-700 dark:text-amber-400",
  draft: "text-muted",
  shared: "font-medium text-success",
};
