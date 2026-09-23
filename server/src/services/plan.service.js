const Plan = require("../models/plan.model");
const Review = require("../models/review.model");
const Feedback = require("../models/feedback.model");
const Cycle = require("../models/cycle.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { teamOn } = require("./supervision.service");
const { membershipOn } = require("./unitmembership.service");
const {
  assertHrMayRead,
  assertMayActOnEmployee,
  assertNotInReportingLine,
  readScopeFor,
} = require("./coverageAuth.service");
const audit = require("./audit.service");
const {
  competenciesFor,
  PLAN_ACTION_CATEGORIES,
  PLAN_ACTION_OPEN_STATUS,
  CHECK_IN_OUTCOMES,
  CARRY_FORWARD_REASONS,
  CHECK_IN_MONTH_OFFSETS,
  CHECK_IN_WINDOW_DAYS,
  MEETING_INTERVAL_DAYS,
  MEETING_WINDOW_DAYS,
  EXPECTED_CHECK_INS,
  PUBLISHED_STATES,
  IMPROVEMENT_PLAN_TYPES,
  IMPROVEMENT_MIN_DAYS,
  IMPROVEMENT_MAX_DAYS,
  IMPROVEMENT_TRIGGER_SCORE,
  PLAN_APPROVAL_DECISIONS,
  IMPROVEMENT_SUPERVISOR_OUTCOMES,
  IMPROVEMENT_HR_OUTCOMES,
} = require("../config/constants");

// ⚠️ Every write here refuses in this service, not only on the route: the review must be
// published and the actor must supervise that employee today. Nothing stores who owns a plan,
// so "today" is the whole of the transfer rule.

const today = () => new Date();

const asPerson = (user) =>
  user ? { id: String(user._id), name: user.name, employeeId: user.employeeId } : null;

// The competency set the review was opened under, never today's: a move to another job
// family must not relabel what a past review asked about. The end of the period that review
// assessed is what every check-in date is counted from.
const contextForReview = async (review) => {
  const jobFamily =
    review?.snapshot?.jobFamily ||
    (await User.findById(review?.userId).select("jobFamily"))?.jobFamily ||
    null;

  const cycle = review?.cycleId
    ? await Cycle.findById(review.cycleId).select("endDate")
    : null;

  return {
    competencies: competenciesFor(jobFamily),
    assessedTo: cycle?.endDate || null,
  };
};

const isPublished = (review) =>
  Boolean(review?.publishedAt) && PUBLISHED_STATES.includes(review.status);

// ⚠️ Derived on read, never stored, and never a state an action is saved in.
const displayStatus = (action, on) =>
  action.status === "not_started" || action.status === "in_progress"
    ? action.targetDate && action.targetDate.getTime() < on.getTime()
      ? "overdue"
      : action.status
    : action.status;

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const at = new Date(date);
  at.setHours(0, 0, 0, 0);
  return at;
};

const wholeDaysBetween = (from, to) =>
  Math.max(0, Math.floor((startOfDay(to) - startOfDay(from)) / DAY_MS));

// ⚠️ Clamped to the end of the shorter month. Left to `setMonth`, the 31st of a month four
// months before a 30-day one rolls forward into the month after, and a due date quietly moves.
const addMonths = (date, months) => {
  const at = new Date(date);
  const day = at.getDate();

  at.setDate(1);
  at.setMonth(at.getMonth() + months);

  const lastOfMonth = new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate();
  at.setDate(Math.min(day, lastOfMonth));

  return at;
};

// Three windows a year, each a week the two of them place the conversation in, counted from
// the end of the period the review assessed. ⚠️ The plan closes when the next cycle starts
// collecting, so the last window can pass unopened; that reads as missed, never as an error.
const checkInWindows = (assessedTo, held, on) => {
  if (!assessedTo) return [];

  return CHECK_IN_MONTH_OFFSETS.map((months, index) => {
    const dueOn = addMonths(assessedTo, months);
    const opensOn = new Date(dueOn.getTime() - (CHECK_IN_WINDOW_DAYS - 1) * DAY_MS);

    let state = "upcoming";
    if (index < held) state = "held";
    else if (startOfDay(on) > startOfDay(dueOn)) state = "missed";
    else if (startOfDay(on) >= startOfDay(opensOn)) state = "open";

    return { number: index + 1, opensOn, dueOn, state };
  });
};

// An improvement plan's meetings, monthly from its own start date. ⚠️ A due date past the end
// date is not counted, so nothing is ever marked missed for a meeting that could not happen.
// Extending the plan moves the end date, which is how added time brings further meetings due.
const meetingDueDates = (plan) => {
  if (!plan.startDate || !plan.endDate) return [];

  const from = startOfDay(plan.startDate);
  const until = startOfDay(plan.endDate);
  const dates = [];

  for (let number = 1; ; number += 1) {
    const dueOn = new Date(from.getTime() + number * MEETING_INTERVAL_DAYS * DAY_MS);
    if (dueOn > until) return dates;
    dates.push({ number, dueOn });
  }
};

// ⚠️ Matched by date, never by position. A development plan's check-ins fill their windows in
// order; a meeting counts against whichever due date it lands within a week of.
const meetingWindows = (plan, on) => {
  const taken = new Set();

  return meetingDueDates(plan).map(({ number, dueOn }) => {
    const opensOn = new Date(dueOn.getTime() - MEETING_WINDOW_DAYS * DAY_MS);
    const closesOn = new Date(dueOn.getTime() + MEETING_WINDOW_DAYS * DAY_MS);

    const index = plan.checkIns.findIndex(
      (meeting, at) =>
        !taken.has(at) &&
        startOfDay(meeting.at) >= opensOn &&
        startOfDay(meeting.at) <= closesOn,
    );

    if (index >= 0) {
      taken.add(index);
      return { number, opensOn, dueOn, closesOn, state: "held" };
    }

    let state = "upcoming";
    if (startOfDay(on) > closesOn) state = "missed";
    else if (startOfDay(on) >= opensOn) state = "open";

    return { number, opensOn, dueOn, closesOn, state };
  });
};

const asCheckIn = (checkIn, index) => ({
  // Position is the check-in number: the array is only ever appended to.
  number: index + 1,
  additional: index >= EXPECTED_CHECK_INS,
  at: checkIn.at,
  recordedAt: checkIn.recordedAt,
  outcome: checkIn.outcome,
  note: checkIn.note,
  by: asPerson(checkIn.byId),
});

// ⚠️ Two schedules, not one. A development plan owes three windows counted off the period its
// review assessed; an improvement plan owes one a month counted off its own start date.
const checkInSummary = (plan, assessedTo, on) => {
  const held = plan.checkIns.length;

  const windows =
    plan.type === "PIP" ? meetingWindows(plan, on) : checkInWindows(assessedTo, held, on);

  // A plan with no dates yet owes nothing, and an improvement plan has none until it is shared.
  const expected =
    plan.type === "PIP"
      ? plan.startDate && plan.endDate
        ? windows.length
        : null
      : EXPECTED_CHECK_INS;

  return {
    expected,
    held,
    remaining: expected === null ? null : Math.max(0, expected - held),
    additional: expected === null ? 0 : Math.max(0, held - expected),
    canRecord: plan.status === "active",
    windows,
    entries: plan.checkIns.map(asCheckIn),
  };
};

// What a carried action still owes before the plan can be shared: a reason from the fixed list,
// and a deadline that is not the one it arrived with.
const carryDebt = (action) => {
  const arrived = action.carriedFrom?.[action.carriedFrom.length - 1];
  if (!arrived) return null;

  const missing = [];
  if (!CARRY_FORWARD_REASONS.includes(action.carryReason)) missing.push("carryReason");

  const arrivedOn = arrived.targetDate?.getTime();
  if (arrivedOn && action.targetDate?.getTime() === arrivedOn) missing.push("targetDate");

  return missing.length ? missing : null;
};

// The supervisor's and HR's view of an action. ⚠️ The employee's view is built elsewhere and
// carries neither `fromCompetency` nor anything derived from it.
const asAction = (action, competencies, on) => {
  const competency = competencies.find((c) => c.key === action.fromCompetency) || null;

  return {
    id: String(action._id),
    description: action.description,
    category: action.category,
    fromCompetency: action.fromCompetency,
    competencyName: competency?.name || action.fromCompetency,
    owner: asPerson(action.ownerId),
    targetDate: action.targetDate,
    successCriteria: action.successCriteria,
    status: displayStatus(action, on),
    lastUpdatedAt: action.lastUpdatedAt,
    daysSinceChange: action.lastUpdatedAt
      ? wholeDaysBetween(action.lastUpdatedAt, on)
      : null,
    carriedTimes: action.carriedFrom?.length || 0,
    carryReason: action.carryReason,
    carriedTargetDate: action.carriedFrom?.[action.carriedFrom.length - 1]?.targetDate,
    owes: carryDebt(action),
    progressNotes: action.progressNotes.map((note) => ({
      note: note.note,
      by: asPerson(note.byId),
      at: note.at,
    })),
  };
};

// Least recently changed first, so an action nobody has touched for months is the one read
// before any other. ⚠️ Sorted on a copy: the stored order is the order they were written in.
const byStalest = (actions) =>
  [...actions].sort(
    (a, b) => (a.lastUpdatedAt?.getTime() || 0) - (b.lastUpdatedAt?.getTime() || 0),
  );

// The dates and the case type, which only an improvement plan carries. ⚠️ Never reached from
// the employee's projection, which is built field by field: the case type is HR's alone.
const improvementOf = (plan, on) =>
  plan.type !== "PIP"
    ? null
    : {
        type: plan.improvementType,
        forCompetency: plan.forCompetency,
        durationDays: plan.durationDays,
        endDate: plan.endDate,
        daysRemaining: plan.endDate ? wholeDaysBetween(on, plan.endDate) : null,
        submittedAt: plan.submittedAt,
        extension: plan.extension
          ? {
              at: plan.extension.at,
              by: asPerson(plan.extension.byId),
              reason: plan.extension.reason,
              days: plan.extension.days,
              previousEndDate: plan.extension.previousEndDate,
            }
          : null,
        escalation: plan.escalation
          ? {
              at: plan.escalation.at,
              by: asPerson(plan.escalation.byId),
              note: plan.escalation.note,
            }
          : null,
        canExtend: plan.status === "active" && !plan.extension && !plan.escalation,
        canClose: plan.status === "active" && !plan.escalation,
        approval: plan.approval
          ? {
              decision: plan.approval.decision,
              by: asPerson(plan.approval.byId),
              at: plan.approval.at,
              reason: plan.approval.reason,
            }
          : null,
        trigger: plan.trigger
          ? {
              source: plan.trigger.source,
              reviewId: plan.trigger.reviewId ? String(plan.trigger.reviewId) : null,
              planId: plan.trigger.planId ? String(plan.trigger.planId) : null,
              checkInNumber: plan.trigger.checkInNumber,
            }
          : null,
      };

const asPlan = (plan, { competencies, assessedTo }, on = today()) => ({
  id: String(plan._id),
  type: plan.type,
  status: plan.status,
  employee: asPerson(plan.userId),
  reviewId: plan.reviewId ? String(plan.reviewId) : null,
  createdBy: asPerson(plan.createdBy),
  sharedAt: plan.sharedAt,
  acknowledgedAt: plan.acknowledgedAt,
  startDate: plan.startDate,
  closeDate: plan.closeDate,
  outcome: plan.outcome,
  outcomeReason: plan.outcomeReason,
  competencies,
  actions: byStalest(plan.actions).map((action) => asAction(action, competencies, on)),
  checkIns: checkInSummary(plan, assessedTo, on),
  canEdit: plan.status === "draft",
  closure: closureOf(plan),
  improvement: improvementOf(plan, on),
});

// How a closed plan ended, counted from the actions rather than stored twice.
const closureOf = (plan) =>
  plan.status === "closed"
    ? {
        closeDate: plan.closeDate,
        completed: plan.actions.filter((a) => a.status === "done").length,
        carried: plan.actions.filter((a) => a.status === "carried_forward").length,
      }
    : null;

const populated = (query) =>
  query
    .populate("userId", "name employeeId")
    .populate("createdBy", "name employeeId")
    .populate("approval.byId", "name employeeId")
    .populate("extension.byId", "name employeeId")
    .populate("escalation.byId", "name employeeId")
    .populate("closedBy", "name employeeId")
    .populate("actions.ownerId", "name employeeId")
    .populate("actions.progressNotes.byId", "name employeeId")
    .populate("checkIns.byId", "name employeeId");

// Who the actor supervises today, as a map. One call answers both the list and the guard,
// and both then agree by construction.
const supervisedTodayBy = async (actorId) => {
  const { team } = await teamOn(actorId, today());
  return new Map(team.map((member) => [String(member.id), member]));
};

// ⚠️ Refuses without naming the employee or their unit: a refusal that confirms who somebody
// reports to is itself a disclosure.
const assertSupervisesToday = async (actorId, employeeId) => {
  const team = await supervisedTodayBy(actorId);
  if (!team.has(String(employeeId))) {
    throw new AppError("You do not supervise this person today", 403);
  }
};

// Open, for an improvement plan: one is running from the moment it is drafted, so a second
// cannot be started beside it.
const IMPROVEMENT_OPEN = [
  "draft",
  "awaiting_approval",
  "approved",
  "awaiting_ack",
  "active",
];

// ⚠️ An approved plan is locked as hard as a shared one. Editing the actions after HR agreed
// to them would leave the approval attached to a document nobody with authority ever read.
const assertDraft = (plan) => {
  if (plan.status === "draft") return;

  const why = {
    awaiting_approval: "This plan is with HR for a decision, so it cannot be edited",
    approved: "This plan has been approved, so it can no longer be edited",
  };

  throw new AppError(
    why[plan.status] || "This plan has been shared, so it can no longer be edited",
    409,
  );
};

// ⚠️ Active, never merely shared. The employee's acknowledgement is what makes the plan
// agreed, so both a conversation about it and a move on one of its actions wait for that.
const assertActive = (plan) => {
  if (plan.status !== "active") {
    throw new AppError(
      plan.status === "closed"
        ? "This plan has closed, so nothing further can be recorded on it"
        : "This plan is not active yet, so nothing can be recorded on it",
      409,
    );
  }
};

// Everyone the supervisor supervises today whose review is published, marked owed where no
// plan has been written and draft or shared where one has. ⚠️ Someone they supervised last
// year and not now is absent, because the list is built from today's team and nothing else.
const teamPlans = async (actorId) => {
  const team = [...(await supervisedTodayBy(actorId)).values()];

  const reviews = await Review.find({
    userId: { $in: team.map((member) => member.id) },
    status: { $in: PUBLISHED_STATES },
  })
    .sort({ publishedAt: -1 })
    .select("_id userId publishedAt");

  // Sorted newest first, so the first per person is the one a plan is written against.
  const reviewFor = new Map();
  for (const review of reviews) {
    const key = String(review.userId);
    if (!reviewFor.has(key)) reviewFor.set(key, review);
  }

  const plans = await Plan.find({
    reviewId: { $in: [...reviewFor.values()].map((r) => r._id) },
    type: "PDP",
  }).select("_id reviewId status actions sharedAt");

  const planFor = new Map(plans.map((plan) => [String(plan.reviewId), plan]));

  // An open improvement plan is the supervisor's own work, so it is named here. ⚠️ The
  // employee's pages carry nothing about it, and neither does anyone else's list.
  const improvements = await Plan.find({
    userId: { $in: team.map((member) => member.id) },
    type: "PIP",
    status: { $in: IMPROVEMENT_OPEN },
  }).select("_id userId status");

  const improvementFor = new Map(improvements.map((plan) => [String(plan.userId), plan]));

  return {
    on: today().toISOString().slice(0, 10),
    people: team
      .map((member) => {
        const review = reviewFor.get(String(member.id));
        if (!review) return null;

        const plan = planFor.get(String(review._id)) || null;

        return {
          ...asPerson({
            _id: member.id,
            name: member.name,
            employeeId: member.employeeId,
          }),
          designation: member.designation || null,
          unit: member.unit || null,
          reviewId: String(review._id),
          publishedAt: review.publishedAt,
          planId: plan ? String(plan._id) : null,
          // `owed` is the absence of a plan, not a stored state.
          state: plan ? (plan.status === "draft" ? "draft" : "shared") : "owed",
          actionCount: plan ? plan.actions.length : 0,
          improvement: improvementFor.has(String(member.id))
            ? {
                id: String(improvementFor.get(String(member.id))._id),
                status: improvementFor.get(String(member.id)).status,
              }
            : null,
        };
      })
      .filter(Boolean),
  };
};

// What the last closed plan left unfinished, shaped to start the new one. ⚠️ Each keeps the
// competency it originally came from and takes a fresh entry, so an action carried twice shows
// both. The reason and a new date are left empty on purpose: they are what the supervisor owes
// before this plan can be shared.
const carriedActionsFor = async (userId) => {
  const previous = await Plan.findOne({ userId, type: "PDP", status: "closed" }).sort({
    closeDate: -1,
  });
  if (!previous) return [];

  return previous.actions
    .filter((action) => action.status === "carried_forward")
    .map((action) => ({
      description: action.description,
      category: action.category,
      fromCompetency: action.fromCompetency,
      ownerId: action.ownerId,
      targetDate: action.targetDate,
      successCriteria: action.successCriteria,
      status: "not_started",
      carriedFrom: [
        ...action.carriedFrom,
        {
          planId: previous._id,
          competency: action.fromCompetency,
          targetDate: action.targetDate,
        },
      ],
      carryReason: null,
    }));
};

// Starting a plan twice on the same review opens the one already there rather than making a
// second. ⚠️ The unique index on `reviewId` is the real guarantee; this read is the friendly
// answer, and two requests racing each other still lose one to the database.
const startPlanFromReview = async (reviewId, actor) => {
  const review = await Review.findById(reviewId).select(
    "_id userId status publishedAt snapshot cycleId",
  );
  if (!review) throw new AppError("Review not found", 404);

  if (!isPublished(review)) {
    throw new AppError(
      "A development plan can only be written against a published review",
      409,
    );
  }

  await assertSupervisesToday(actor.id, review.userId);

  const existing = await populated(Plan.findOne({ reviewId: review._id, type: "PDP" }));
  if (existing) return asPlan(existing, await contextForReview(review));

  const created = await Plan.create({
    userId: review.userId,
    reviewId: review._id,
    type: "PDP",
    status: "draft",
    createdBy: actor.id,
    actions: await carriedActionsFor(review.userId),
  });

  return asPlan(
    await populated(Plan.findById(created._id)),
    await contextForReview(review),
  );
};

// ⚠️ The only dates in the system taken from the calendar. The day it is started and the
// duration give the end date, and neither the start nor the end is ever typed.
const windowFor = (durationDays) => {
  const startDate = startOfDay(today());
  return {
    startDate,
    endDate: new Date(startDate.getTime() + durationDays * DAY_MS),
  };
};

// ⚠️ Only ever asked of an improvement plan. A development plan has no window of its own: its
// dates come from the employee's cycle, and an action may sit anywhere in the year.
const outsideWindow = (plan, date) =>
  (plan.startDate && startOfDay(date) < startOfDay(plan.startDate)) ||
  (plan.endDate && startOfDay(date) > startOfDay(plan.endDate));

// ⚠️ Ratings only, and the record never leaves this function: nothing here may serve a
// reviewer's identity. A supervisor review is attributed in any case, which is not the point.
const lowlyScored = async (reviewId) => {
  const doc = await Feedback.findOne({ reviewId, reviewerType: "supervisor" })
    .select("ratings")
    .sort({ submittedAt: -1 });

  // A competency the supervisor declined counts neither way.
  return (doc?.ratings || []).some(
    (row) =>
      !row.notObserved &&
      typeof row.score === "number" &&
      row.score <= IMPROVEMENT_TRIGGER_SCORE,
  );
};

// ⚠️ One low competency, never an overall rating: nothing in the system stores one. Both the
// raw and the adjusted figures belong to normalisation, and neither has ever been written.
const triggerFromReview = async (reviewId, actor) => {
  const review = await Review.findById(reviewId).select("_id userId status publishedAt");
  if (!review) throw new AppError("Review not found", 404);

  if (!isPublished(review)) {
    throw new AppError(
      "An improvement plan can only be started from a published result",
      409,
    );
  }

  await assertSupervisesToday(actor.id, review.userId);

  if (!(await lowlyScored(review._id))) {
    throw new AppError(
      `An improvement plan can only be started where a competency was scored ${IMPROVEMENT_TRIGGER_SCORE} or below`,
      409,
    );
  }

  return {
    userId: review.userId,
    trigger: { source: "review", reviewId: review._id },
  };
};

// A development-plan conversation that went off track, at any point in the year. ⚠️ Position
// in the array is the check-in number; nothing stores one.
const triggerFromCheckIn = async (planId, number, actor) => {
  const plan = await Plan.findById(planId).select("userId type checkIns");
  if (!plan || plan.type !== "PDP") throw new AppError("Plan not found", 404);

  await assertSupervisesToday(actor.id, plan.userId);

  const checkIn = plan.checkIns[Number(number) - 1];
  if (!checkIn) throw new AppError("Check-in not found", 404);

  if (checkIn.outcome !== "off_track") {
    throw new AppError(
      "An improvement plan can only be started from a check-in recorded as off track",
      409,
    );
  }

  return {
    userId: plan.userId,
    trigger: {
      source: "check_in",
      planId: plan._id,
      checkInNumber: Number(number),
    },
  };
};

// Two entry points, one route: everything after creation is identical, so the trigger is
// recorded and the plan behaves the same either way.
const startImprovementPlan = async (body, actor) => {
  const { improvementType, forCompetency, source } = body || {};
  const durationDays = Number(body?.durationDays);

  const missing = [];
  if (!IMPROVEMENT_PLAN_TYPES.includes(improvementType)) missing.push("improvementType");
  if (!String(forCompetency || "").trim()) missing.push("forCompetency");
  if (
    !Number.isInteger(durationDays) ||
    durationDays < IMPROVEMENT_MIN_DAYS ||
    durationDays > IMPROVEMENT_MAX_DAYS
  ) {
    missing.push("durationDays");
  }

  if (missing.length) {
    const error = new AppError("This improvement plan is not complete", 400);
    error.details = missing;
    throw error;
  }

  const { userId, trigger } =
    source === "check_in"
      ? await triggerFromCheckIn(body.planId, body.checkInNumber, actor)
      : await triggerFromReview(body?.reviewId, actor);

  // The set the employee is assessed on today. An improvement plan is written against no
  // review, so there is no earlier set to hold it to.
  const context = await contextForReview({ userId });
  if (!context.competencies.some((row) => row.key === forCompetency)) {
    throw new AppError("That is not a competency this employee is assessed on", 400);
  }

  const open = await Plan.findOne({
    userId,
    type: "PIP",
    status: { $in: IMPROVEMENT_OPEN },
  }).select("_id");

  if (open) {
    throw new AppError("This person already has an improvement plan open", 409);
  }

  // ⚠️ `reviewId` stays null whatever started it. The unique index on it belongs to the
  // development plan written against that same review, and a second record collides.
  const created = await Plan.create({
    userId,
    type: "PIP",
    status: "draft",
    createdBy: actor.id,
    improvementType,
    forCompetency,
    durationDays,
    trigger,
  });

  await audit.record({
    actorId: actor.id,
    action: "improvement_plan_started",
    outcome: "allowed",
    subjectUserId: userId,
    targetType: "plan",
    targetId: created._id,
    detail: "Started an improvement plan",
  });

  return asPlan(await populated(Plan.findById(created._id)), context);
};

// Loads a plan and refuses unless the actor supervises its employee today.
// ⚠️ A closed improvement plan is refused here as well. The employee keeps theirs and so does
// HR; the supervisor's ends with the plan, the same way access ends everywhere else.
const supervisorPlan = async (planId, actorId) => {
  const plan = await populated(Plan.findById(planId));
  if (!plan) throw new AppError("Plan not found", 404);

  await assertSupervisesToday(actorId, plan.userId._id);

  if (plan.type === "PIP" && plan.status === "closed") {
    throw new AppError(
      "This improvement plan has closed, so it is no longer open to you",
      403,
    );
  }

  return plan;
};

const getPlanForSupervisor = async (planId, actor) => {
  const plan = await supervisorPlan(planId, actor.id);
  const review = await Review.findById(plan.reviewId).select("userId snapshot cycleId");

  return asPlan(plan, await contextForReview(review || plan));
};

// ⚠️ Every field is required, and the response names all of the empty ones at once rather
// than the first: a form that reveals one missing field per attempt is a form nobody finishes.
const assertActionComplete = (body, plan, competencies, actorId, action = null) => {
  const missing = [];

  if (!String(body.description || "").trim()) missing.push("description");

  if (!PLAN_ACTION_CATEGORIES.includes(body.category)) missing.push("category");

  const ownerId = String(body.ownerId || "");
  const mayOwn = [String(plan.userId._id || plan.userId), String(actorId)];
  if (!mayOwn.includes(ownerId)) missing.push("ownerId");

  const targetDate = body.targetDate ? new Date(body.targetDate) : null;
  if (!targetDate || Number.isNaN(targetDate.getTime())) missing.push("targetDate");

  if (!String(body.successCriteria || "").trim()) missing.push("successCriteria");

  if (!competencies.some((c) => c.key === body.fromCompetency)) {
    missing.push("fromCompetency");
  }

  // Only ever asked of an action that arrived from a closed plan.
  const carried = Boolean(action?.carriedFrom?.length);
  if (carried && !CARRY_FORWARD_REASONS.includes(body.carryReason)) {
    missing.push("carryReason");
  }

  if (missing.length) {
    const error = new AppError("This action is not complete", 400);
    error.details = missing;
    throw error;
  }

  return {
    description: String(body.description).trim(),
    category: body.category,
    fromCompetency: body.fromCompetency,
    ownerId,
    targetDate,
    successCriteria: String(body.successCriteria).trim(),
    ...(carried ? { carryReason: body.carryReason } : {}),
  };
};

const contextForPlan = async (plan) => {
  const review = await Review.findById(plan.reviewId).select("userId snapshot cycleId");

  // An improvement plan is written against no review, so the wording is the set the employee
  // is under today and there is no assessed period to count check-in windows from.
  return contextForReview(review || { userId: plan.userId?._id || plan.userId });
};

const addAction = async (planId, actor, body) => {
  const plan = await supervisorPlan(planId, actor.id);
  assertDraft(plan);

  const context = await contextForPlan(plan);
  plan.actions.push(assertActionComplete(body, plan, context.competencies, actor.id));
  await plan.save();

  return asPlan(await populated(Plan.findById(plan._id)), context);
};

const editAction = async (planId, actionId, actor, body) => {
  const plan = await supervisorPlan(planId, actor.id);
  assertDraft(plan);

  const action = plan.actions.id(actionId);
  if (!action) throw new AppError("Action not found", 404);

  const context = await contextForPlan(plan);
  action.set(assertActionComplete(body, plan, context.competencies, actor.id, action));
  await plan.save();

  return asPlan(await populated(Plan.findById(plan._id)), context);
};

const removeAction = async (planId, actionId, actor) => {
  const plan = await supervisorPlan(planId, actor.id);
  assertDraft(plan);

  const action = plan.actions.id(actionId);
  if (!action) throw new AppError("Action not found", 404);

  action.deleteOne();
  await plan.save();

  return asPlan(await populated(Plan.findById(plan._id)), await contextForPlan(plan));
};

// ⚠️ A development plan is shared straight from draft. An improvement plan reaches the
// employee only once a second person has agreed it should, which is a confidentiality control.
const assertMayShare = (plan) => {
  if (plan.type !== "PIP") return assertDraft(plan);
  if (plan.status === "approved") return;

  const why = {
    draft: "An improvement plan has to be approved by HR before it can be shared",
    awaiting_approval: "This plan is still with HR for a decision",
  };

  throw new AppError(why[plan.status] || "This plan has already been shared", 409);
};

// Sent to HR, not to the employee. An empty plan is refused here as well as at sharing: a
// plan with no actions is nothing for an officer to form a view on.
const submitForApproval = async (planId, actor) => {
  const plan = await supervisorPlan(planId, actor.id);

  if (plan.type !== "PIP") {
    throw new AppError("A development plan is not approved by anyone", 409);
  }

  assertDraft(plan);

  if (plan.actions.length === 0) {
    throw new AppError("A plan with no actions cannot be sent for approval", 409);
  }

  plan.status = "awaiting_approval";
  plan.submittedAt = new Date();
  await plan.save();

  return asPlan(await populated(Plan.findById(plan._id)), await contextForPlan(plan));
};

// Sharing is what hands the plan to the employee to acknowledge. It is refused on an empty
// plan: a plan with no actions is nothing to agree to.
const sharePlan = async (planId, actor) => {
  const plan = await supervisorPlan(planId, actor.id);
  assertMayShare(plan);

  if (plan.actions.length === 0) {
    throw new AppError("A plan with no actions cannot be shared", 409);
  }

  // ⚠️ An action arriving from a closed plan owes a reason and a new deadline before anyone
  // agrees to it. Refused here rather than on the form, which only hides the way in.
  const owing = plan.actions.filter((action) => carryDebt(action));
  if (owing.length) {
    const error = new AppError(
      owing.length === 1
        ? "One action carried forward still needs a reason and a new target date"
        : `${owing.length} actions carried forward still need a reason and a new target date`,
      409,
    );
    error.details = owing.map((action) => String(action._id));
    throw error;
  }

  // ⚠️ An improvement plan's window opens on the day it is shared, so its dates are worked
  // out here and its actions are measured against them for the first time.
  if (plan.type === "PIP") {
    plan.set(windowFor(plan.durationDays));

    const outside = plan.actions.filter((action) =>
      outsideWindow(plan, action.targetDate),
    );

    if (outside.length) {
      const error = new AppError(
        outside.length === 1
          ? "One action has a target date outside the plan's own dates"
          : `${outside.length} actions have target dates outside the plan's own dates`,
        409,
      );
      error.details = outside.map((action) => String(action._id));
      throw error;
    }
  }

  // ⚠️ An improvement plan is active the moment it is shared. It cannot wait on the person it
  // concerns, so their acknowledgement only records that they read it.
  plan.status = plan.type === "PIP" ? "active" : "awaiting_ack";
  plan.sharedAt = new Date();
  await plan.save();

  if (plan.type === "PIP") {
    await audit.record({
      actorId: actor.id,
      action: "improvement_plan_shared",
      outcome: "allowed",
      subjectUserId: plan.userId._id,
      targetType: "plan",
      targetId: plan._id,
      detail: "Shared an improvement plan with the employee",
    });
  }

  return asPlan(await populated(Plan.findById(plan._id)), await contextForPlan(plan));
};

// ⚠️ Names every empty field at once, the same as an action: one missing field per attempt
// is a form nobody finishes.
const assertCheckInComplete = (body, plan, on) => {
  const missing = [];

  if (!CHECK_IN_OUTCOMES.includes(body?.outcome)) missing.push("outcome");
  if (!String(body?.note || "").trim()) missing.push("note");

  const at = body?.at ? new Date(body.at) : new Date(on);
  if (Number.isNaN(at.getTime())) missing.push("at");

  if (missing.length) {
    const error = new AppError("This check-in is not complete", 400);
    error.details = missing;
    throw error;
  }

  if (startOfDay(at) > startOfDay(on)) {
    throw new AppError("A check-in cannot be dated in the future", 400);
  }

  if (plan.acknowledgedAt && startOfDay(at) < startOfDay(plan.acknowledgedAt)) {
    throw new AppError("A check-in cannot be dated before the plan was agreed", 400);
  }

  return {
    at,
    recordedAt: new Date(),
    outcome: body.outcome,
    note: String(body.note).trim(),
  };
};

// ⚠️ Appended and never afterwards edited or removed: a check-in records a conversation that
// happened on a day. A correction is a further check-in, which is why extra ones are allowed.
const recordCheckIn = async (planId, actor, body) => {
  const plan = await supervisorPlan(planId, actor.id);
  assertActive(plan);

  plan.checkIns.push({
    ...assertCheckInComplete(body, plan, today()),
    byId: actor.id,
  });
  await plan.save();

  return asPlan(await populated(Plan.findById(plan._id)), await contextForPlan(plan));
};

// The supervisor's alone, including on an action the employee owns: somebody other than the
// person doing the work confirms it is done.
const setActionStatus = async (planId, actionId, actor, body) => {
  const plan = await supervisorPlan(planId, actor.id);
  assertActive(plan);

  if (!PLAN_ACTION_OPEN_STATUS.includes(body?.status)) {
    throw new AppError("That is not a state an action can be moved to", 400);
  }

  const action = plan.actions.id(actionId);
  if (!action) throw new AppError("Action not found", 404);

  // The date is stamped on save, and only where the state really changed.
  action.status = body.status;
  await plan.save();

  return asPlan(await populated(Plan.findById(plan._id)), await contextForPlan(plan));
};

// Plans a cycle's start closes: the ones already handed to the employee. ⚠️ A draft is left
// alone. It was never shared, so there is nothing to record an outcome against, and the
// supervisor may still be writing it.
const CLOSEABLE = ["awaiting_ack", "active"];

// Every open plan for the group whose cycle is starting, which closes them on the group's own
// date rather than on a calendar one. ⚠️ Read from the user record, not from unit history, so
// somebody who has left the company is still reached and their plan still closes.
const closePlansForCycle = async (cycle) => {
  const people = await User.find({ parGroup: cycle.parGroup }).select("_id").lean();
  if (!people.length) return { closed: 0, plansCompleted: 0, plansCarried: 0, left: 0 };

  const plans = await Plan.find({
    userId: { $in: people.map((person) => person._id) },
    type: "PDP",
    status: { $in: CLOSEABLE },
  });

  const on = today();
  const counts = { closed: plans.length, plansCompleted: 0, plansCarried: 0, left: 0 };

  for (const plan of plans) {
    const left = !(await membershipOn(plan.userId, on));
    const unfinished = plan.actions.filter((action) => action.status !== "done");

    plan.status = "closed";
    plan.closeDate = on;

    if (left) {
      // ⚠️ Nothing is marked carried: there is no next plan to carry it to, and an action
      // reading as carried forward with nowhere to go is a claim the record cannot keep.
      plan.outcome = "not_completed";
      plan.outcomeReason = "Left the company";
      counts.left += 1;
    } else {
      for (const action of unfinished) action.status = "carried_forward";

      plan.outcome = unfinished.length ? "carried_forward" : "completed";

      // ⚠️ Recorded, never waited for: a plan must not be able to hold up a cycle, and an
      // automatic close has nobody present to ask.
      plan.outcomeReason = plan.acknowledgedAt ? null : "Never acknowledged";

      if (unfinished.length) counts.plansCarried += 1;
      else counts.plansCompleted += 1;
    }

    await plan.save();
  }

  return counts;
};

// The newest published review, used only to tell "no review yet" from "no plan written".
const publishedReviewFor = (userId) =>
  Review.findOne({ userId, status: { $in: PUBLISHED_STATES } })
    .sort({ publishedAt: -1 })
    .select("_id");

// A draft is never one of these, so a plan reaches the employee only once it is shared.
const VISIBLE_TO_EMPLOYEE = ["awaiting_ack", "active", "closed"];

// ⚠️ Built field by field, never from `asAction` and never by spreading the action: the
// competency an action came from is the one thing this projection must not carry.
const asEmployeeAction = (action, on) => ({
  id: String(action._id),
  description: action.description,
  category: action.category,
  owner: asPerson(action.ownerId),
  targetDate: action.targetDate,
  successCriteria: action.successCriteria,
  status: displayStatus(action, on),
  lastUpdatedAt: action.lastUpdatedAt,
  daysSinceChange: action.lastUpdatedAt
    ? wholeDaysBetween(action.lastUpdatedAt, on)
    : null,
  progressNotes: action.progressNotes.map((note) => ({
    note: note.note,
    by: asPerson(note.byId),
    at: note.at,
  })),
});

// ⚠️ No `competencies` list either. Serving the set the review was opened under would
// hand back by the collection what `asEmployeeAction` withholds per action.
const asEmployeePlan = (plan, on = today()) => ({
  state: "plan",
  id: String(plan._id),
  type: plan.type,
  status: plan.status,
  sharedAt: plan.sharedAt,
  acknowledgedAt: plan.acknowledgedAt,
  closeDate: plan.closeDate,
  outcome: plan.outcome,
  outcomeReason: plan.outcomeReason,
  canAcknowledge: plan.status === "awaiting_ack",
  canAddNote: plan.status !== "closed",
  actions: byStalest(plan.actions).map((action) => asEmployeeAction(action, on)),

  // ⚠️ Safe to serve whole: a check-in carries an outcome about the plan, never a rating,
  // a band or the competency an action came from.
  checkIns: plan.checkIns.map(asCheckIn),
});

// ⚠️ Safe to build from the development plan's projection, which is already field by field:
// what it withholds per action it withholds here. The dates are all that is added, and the
// case type, the competency and the officer who approved it are none of the employee's.
const asEmployeeImprovementPlan = (plan, on = today()) => ({
  ...asEmployeePlan(plan, on),
  canAcknowledge: plan.status === "active" && !plan.acknowledgedAt,
  startDate: plan.startDate,
  endDate: plan.endDate,
  daysRemaining: plan.endDate ? wholeDaysBetween(on, plan.endDate) : null,
});

const sharedPlanFor = (userId) =>
  Plan.findOne({ userId, type: "PDP", status: { $in: VISIBLE_TO_EMPLOYEE } }).sort({
    sharedAt: -1,
  });

// Every improvement plan the employee has had, newest first. Closed ones stay: this is the
// one page whose access outlasts the plan, and the supervisor's does not.
const improvementPlansFor = (userId) =>
  Plan.find({ userId, type: "PIP", status: { $in: VISIBLE_TO_EMPLOYEE } }).sort({
    sharedAt: -1,
  });

const myImprovementPlans = async (userId) => ({
  plans: (await populated(improvementPlansFor(userId))).map((plan) =>
    asEmployeeImprovementPlan(plan),
  ),
});

// Records that they read it and nothing else: the plan was already active. A second attempt
// finds none waiting, which is also what an acknowledged plan gets.
const acknowledgeMyImprovementPlan = async (userId) => {
  const plan = await Plan.findOne({
    userId,
    type: "PIP",
    status: "active",
    acknowledgedAt: null,
  }).sort({ sharedAt: -1 });

  if (!plan) throw new AppError("You have no improvement plan waiting to be read", 409);

  plan.acknowledgedAt = new Date();
  await plan.save();

  return myImprovementPlans(userId);
};

// Nothing to show separates into two cases the employee can act on differently: no published
// review to write a plan against, or one published and no plan written yet.
const myPlan = async (userId) => {
  const plan = await populated(sharedPlanFor(userId));
  if (plan) return asEmployeePlan(plan);

  return { state: (await publishedReviewFor(userId)) ? "no_plan" : "no_review" };
};

// Acknowledging is what makes a plan active. A second attempt finds nothing awaiting one and
// is refused, which is also what a plan that was never shared gets.
const acknowledgeMyPlan = async (userId) => {
  const plan = await Plan.findOne({ userId, type: "PDP", status: "awaiting_ack" }).sort({
    sharedAt: -1,
  });

  if (!plan) throw new AppError("You have no plan waiting to be acknowledged", 409);

  plan.status = "active";
  plan.acknowledgedAt = new Date();
  await plan.save();

  return myPlan(userId);
};

// ⚠️ The only write the employee has on a plan. Nothing else is touched here, so an action
// status and anything the supervisor wrote stay theirs.
const addProgressNote = async (userId, actionId, body) => {
  const note = String(body?.note || "").trim();
  if (!note) throw new AppError("A progress note cannot be empty", 400);

  // ⚠️ Found by the action rather than by the plan: the employee can have a development plan
  // and an improvement plan at once, and the action is what says which one this belongs to.
  const plan = await Plan.findOne({
    userId,
    status: { $in: ["awaiting_ack", "active"] },
    "actions._id": actionId,
  });

  if (!plan) throw new AppError("You have no open plan to write against", 409);

  const action = plan.actions.id(actionId);
  if (!action) throw new AppError("Action not found", 404);

  action.progressNotes.push({ note, byId: userId, at: new Date() });
  await plan.save();

  return plan.type === "PIP" ? myImprovementPlans(userId) : myPlan(userId);
};

const HR_ROLES = ["hr", "head_of_hr"];

// Which of the two refusals it was, in a form a rule can read. The messages are written for
// people and get reworded; these do not.
const refusalCodeFor = (actor) =>
  (actor?.roles || []).some((role) => HR_ROLES.includes(role))
    ? "outside_coverage"
    : "not_hr";

// Oversight that leaves no trace is not oversight anyone can prove, so the read is recorded
// whether it succeeded or not. No reason is asked for: this is gated access, not a reveal.
const recordPlanRead = (actor, employeeId, plan, outcome, refusalCode = null) =>
  audit.record({
    actorId: actor.id,
    action: "plan_read",
    outcome,
    subjectUserId: employeeId,
    targetType: "plan",
    targetId: plan?._id || null,
    refusalCode: outcome === "refused" ? refusalCode : null,
    detail: "Opened this person's development plan",
  });

// ⚠️ Read only, and nothing here enforces it: every write goes through `supervisorPlan`,
// which refuses anyone not supervising the employee today. A path that skips it hands HR an edit.
const getPlanForCoverage = async (employeeId, actor) => {
  const plan = await populated(sharedPlanFor(employeeId));

  // Coverage is settled before anything about the plan is said, so an officer outside it
  // learns nothing either way.
  try {
    await assertHrMayRead(actor, employeeId);
  } catch (error) {
    await recordPlanRead(actor, employeeId, plan, "refused", refusalCodeFor(actor));
    throw error;
  }

  // A draft is never one of these, so the supervisor's working document stays theirs.
  if (!plan) {
    await recordPlanRead(actor, employeeId, null, "refused", "not_found");
    throw new AppError("No plan has been shared for this employee", 404);
  }

  await recordPlanRead(actor, employeeId, plan, "allowed");

  const readOnly = asPlan(plan, await contextForPlan(plan));

  // ⚠️ Read only, and every flag the client reads has to say so: a write refused in the
  // service but offered on the page is a button that only ever produces an error.
  return {
    ...readOnly,
    canEdit: false,
    checkIns: { ...readOnly.checkIns, canRecord: false },
  };
};

const asReadOnly = (plan) => ({
  ...plan,
  canEdit: false,
  checkIns: { ...plan.checkIns, canRecord: false },
});

// ⚠️ Not a coarse gate. The scope helper answers "only yourself" for anyone who is not an
// officer, which would hand an employee their own plan while it is still with HR.
const assertHrOfficer = (actor) => {
  if (!(actor?.roles || []).some((role) => HR_ROLES.includes(role))) {
    throw new AppError("You do not have permission for this action", 403);
  }
};

const recordDecision = (
  actor,
  plan,
  outcome,
  { refusalCode = null, reason = null, detail = null } = {},
) =>
  audit.record({
    actorId: actor.id,
    action: "improvement_plan_decision",
    outcome,
    subjectUserId: plan.userId._id || plan.userId,
    targetType: "plan",
    targetId: plan._id,
    reason: reason || null,
    refusalCode: outcome === "refused" ? refusalCode : null,
    detail: detail || "Attempted a decision on an improvement plan",
  });

// They cover the employee today, and they are not in their reporting line. ⚠️ Both refusals
// are recorded: an attempt outside an officer's coverage is what the trail exists to show.
const assertMayDecide = async (actor, plan) => {
  const employeeId = plan.userId._id || plan.userId;

  try {
    await assertMayActOnEmployee(
      actor,
      employeeId,
      today(),
      "decide this person's improvement plan",
    );
  } catch (error) {
    await recordDecision(actor, plan, "refused", { refusalCode: refusalCodeFor(actor) });
    throw error;
  }

  try {
    await assertNotInReportingLine(
      actor,
      employeeId,
      today(),
      "decide their improvement plan",
    );
  } catch (error) {
    await recordDecision(actor, plan, "refused", { refusalCode: "own_reporting_line" });
    throw error;
  }
};

// A refusal sends the plan back as an editable draft, as often as the two of them need.
// ⚠️ The reason is stored on the plan as well as in the trail, which the supervisor cannot read.
const decideImprovementPlan = async (planId, actor, body) => {
  const { decision } = body || {};
  const reason = String(body?.reason || "").trim();

  if (!PLAN_APPROVAL_DECISIONS.includes(decision)) {
    throw new AppError("That is not a decision", 400);
  }

  if (decision === "refused" && !reason) {
    throw new AppError("Sending a plan back has to say why", 400);
  }

  const plan = await populated(Plan.findById(planId));
  if (!plan || plan.type !== "PIP") throw new AppError("Plan not found", 404);

  await assertMayDecide(actor, plan);

  if (plan.status !== "awaiting_approval") {
    throw new AppError("This plan is not waiting on a decision", 409);
  }

  plan.status = decision === "approved" ? "approved" : "draft";
  plan.approval = {
    decision,
    byId: actor.id,
    at: new Date(),
    reason: decision === "refused" ? reason : null,
  };
  await plan.save();

  // The reason goes in the trail's own field, which is what a refusal is read back by.
  await recordDecision(actor, plan, "allowed", {
    reason: decision === "refused" ? reason : null,
    detail:
      decision === "approved"
        ? "Approved an improvement plan"
        : "Sent an improvement plan back to the supervisor",
  });

  const decided = await populated(Plan.findById(plan._id));
  return asReadOnly(asPlan(decided, await contextForPlan(decided)));
};

// The improvement plans within this officer's reach, for the two lists they work from.
// ⚠️ Anyone in their own reporting line is dropped as well as refused on the write: a list
// holding work nobody may touch reads as a fault rather than as a rule.
const improvementPlansForOfficer = async (actor, filter) => {
  assertHrOfficer(actor);

  const inScope = await readScopeFor(actor, {
    on: today(),
    asHr: true,
    includeUnplaced: false,
  });

  const found = await populated(Plan.find({ type: "PIP", ...filter }));

  const mine = [];
  for (const plan of found) {
    if (!inScope(plan.userId._id)) continue;

    try {
      await assertNotInReportingLine(actor, plan.userId._id, today(), "decide it");
    } catch {
      continue;
    }

    mine.push(asReadOnly(asPlan(plan, await contextForPlan(plan))));
  }

  return { on: today().toISOString().slice(0, 10), plans: mine };
};

// Escalated and still open. ⚠️ Listed rather than waited on: an escalation with no closing
// entry leaves every count in the system wrong, and nothing else would surface it.
const openEscalations = (actor) =>
  improvementPlansForOfficer(actor, {
    status: "active",
    escalation: { $ne: null },
  });

// ⚠️ Read only. Every write goes through `supervisorPlan`, which refuses HR outright, and the
// one write an officer has is closing a plan the supervisor escalated.
const improvementPlansForCoverage = async (employeeId, actor) => {
  try {
    await assertHrMayRead(actor, employeeId);
  } catch (error) {
    await recordPlanRead(actor, employeeId, null, "refused", refusalCodeFor(actor));
    throw error;
  }

  const plans = await populated(
    Plan.find({
      userId: employeeId,
      type: "PIP",
      status: { $in: VISIBLE_TO_EMPLOYEE },
    }).sort({ sharedAt: -1 }),
  );

  await recordPlanRead(
    actor,
    employeeId,
    plans[0],
    plans.length ? "allowed" : "refused",
    plans.length ? null : "not_found",
  );

  if (!plans.length) {
    throw new AppError("No improvement plan has been shared for this employee", 404);
  }

  const built = [];
  for (const plan of plans) {
    built.push(asReadOnly(asPlan(plan, await contextForPlan(plan))));
  }

  return { plans: built };
};

// Everything waiting on this officer, across the units they cover today. Plans in their own
// reporting line are dropped as well as refused: a queue nobody may act on reads as a fault.
const improvementQueue = (actor) =>
  improvementPlansForOfficer(actor, { status: "awaiting_approval" });

const recordOutcomeEntry = (actor, plan, detail, reason) =>
  audit.record({
    actorId: actor.id,
    action: "improvement_plan_outcome",
    outcome: "allowed",
    subjectUserId: plan.userId._id || plan.userId,
    targetType: "plan",
    targetId: plan._id,
    reason: reason || null,
    detail,
  });

// ⚠️ Two of the four choices do not close the plan. Extending moves the end date and
// escalating hands it to HR, and both leave it active with its actions unchanged.
const recordImprovementOutcome = async (planId, actor, body) => {
  const { outcome } = body || {};
  const note = String(body?.note || "").trim();

  if (!IMPROVEMENT_SUPERVISOR_OUTCOMES.includes(outcome)) {
    throw new AppError("That is not an outcome this plan can end with", 400);
  }

  if (!note) {
    const error = new AppError("An outcome has to say what happened", 400);
    error.details = ["note"];
    throw error;
  }

  const plan = await supervisorPlan(planId, actor.id);

  if (plan.type !== "PIP") {
    throw new AppError("A development plan closes with its cycle, not by hand", 409);
  }

  assertActive(plan);

  // Terminal from this side: the plan is HR's once it has been escalated, and a second
  // outcome from the supervisor would take it back off them.
  if (plan.escalation) {
    throw new AppError("This plan has been escalated, so HR records how it ends", 409);
  }

  let detail;

  if (outcome === "extended") {
    if (plan.extension) {
      throw new AppError("This plan has already been extended once", 409);
    }

    const days = Number(body?.days);
    if (
      !Number.isInteger(days) ||
      days < IMPROVEMENT_MIN_DAYS ||
      days > IMPROVEMENT_MAX_DAYS
    ) {
      const error = new AppError(
        `An extension runs ${IMPROVEMENT_MIN_DAYS} to ${IMPROVEMENT_MAX_DAYS} days`,
        400,
      );
      error.details = ["days"];
      throw error;
    }

    // ⚠️ Counted from today, not from the end date it is replacing: the criterion is days
    // from the day of the extension, and a plan extended late would otherwise gain no time.
    plan.extension = {
      at: new Date(),
      byId: actor.id,
      reason: note,
      days,
      previousEndDate: plan.endDate,
    };
    plan.endDate = new Date(startOfDay(today()).getTime() + days * DAY_MS);
    detail = `Extended an improvement plan by ${days} days`;
  } else if (outcome === "escalated") {
    plan.escalation = { at: new Date(), byId: actor.id, note };
    plan.outcome = "escalated";
    detail = "Escalated an improvement plan to HR";
  } else {
    plan.status = "closed";
    plan.closeDate = today();
    plan.outcome = outcome;
    plan.outcomeReason = note;
    plan.closedBy = actor.id;
    detail = "Closed an improvement plan";
  }

  await plan.save();
  await recordOutcomeEntry(actor, plan, detail, note);

  const saved = await populated(Plan.findById(plan._id));
  return asPlan(saved, await contextForPlan(saved));
};

// The only write an officer has on a plan, and only on one the supervisor escalated.
const closeEscalatedPlan = async (planId, actor, body) => {
  const { outcome } = body || {};
  const note = String(body?.note || "").trim();

  if (!IMPROVEMENT_HR_OUTCOMES.includes(outcome)) {
    throw new AppError("That is not an outcome an escalated plan can close with", 400);
  }

  if (!note) {
    const error = new AppError("Closing a plan has to say what happened", 400);
    error.details = ["note"];
    throw error;
  }

  const plan = await populated(Plan.findById(planId));
  if (!plan || plan.type !== "PIP") throw new AppError("Plan not found", 404);

  await assertMayDecide(actor, plan);

  if (!plan.escalation || plan.status !== "active") {
    throw new AppError("This plan is not an open escalation", 409);
  }

  plan.status = "closed";
  plan.closeDate = today();
  plan.outcome = outcome;
  plan.outcomeReason = note;
  plan.closedBy = actor.id;
  await plan.save();

  await recordOutcomeEntry(actor, plan, "Closed an escalated improvement plan", note);

  const closed = await populated(Plan.findById(plan._id));
  return asReadOnly(asPlan(closed, await contextForPlan(closed)));
};

module.exports = {
  teamPlans,
  getPlanForCoverage,
  myPlan,
  myImprovementPlans,
  acknowledgeMyPlan,
  acknowledgeMyImprovementPlan,
  addProgressNote,
  startPlanFromReview,
  startImprovementPlan,
  getPlanForSupervisor,
  addAction,
  editAction,
  removeAction,
  submitForApproval,
  decideImprovementPlan,
  improvementQueue,
  openEscalations,
  improvementPlansForCoverage,
  recordImprovementOutcome,
  closeEscalatedPlan,
  sharePlan,
  recordCheckIn,
  setActionStatus,
  closePlansForCycle,
};
