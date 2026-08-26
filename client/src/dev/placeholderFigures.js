// ⚠️⚠️ EVERY FIGURE IN THIS FILE IS INVENTED. DELETE THIS FILE BEFORE THE SPRINT 2
// DEMO, OR THE MOMENT THE DATA BEHIND A FIGURE ACTUALLY EXISTS, WHICHEVER IS FIRST.
//
// WHY IT EXISTS. The design is a dashboard: a cycle banner, a strip of four figures,
// and action rows that each report a status. Drawn with nothing in them it does not
// read as the screen it is meant to be, so Nuzran's call on 2026-08-26 was to hardcode
// figures for now and strip them out later. That is knowingly against this project's
// standing rule that no invented number goes in the repository. The rule exists
// because a hardcoded figure survives about ten seconds of a demo before somebody
// clicks it, and because this project has twice been caught by a document asserting
// something that was never true.
//
// SO EVERY FAKE FIGURE LIVES HERE AND NOWHERE ELSE. No component types one of its own.
// Removing the lot is deleting this file and fixing the imports it breaks, which the
// compiler reports, rather than a hunt through components.
//
// TURN THEM OFF WITHOUT DELETING ANYTHING: set SHOW_PLACEHOLDER_FIGURES to false. The
// dashboard then builds its tiles from the database instead, the cycle banner says no
// cycle exists, and the action rows carry no status. Nothing else in this file is read
// while it is false.
//
// ─────────────────────────────────────────────────────────────────────────────
// THESE ARE NOT THE MOCKUPS' NUMBERS. Corrected 2026-08-26 on Nuzran's point: the
// mockups and the system are two different things, and the mockups were drawn before
// several rules were settled. Everything below is written from the specification's own
// vocabulary and rules, so that a teammate reading a placeholder learns something true
// about the system rather than something invented twice over:
//
//   · A cycle moves draft, open, COLLECTING, supervisor_review, normalising,
//     published, closed. "Collecting" is a real state, not a word for a progress bar.
//   · A review moves pending, in_progress, awaiting_supervisor, normalising,
//     published, ACKNOWLEDGED. Publishing is not the end; the employee acknowledges.
//   · A piece of feedback moves assigned, draft, submitted, LOCKED, and nothing
//     downstream may read it until it is locked, because the writer has 5 hours to
//     correct it.
//   · Six competencies today, four shared and two per job family, and NOTHING may
//     assume that number. It is written here as "4 of 6" only because these are fake
//     figures; real code reads the list and divides by what it found.
//   · A person receives 8 colleague reviews, minimum 5, or 3 in a small pool. A person
//     writes 8 a year. The supervisor is blocked until the minimum is in, and is then
//     unblocked automatically.
//   · Altrium is 45 people, which is the figure the spec itself uses, so every count
//     here that implies a company size uses 45 and they agree with each other.
//   · Scores are 1 to 5, and any competency may be marked "not observed" instead.
//   · Revealing a reviewer's identity requires a written reason. Reading gated content
//     is logged without one.
// ─────────────────────────────────────────────────────────────────────────────

// OFF since 2026-08-26, at Nuzran's request: the screen is being judged on what the
// system can actually answer today, not on what it will answer later. Everything in
// this file is dormant while it is false. Set it to true to get the illustrated
// version back for a walkthrough.
export const SHOW_PLACEHOLDER_FIGURES = false;

// The banner beside the greeting.
//
// The PAR group is the ONE real thing in it: it is derived from the signed in person's
// joining date and is already on their record, so it is passed in rather than invented.
// Everything else is placeholder.
export function placeholderCycleFor(parGroup) {
  const groupName = parGroup ? `${parGroup} group` : "all groups";
  const year = new Date().getFullYear();

  // Only the employee banner is here. The supervisor, HR, oversight, leadership and
  // admin versions were written and then held back with their groups; they are in
  // Project PDT/PDT-DASHBOARD-TABS-PENDING.md.
  return {
    title: `PAR ${year} · ${groupName}`,
    detail: "Collecting. Your self-assessment and your colleague reviews are open.",
    metricLabel: "Self-assessment",
    metricValue: "4 of 6",
    percent: 67,
  };
}

// The four tiles under QUICK OVERVIEW, for whichever group is the primary one.
export const PLACEHOLDER_TILES = {
  employee: [
    { value: "4 of 6", label: "Competencies you have answered", icon: "clipboard", tone: "violet" },
    { value: "3 of 8", label: "Colleague reviews you have written", icon: "message", tone: "blue" },
    { value: "5", label: "Plan actions in progress", icon: "trend", tone: "amber" },
    { value: "8 days", label: "Until collecting closes", icon: "calendar", tone: "green" },
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
  "my-result": [{ text: "PAR 2025 published, not acknowledged", tone: "warn", icon: "file" }],
  "my-development-plan": [
    { text: "5 actions", tone: "muted", icon: "trend" },
    { text: "1 not started", tone: "warn", icon: "clock" },
  ],
  "my-history": [{ text: "2 past cycles", tone: "muted", icon: "calendar" }],
};
