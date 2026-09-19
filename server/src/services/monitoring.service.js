const MonitoringFlag = require("../models/monitoringFlag.model");
const Audit = require("../models/audit.model");
const Review = require("../models/review.model");
const Cycle = require("../models/cycle.model");
const AppError = require("../utils/AppError");
const {
  MONITORING_FLAG_STATUS,
  REVEAL_THRESHOLD,
  FLAGGED_REFUSAL_CODES,
  ACTIVE_CYCLE_STAGES,
  WATCHED_HISTORY_TARGETS,
} = require("../config/constants");

// ⚠️ The checks hang off the two audit writes, not off their callers. Eight paths open and
// close dated records and one more will arrive; a caller that forgets to check is silent, and
// nothing else is watching.

const UNRESTRICTED_ROLE = "head_of_hr";

const REFUSAL_DETAIL = {
  not_hr: "Tried to reveal an identity without an HR role",
  outside_coverage: "Tried to reveal an identity outside their coverage",
  own_reporting_line: "Tried to reveal an identity inside their own reporting line",
};

const TARGET_NAMES = {
  unitMembership: "unit membership",
  unitLead: "unit leadership",
  hrCoverage: "HR coverage",
};

// ⚠️ A check that cannot run must never fail the action it was watching, exactly as the audit
// write must not. The gap is loud in the server output instead.
const guarded = (name, run) => async (args) => {
  try {
    return await run(args);
  } catch (error) {
    console.error("MONITORING CHECK FAILED", name, error.message);
    return null;
  }
};

// One open flag per officer, per cycle, per type: the count rises rather than the list growing
// into something nobody reads. A flag already marked reviewed is left alone and a new one opens.
const raise = async ({ type, officerId, cycleId = null, count, threshold = null, detail }) => {
  const open = await MonitoringFlag.findOne({ type, officerId, cycleId, status: "open" });

  if (!open) {
    return MonitoringFlag.create({
      type,
      officerId,
      cycleId,
      count: count || 1,
      threshold,
      detail,
    });
  }

  open.count = count || open.count + 1;
  open.detail = detail || open.detail;
  open.lastEventAt = new Date();
  return open.save();
};

// ⚠️ Counted from the trail rather than from a running total kept beside it, which would drift
// the moment an entry arrived by another path. One reveal is one piece of feedback: the same
// handle opened twice is one, and unmasking eight colleagues on one person is eight.
const countRevealsInCycle = async (officerId, cycleId) => {
  const reviewIds = await Review.find({ cycleId }).distinct("_id");
  if (!reviewIds.length) return 0;

  const entries = await Audit.find({
    actorId: officerId,
    action: "identity_reveal",
    outcome: "allowed",
    targetId: { $in: reviewIds },
  })
    .select("targetId feedbackLabel")
    .lean();

  return new Set(entries.map((e) => `${e.targetId}:${e.feedbackLabel}`)).size;
};

exports.onReveal = guarded("reveal", async ({ actorId, reviewId, outcome, refusalCode }) => {
  const review = await Review.findById(reviewId).select("cycleId").lean();
  const cycleId = review?.cycleId || null;

  if (outcome === "refused") {
    if (!FLAGGED_REFUSAL_CODES.includes(refusalCode)) return null;
    return raise({
      type: "improper_reveal",
      officerId: actorId,
      cycleId,
      detail: REFUSAL_DETAIL[refusalCode],
    });
  }

  if (!cycleId) return null;

  const count = await countRevealsInCycle(actorId, cycleId);
  if (count <= REVEAL_THRESHOLD) return null;

  return raise({
    type: "reveal_threshold",
    officerId: actorId,
    cycleId,
    count,
    threshold: REVEAL_THRESHOLD,
    detail: `${count} identity reveals in one cycle, where more than ${REVEAL_THRESHOLD} is unusual`,
  });
});

// The date being set is what matters, not the moment it was typed. A cycle merely open is not
// being worked on, and with cohort cycles overlapping across the whole calendar, flagging on
// that would flag every ordinary joiner and handover.
exports.onHistoryEdit = guarded("history edit", async ({ actorId, targetType, from, to }) => {
  if (!WATCHED_HISTORY_TARGETS.includes(targetType)) return null;

  const dates = [from, to].filter(Boolean).map((value) => new Date(value));
  if (!dates.length) return null;

  const active = await Cycle.find({ status: { $in: ACTIVE_CYCLE_STAGES } })
    .select("startDate endDate status")
    .lean();

  const raised = [];
  for (const cycle of active) {
    const landed = dates.find((date) => date >= cycle.startDate && date <= cycle.endDate);
    if (!landed) continue;

    raised.push(
      await raise({
        type: "history_edit_in_active_cycle",
        officerId: actorId,
        cycleId: cycle._id,
        detail:
          `Set a ${TARGET_NAMES[targetType]} date of ${landed.toISOString().slice(0, 10)}, ` +
          `inside a cycle that is ${cycle.status.replace(/_/g, " ")}`,
      }),
    );
  }
  return raised;
});

exports.assertMayRead = (actor) => {
  if (!(actor?.roles || []).includes(UNRESTRICTED_ROLE)) {
    throw new AppError("Only the Head of HR can read the monitoring flags", 403);
  }
};

// Open flags by default: a list that opens on everything ever raised is the log again.
exports.list = async (actor, { status = "open" } = {}) => {
  exports.assertMayRead(actor);

  if (status !== "all" && !MONITORING_FLAG_STATUS.includes(status)) {
    throw new AppError("That is not a flag status", 400);
  }

  const filter = status === "all" ? {} : { status };
  const items = await MonitoringFlag.find(filter)
    .sort({ lastEventAt: -1 })
    .populate("officerId", "name employeeId")
    .populate("reviewedBy", "name employeeId")
    .populate("cycleId", "parGroup year")
    .lean();

  return { items, total: items.length, openCount: await MonitoringFlag.countDocuments({ status: "open" }) };
};

exports.markReviewed = async (actor, id, note) => {
  exports.assertMayRead(actor);

  const flag = await MonitoringFlag.findById(id);
  if (!flag) throw new AppError("Flag not found", 404);

  // ⚠️ The Head of HR is the only reader there is, so without this the person being watched
  // clears their own name. It stays open instead, visibly.
  if (String(flag.officerId) === String(actor.id)) {
    throw new AppError("A flag about you cannot be marked reviewed by you", 403);
  }

  if (flag.status === "reviewed") {
    throw new AppError("That flag has already been marked reviewed", 409);
  }

  const written = (note || "").trim();
  if (!written) throw new AppError("A note is required before a flag is marked reviewed", 400);

  flag.status = "reviewed";
  flag.note = written;
  flag.reviewedBy = actor.id;
  flag.reviewedAt = new Date();
  await flag.save();

  return flag;
};
