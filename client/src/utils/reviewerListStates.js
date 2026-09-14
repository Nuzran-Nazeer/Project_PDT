export const LIST_STATE = {
  to_confirm: { label: "To confirm", tone: "font-medium text-brand" },
  awaiting_hr: { label: "Waiting for HR", tone: "text-muted" },
  ready_to_draw: { label: "Ready to draw", tone: "font-medium text-success" },
  drawn: { label: "Reviewers chosen", tone: "text-muted" },
  already_chosen: { label: "Reviewers already chosen", tone: "text-muted" },
  not_collecting: { label: "Cycle is not collecting", tone: "text-muted" },
  no_review: { label: "No review running", tone: "text-muted" },
};

export const stateLabel = (state) =>
  LIST_STATE[state] || { label: state, tone: "text-muted" };
