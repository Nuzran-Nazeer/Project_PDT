// ⚠️⚠️ EVERY FIGURE IN THIS FILE IS INVENTED. DELETE THIS FILE THE MOMENT THE DATA
// BEHIND A FIGURE EXISTS. Every fake figure lives here and nowhere else, so removing
// them is deleting this file and fixing the imports the compiler reports.

// Nothing else in this file is read while this is false.
export const SHOW_PLACEHOLDER_FIGURES = false;

// The four tiles under QUICK OVERVIEW, for whichever group is the primary one.
export const PLACEHOLDER_TILES = {
  employee: [
    {
      value: "4 of 6",
      label: "Competencies you have answered",
      icon: "clipboard",
      tone: "violet",
    },
    {
      value: "3 of 8",
      label: "Colleague reviews you have written",
      icon: "message",
      tone: "blue",
    },
    { value: "5", label: "Plan actions in progress", icon: "trend", tone: "amber" },
    {
      value: "8 days",
      label: "Until collecting closes",
      icon: "calendar",
      tone: "green",
    },
  ],
};

// The status on the right of each action row, keyed by the tab the row opens.
// `tone` is the colour: "muted", "good", "warn" or "bad".
export const PLACEHOLDER_ROW_STATUS = {
  "my-self-assessment": [{ text: "Draft, 4 of 6 answered", tone: "warn", icon: "clock" }],
  "feedback-i-owe": [
    { text: "8 assigned", tone: "muted", icon: "users" },
    { text: "3 submitted", tone: "good", icon: "check" },
  ],
  "my-result": [
    { text: "PAR 2025 published, not acknowledged", tone: "warn", icon: "file" },
  ],
  "my-development-plan": [
    { text: "5 actions", tone: "muted", icon: "trend" },
    { text: "1 not started", tone: "warn", icon: "clock" },
  ],
  "my-history": [{ text: "2 past cycles", tone: "muted", icon: "calendar" }],
};
