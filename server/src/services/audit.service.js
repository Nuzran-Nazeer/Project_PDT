const Audit = require("../models/audit.model");
const AppError = require("../utils/AppError");
const monitoring = require("./monitoring.service");
const { AUDIT_ACTIONS, AUDIT_OUTCOMES } = require("../config/constants");

// ⚠️ The only way an entry is written. Callers never touch the model: the write must not be
// able to fail the action it is recording, and that rule lives in one place.

const UNRESTRICTED_ROLE = "head_of_hr";
const PAGE_SIZE = 50;

// ⚠️ A failed write must never take down the action it records. An HR officer being unable to
// cancel a cycle because the log is unreachable is worse than a gap, and the gap is loud in the
// server output. The one thing this must not do is swallow the caller's own error.
exports.record = async (entry) => {
  try {
    return await Audit.create({ ...entry, at: entry.at || new Date() });
  } catch (error) {
    console.error("AUDIT WRITE FAILED", entry.action, entry.outcome, error.message);
    return null;
  }
};

// The reason is required for a reveal and refused everywhere it is not, so the shape of the
// call is checked rather than trusted.
exports.recordReveal = async ({
  actor,
  review,
  label,
  reason,
  outcome,
  refusalCode,
  detail,
}) => {
  const entry = await exports.record({
    actorId: actor.id,
    action: "identity_reveal",
    outcome,
    subjectUserId: review.userId,
    targetType: "review",
    targetId: review._id,
    feedbackLabel: label || null,
    reason: (reason || "").trim() || null,
    refusalCode: outcome === "refused" ? refusalCode || null : null,
    detail,
  });

  // The monitoring checks hang off the write, not off the caller: an endpoint that forgets
  // to run them is silent, and nothing else watches this route.
  await monitoring.onReveal({
    actorId: actor.id,
    reviewId: review._id,
    outcome,
    refusalCode,
  });

  return entry;
};

// Opening or closing a dated record. The change is the point here, so both ends are stored:
// supervision, coverage and eligibility are all derived from these dates, and moving one moves
// who could see and do what for a period that may already be over.
exports.recordHistoryEdit = async ({
  actor,
  targetType,
  record,
  subjectUserId,
  detail,
  from,
  to,
}) => {
  const entry = await exports.record({
    actorId: actor.id,
    action: "history_edit",
    subjectUserId: subjectUserId || null,
    targetType,
    targetId: record?._id || null,
    detail,
    change: {
      from: from ? new Date(from).toISOString().slice(0, 10) : null,
      to: to ? new Date(to).toISOString().slice(0, 10) : null,
    },
  });

  await monitoring.onHistoryEdit({ actorId: actor.id, targetType, from, to });

  return entry;
};

exports.assertMayRead = (actor) => {
  if (!(actor?.roles || []).includes(UNRESTRICTED_ROLE)) {
    throw new AppError("Only the Head of HR can read the audit trail", 403);
  }
};

// Filters are all optional and narrow the same list; nothing here widens it.
exports.list = async (
  actor,
  { action, outcome, subjectUserId, actorId, page = 1 } = {},
) => {
  exports.assertMayRead(actor);

  if (action && !AUDIT_ACTIONS.includes(action)) {
    throw new AppError("That is not an audited action", 400);
  }
  if (outcome && !AUDIT_OUTCOMES.includes(outcome)) {
    throw new AppError("That is not a valid outcome", 400);
  }

  const filter = {};
  if (action) filter.action = action;
  if (outcome) filter.outcome = outcome;
  if (subjectUserId) filter.subjectUserId = subjectUserId;
  if (actorId) filter.actorId = actorId;

  const wanted = Math.max(1, Number(page) || 1);
  const [items, total] = await Promise.all([
    Audit.find(filter)
      .sort({ at: -1 })
      .skip((wanted - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate("actorId", "name employeeId")
      .populate("subjectUserId", "name employeeId")
      .lean(),
    Audit.countDocuments(filter),
  ]);

  return { items, total, page: wanted, pageSize: PAGE_SIZE };
};
