const Plan = require("../models/plan.model");
const Review = require("../models/review.model");
const Cycle = require("../models/cycle.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { teamOn } = require("./supervision.service");
const { assertHrMayRead } = require("./coverageAuth.service");
const audit = require("./audit.service");
const {
  competenciesFor,
  PLAN_ACTION_CATEGORIES,
  PLAN_ACTION_OPEN_STATUS,
  CHECK_IN_OUTCOMES,
  CHECK_IN_MONTH_OFFSETS,
  CHECK_IN_WINDOW_DAYS,
  EXPECTED_CHECK_INS,
  PUBLISHED_STATES,
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

const checkInSummary = (plan, assessedTo, on) => {
  const held = plan.checkIns.length;

  return {
    expected: EXPECTED_CHECK_INS,
    held,
    remaining: Math.max(0, EXPECTED_CHECK_INS - held),
    additional: Math.max(0, held - EXPECTED_CHECK_INS),
    canRecord: plan.status === "active",
    windows: checkInWindows(assessedTo, held, on),
    entries: plan.checkIns.map(asCheckIn),
  };
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
});

const populated = (query) =>
  query
    .populate("userId", "name employeeId")
    .populate("createdBy", "name employeeId")
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

const assertDraft = (plan) => {
  if (plan.status !== "draft") {
    throw new AppError("This plan has been shared, so it can no longer be edited", 409);
  }
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
        };
      })
      .filter(Boolean),
  };
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
  });

  return asPlan(
    await populated(Plan.findById(created._id)),
    await contextForReview(review),
  );
};

// Loads a plan and refuses unless the actor supervises its employee today.
const supervisorPlan = async (planId, actorId) => {
  const plan = await populated(Plan.findById(planId));
  if (!plan) throw new AppError("Plan not found", 404);

  await assertSupervisesToday(actorId, plan.userId._id);
  return plan;
};

const getPlanForSupervisor = async (planId, actor) => {
  const plan = await supervisorPlan(planId, actor.id);
  const review = await Review.findById(plan.reviewId).select("userId snapshot cycleId");

  return asPlan(plan, await contextForReview(review || plan));
};

// ⚠️ Every field is required, and the response names all of the empty ones at once rather
// than the first: a form that reveals one missing field per attempt is a form nobody finishes.
const assertActionComplete = (body, plan, competencies, actorId) => {
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
  };
};

const contextForPlan = async (plan) => {
  const review = await Review.findById(plan.reviewId).select("userId snapshot cycleId");
  return contextForReview(review || plan);
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
  action.set(assertActionComplete(body, plan, context.competencies, actor.id));
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

// Sharing is what hands the plan to the employee to acknowledge. It is refused on an empty
// plan: a plan with no actions is nothing to agree to.
const sharePlan = async (planId, actor) => {
  const plan = await supervisorPlan(planId, actor.id);
  assertDraft(plan);

  if (plan.actions.length === 0) {
    throw new AppError("A plan with no actions cannot be shared", 409);
  }

  plan.status = "awaiting_ack";
  plan.sharedAt = new Date();
  await plan.save();

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
  canAcknowledge: plan.status === "awaiting_ack",
  canAddNote: plan.status !== "closed",
  actions: byStalest(plan.actions).map((action) => asEmployeeAction(action, on)),

  // ⚠️ Safe to serve whole: a check-in carries an outcome about the plan, never a rating,
  // a band or the competency an action came from.
  checkIns: plan.checkIns.map(asCheckIn),
});

const sharedPlanFor = (userId) =>
  Plan.findOne({ userId, type: "PDP", status: { $in: VISIBLE_TO_EMPLOYEE } }).sort({
    sharedAt: -1,
  });

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

  const plan = await Plan.findOne({
    userId,
    type: "PDP",
    status: { $in: ["awaiting_ack", "active"] },
  }).sort({ sharedAt: -1 });

  if (!plan) throw new AppError("You have no open plan to write against", 409);

  const action = plan.actions.id(actionId);
  if (!action) throw new AppError("Action not found", 404);

  action.progressNotes.push({ note, byId: userId, at: new Date() });
  await plan.save();

  return myPlan(userId);
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

module.exports = {
  teamPlans,
  getPlanForCoverage,
  myPlan,
  acknowledgeMyPlan,
  addProgressNote,
  startPlanFromReview,
  getPlanForSupervisor,
  addAction,
  editAction,
  removeAction,
  sharePlan,
  recordCheckIn,
  setActionStatus,
};
