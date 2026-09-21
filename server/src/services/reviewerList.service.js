const Review = require("../models/review.model");
const Cycle = require("../models/cycle.model");
const Feedback = require("../models/feedback.model");
const ReviewerList = require("../models/reviewerList.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { candidatesFor, notPeersOf } = require("./reviewerPool.service");
const { teamOn, reportingLineOn } = require("./supervision.service");
const {
  assertMayActOnEmployee,
  assertHrMayRead,
  readScopeFor,
} = require("./coverageAuth.service");
const { shuffled } = require("./review.service");
const audit = require("./audit.service");
const {
  PEER_REVIEWS_TARGET,
  PEER_REVIEWS_MINIMUM,
  PEER_REVIEWS_SMALL_POOL,
  REVIEW_LOAD_CEILING,
  REVIEW_LOAD_PER_SOURCE,
} = require("../config/constants");

const ADDABLE_SEARCH_LIMIT = 10;

// Choosing colleague reviewers: the system builds the list, the supervisor confirms it, HR
// decides any requested change, and HR draws from what is left.

const same = (a, b) => String(a) === String(b);
const isHr = (actor) =>
  (actor?.roles || []).some((r) => r === "hr" || r === "head_of_hr");

const asPerson = (user) =>
  user
    ? {
        id: String(user._id),
        name: user.name,
        employeeId: user.employeeId,
        designation: user.designation,
      }
    : null;

const asCycle = (cycle) => ({
  id: String(cycle._id),
  parGroup: cycle.parGroup,
  year: cycle.year,
  status: cycle.status,
});

const loadReview = async (reviewId) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError("Review not found", 404);
  const cycle = await Cycle.findById(review.cycleId);
  if (!cycle) throw new AppError("Cycle not found", 404);
  return { review, cycle };
};

const assertCollecting = (cycle) => {
  if (cycle.status === "collecting") return;
  throw new AppError(
    `Colleague lists can only be worked on while the cycle is collecting. This one is ${cycle.status}.`,
    409,
  );
};

// Nobody works on their own list, whatever roles they hold.
const assertNotOwn = (review, actor) => {
  if (same(review.userId, actor.id)) throw new AppError("Review not found", 404);
};

const supervises = async (actor, userId) => {
  const { team = [] } = await teamOn(actor.id, new Date());
  return team.some((p) => same(p.id, userId));
};

// The person's supervisor today, or HR within their coverage.
const assertMayRead = async (review, actor) => {
  assertNotOwn(review, actor);
  if (await supervises(actor, review.userId)) return;
  if (
    isHr(actor) &&
    (await refusalOf(() => assertHrMayRead(actor, review.userId))) === null
  )
    return;
  throw new AppError("Review not found", 404);
};

// The current supervisor confirms. HR stands in only where nobody supervises the person, and
// then only within their coverage.
const assertMayConfirm = async (review, actor) => {
  assertNotOwn(review, actor);
  if (await supervises(actor, review.userId)) return;

  if (!isHr(actor)) throw new AppError("Review not found", 404);

  const line = await reportingLineOn(review.userId, new Date());
  if (line.supervisor) {
    throw new AppError(
      `${line.employee.name} is supervised by ${line.supervisor.name}, so the list is theirs to confirm`,
      403,
    );
  }
  await assertMayActOnEmployee(
    actor,
    review.userId,
    new Date(),
    "confirm this person's colleague list",
  );
};

const assertHrMayAct = async (review, actor, action) => {
  assertNotOwn(review, actor);
  await assertMayActOnEmployee(actor, review.userId, new Date(), action);
};

// The refusal's own message, or null when allowed.
const refusalOf = (check) =>
  check().then(
    () => null,
    (err) => err.message,
  );

// ⚠️ Records that predate confirmed lists count as chosen: the demo cycle's reviewers were
// drawn before this existed, and offering a second draw would break one pool per person.
const stateOf = ({ cycle, list, hasPeers }) => {
  if (list?.drawnAt) return "drawn";
  if (hasPeers) return "already_chosen";
  if (cycle.status !== "collecting") return "not_collecting";
  if (!list) return "to_confirm";
  if (list.changes.some((c) => c.status === "pending")) return "awaiting_hr";
  return "ready_to_draw";
};

const pendingCount = (list) =>
  list ? list.changes.filter((c) => c.status === "pending").length : 0;

// What the draw works from: the confirmed list, minus approved removals, plus approved additions.
const effectiveCandidates = (list) => {
  const removed = new Set(
    list.changes
      .filter((c) => c.type === "remove" && c.status === "approved")
      .map((c) => String(c.userId)),
  );

  const kept = list.candidates
    .filter((c) => !removed.has(String(c.userId)))
    .map((c) => ({
      userId: String(c.userId),
      via: c.via?.kind ? { kind: c.via.kind, sourceId: c.via.sourceId } : null,
    }));

  // An addition has no shared record behind it, so no source: only the yearly limits apply.
  const added = list.changes
    .filter((c) => c.type === "add" && c.status === "approved")
    .map((c) => ({ userId: String(c.userId), via: null }));

  return [...kept, ...added];
};

// Peer reviews each person already writes this cycle year, in total and per source.
const loadsFor = async (userIds, cycle) => {
  const cycleIds = await Cycle.find({ year: cycle.year, cancelledOn: null }).distinct(
    "_id",
  );
  const reviewIds = await Review.find({ cycleId: { $in: cycleIds } }).distinct("_id");

  // ⚠️ Internal arithmetic only. These records carry the reviewer and their source, and nothing
  // built from them may leave this function except the counts.
  const rows = await Feedback.find({
    reviewerType: "peer",
    reviewId: { $in: reviewIds },
    reviewerId: { $in: userIds },
  }).select("+reviewerId +drawnFrom");

  const total = new Map();
  const bySource = new Map();
  for (const row of rows) {
    const who = String(row.reviewerId);
    total.set(who, (total.get(who) || 0) + 1);
    if (row.drawnFrom?.kind) {
      const key = `${who}|${row.drawnFrom.kind}:${row.drawnFrom.sourceId}`;
      bySource.set(key, (bySource.get(key) || 0) + 1);
    }
  }
  return { total, bySource };
};

const drawable = async (list, cycle) => {
  const entries = effectiveCandidates(list);

  // Somebody who has left since the list was confirmed drops off it on their own.
  const active = new Set(
    (
      await User.find({
        _id: { $in: entries.map((e) => e.userId) },
        status: "active",
      }).distinct("_id")
    ).map(String),
  );

  const present = entries.filter((e) => active.has(e.userId));
  const { total, bySource } = await loadsFor(
    present.map((e) => e.userId),
    cycle,
  );

  const eligible = present
    .map((e) => ({ ...e, load: total.get(e.userId) || 0 }))
    .filter((e) => e.load < REVIEW_LOAD_CEILING)
    .filter(
      (e) =>
        !e.via ||
        (bySource.get(`${e.userId}|${e.via.kind}:${e.via.sourceId}`) || 0) <
          REVIEW_LOAD_PER_SOURCE,
    );

  const available = eligible.length;
  return {
    eligible,
    available,
    target: PEER_REVIEWS_TARGET,
    willAssign: Math.min(available, PEER_REVIEWS_TARGET),
    required:
      available >= PEER_REVIEWS_MINIMUM ? PEER_REVIEWS_MINIMUM : PEER_REVIEWS_SMALL_POOL,
    needsAcknowledgement: available < PEER_REVIEWS_MINIMUM,
    noColleagueSection: available < PEER_REVIEWS_SMALL_POOL,
  };
};

const asPreview = ({
  available,
  target,
  willAssign,
  required,
  needsAcknowledgement,
  noColleagueSection,
}) => ({
  available,
  target,
  willAssign,
  required,
  needsAcknowledgement,
  noColleagueSection,
});

// Least-loaded first, shuffled within a tie: balance comes from the sort, unpredictability
// from the shuffle. Array sort is stable, so the shuffle survives inside each load.
const pickBalanced = (eligible, n) =>
  shuffled(eligible)
    .sort((a, b) => a.load - b.load)
    .slice(0, n);

const listFor = async (reviewId, actor) => {
  const { review, cycle } = await loadReview(reviewId);
  await assertMayRead(review, actor);

  const [list, hasPeers, reviewee] = await Promise.all([
    ReviewerList.findOne({ reviewId: review._id }),
    Feedback.exists({ reviewId: review._id, reviewerType: "peer" }),
    User.findById(review.userId).select("name employeeId designation"),
  ]);

  const state = stateOf({ cycle, list, hasPeers: Boolean(hasPeers) });

  let candidates;
  if (list) {
    candidates = list.candidates.map((c) => ({
      userId: String(c.userId),
      via: c.via?.kind
        ? { kind: c.via.kind, id: c.via.sourceId, name: c.via.name }
        : null,
      sharedFrom: c.sharedFrom,
      sharedTo: c.sharedTo,
    }));
  } else {
    const built = await candidatesFor(review.userId, {
      from: cycle.startDate,
      to: cycle.endDate,
    });
    candidates = built.candidates.map((c) => ({
      userId: c.id,
      via: c.via,
      sharedFrom: c.sharedFrom,
      sharedTo: c.sharedTo,
    }));
  }

  const changes = list ? list.changes : [];
  const people = await User.find({
    _id: { $in: [...candidates.map((c) => c.userId), ...changes.map((c) => c.userId)] },
  }).select("name employeeId designation");
  const byId = new Map(people.map((p) => [String(p._id), p]));

  const [confirmRefusal, decideRefusal] = await Promise.all([
    state === "to_confirm" ? refusalOf(() => assertMayConfirm(review, actor)) : undefined,
    state === "awaiting_hr" || state === "ready_to_draw"
      ? refusalOf(() =>
          assertHrMayAct(
            review,
            actor,
            "decide changes to this list or draw its reviewers",
          ),
        )
      : undefined,
  ]);
  const canConfirm = confirmRefusal === null;
  const canDecide = decideRefusal === null;

  return {
    reviewId: String(review._id),
    cycle: asCycle(cycle),
    reviewee: asPerson(reviewee),
    state,
    confirmed: Boolean(list),
    candidates: candidates.map((c) => ({
      person: asPerson(byId.get(c.userId)),
      via: c.via,
      sharedFrom: c.sharedFrom,
      sharedTo: c.sharedTo,
    })),
    changes: changes.map((c) => ({
      id: String(c._id),
      type: c.type,
      person: asPerson(byId.get(String(c.userId))),
      reason: c.reason,
      status: c.status,
      requestedByYou: same(c.requestedBy, actor.id),
    })),
    // ⚠️ Counts only. Nobody's screen names who was picked.
    drawn: list?.drawnAt
      ? { count: list.drawnCount, shortfallAcknowledged: list.shortfallAcknowledged }
      : null,
    canConfirm,
    // Only HR is told why.
    whyNot: isHr(actor) ? (confirmRefusal ?? decideRefusal ?? null) : null,
    canDecide: canDecide && state === "awaiting_hr",
    canDraw: canDecide && state === "ready_to_draw",
    preview:
      canDecide && state === "ready_to_draw"
        ? asPreview(await drawable(list, cycle))
        : null,
  };
};

const statesByReview = async (reviewIds) => {
  const [lists, withPeers] = await Promise.all([
    ReviewerList.find({ reviewId: { $in: reviewIds } }).select(
      "reviewId changes.status drawnAt",
    ),
    Feedback.distinct("reviewId", { reviewId: { $in: reviewIds }, reviewerType: "peer" }),
  ]);
  return {
    listByReview: new Map(lists.map((l) => [String(l.reviewId), l])),
    peered: new Set(withPeers.map(String)),
  };
};

// The supervisor's team, each with where their list has got to.
const listsForTeam = async (actor) => {
  const { team = [] } = await teamOn(actor.id, new Date());
  const reviewIds = team.map((p) => p.reviewId).filter(Boolean);
  const { listByReview, peered } = await statesByReview(reviewIds);

  const items = team.map((p) => {
    const list = p.reviewId ? listByReview.get(p.reviewId) : null;
    return {
      person: {
        id: String(p.id),
        name: p.name,
        employeeId: p.employeeId,
        designation: p.designation,
      },
      unit: p.unit,
      cycle: p.cycle,
      reviewId: p.reviewId,
      state:
        p.reviewId && p.cycle
          ? stateOf({ cycle: p.cycle, list, hasPeers: peered.has(p.reviewId) })
          : "no_review",
      pendingChanges: pendingCount(list),
    };
  });

  return { items, total: items.length };
};

// Every review in a cycle, grouped by the person's current supervisor, for HR.
const listsForCycle = async (cycleId, actor) => {
  const cycle = await Cycle.findById(cycleId);
  if (!cycle) throw new AppError("Cycle not found", 404);

  const inScope = await readScopeFor(actor, { asHr: true });
  const reviews = (await Review.find({ cycleId: cycle._id }).select("_id userId")).filter(
    (r) => inScope(r.userId),
  );
  const reviewIds = reviews.map((r) => r._id);

  const [{ listByReview, peered }, people] = await Promise.all([
    statesByReview(reviewIds),
    User.find({ _id: { $in: reviews.map((r) => r.userId) } }).select(
      "name employeeId designation",
    ),
  ]);
  const personById = new Map(people.map((p) => [String(p._id), p]));

  const groups = new Map();
  const rows = [];
  for (const review of reviews) {
    const line = await reportingLineOn(review.userId, new Date());
    const key = line.supervisor ? String(line.supervisor.id) : "none";
    if (!groups.has(key)) {
      groups.set(key, {
        supervisor: line.supervisor
          ? {
              id: String(line.supervisor.id),
              name: line.supervisor.name,
              employeeId: line.supervisor.employeeId,
            }
          : null,
        people: [],
      });
    }

    const list = listByReview.get(String(review._id));
    const row = {
      person: asPerson(personById.get(String(review.userId))),
      reviewId: String(review._id),
      state: stateOf({ cycle, list, hasPeers: peered.has(String(review._id)) }),
      pendingChanges: pendingCount(list),
    };
    groups.get(key).people.push(row);
    rows.push(row);
  }

  const sortedGroups = [...groups.values()]
    .map((g) => ({
      ...g,
      people: g.people.sort((a, b) =>
        (a.person?.name || "").localeCompare(b.person?.name || ""),
      ),
    }))
    .sort((a, b) => (a.supervisor?.name || "~").localeCompare(b.supervisor?.name || "~"));

  return {
    cycle: asCycle(cycle),
    groups: sortedGroups,
    total: rows.length,
    undrawn: rows.filter((r) => !["drawn", "already_chosen"].includes(r.state)).length,
    awaitingHr: rows.filter((r) => r.state === "awaiting_hr").length,
  };
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Supervisors cannot read the employee list, so this serves name and designation only.
const addableFor = async (reviewId, actor, query) => {
  const { review, cycle } = await loadReview(reviewId);
  await assertMayConfirm(review, actor);
  assertCollecting(cycle);

  const [list, hasPeers] = await Promise.all([
    ReviewerList.exists({ reviewId: review._id }),
    Feedback.exists({ reviewId: review._id, reviewerType: "peer" }),
  ]);
  if (list || hasPeers) {
    throw new AppError("This list is no longer open to changes", 409);
  }

  const period = { from: cycle.startDate, to: cycle.endDate };
  const [{ candidates }, notPeers] = await Promise.all([
    candidatesFor(review.userId, period),
    notPeersOf(review.userId, period),
  ]);
  const excluded = new Set([
    String(review.userId),
    ...candidates.map((c) => c.id),
    ...notPeers,
  ]);

  // ⚠️ Filtered AFTER the query, so the query over-fetches: a limit applied first would
  // come back short whenever excluded people sort early.
  const matches = await User.find({
    status: "active",
    name: { $regex: escapeRegex(query.trim()), $options: "i" },
  })
    .select("name designation")
    .sort({ name: 1 })
    .limit(ADDABLE_SEARCH_LIMIT + excluded.size);

  const items = matches
    .filter((u) => !excluded.has(String(u._id)))
    .slice(0, ADDABLE_SEARCH_LIMIT)
    .map((u) => ({ id: String(u._id), name: u.name, designation: u.designation }));

  return { items };
};

const assertChangesValid = async (changes, { review, cycle, onList }) => {
  const errors = [];
  const seen = new Set();

  const addIds = changes.filter((c) => c.type === "add").map((c) => c.userId);
  const [addable, notPeers] = await Promise.all([
    User.find({ _id: { $in: addIds } }).select("name status"),
    addIds.length
      ? notPeersOf(review.userId, { from: cycle.startDate, to: cycle.endDate })
      : new Set(),
  ]);
  const userById = new Map(addable.map((u) => [String(u._id), u]));

  for (const change of changes) {
    const id = String(change.userId);
    if (seen.has(id)) errors.push("Each person can appear in only one requested change");
    seen.add(id);

    if (change.type === "remove") {
      if (!onList.has(id))
        errors.push("A person can only be removed if they are on the list");
      continue;
    }

    const user = userById.get(id);
    if (!user) {
      errors.push("A person to be added does not exist");
    } else if (same(id, review.userId)) {
      errors.push("Nobody can be added to their own list");
    } else if (onList.has(id)) {
      errors.push(`${user.name} is already on the list`);
    } else if (user.status !== "active") {
      errors.push(`${user.name} is not active, so cannot write a review`);
    } else if (notPeers.has(id)) {
      errors.push(
        `${user.name} is above or below this person in the reporting line, so is not a peer`,
      );
    }
  }

  if (errors.length) throw new AppError(errors.join("; "), 400);
};

const confirmList = async (reviewId, actor, { changes = [] } = {}) => {
  const { review, cycle } = await loadReview(reviewId);
  await assertMayConfirm(review, actor);
  assertCollecting(cycle);

  if (await ReviewerList.exists({ reviewId: review._id })) {
    throw new AppError("This list has already been confirmed", 409);
  }
  if (await Feedback.exists({ reviewId: review._id, reviewerType: "peer" })) {
    throw new AppError(
      "Colleague reviewers have already been chosen for this review",
      409,
    );
  }

  const { candidates } = await candidatesFor(review.userId, {
    from: cycle.startDate,
    to: cycle.endDate,
  });
  await assertChangesValid(changes, {
    review,
    cycle,
    onList: new Set(candidates.map((c) => c.id)),
  });

  try {
    await ReviewerList.create({
      reviewId: review._id,
      cycleId: cycle._id,
      revieweeId: review.userId,
      candidates: candidates.map((c) => ({
        userId: c.id,
        via: { kind: c.via.kind, sourceId: c.via.id, name: c.via.name },
        sharedFrom: c.sharedFrom,
        sharedTo: c.sharedTo,
      })),
      confirmedBy: actor.id,
      confirmedAt: new Date(),
      changes: changes.map((c) => ({
        type: c.type,
        userId: c.userId,
        reason: c.reason,
        requestedBy: actor.id,
      })),
    });
  } catch (err) {
    if (err.code === 11000)
      throw new AppError("This list has already been confirmed", 409);
    throw err;
  }

  return listFor(reviewId, actor);
};

const decideChange = async (reviewId, changeId, actor, { approve }) => {
  const { review, cycle } = await loadReview(reviewId);
  await assertHrMayAct(review, actor, "decide changes to this person's colleague list");
  assertCollecting(cycle);

  const list = await ReviewerList.findOne({ reviewId: review._id });
  const change = list?.changes.id(changeId);
  if (!change) throw new AppError("Requested change not found", 404);

  if (list.drawnAt)
    throw new AppError("Reviewers have already been drawn from this list", 409);
  if (change.status !== "pending")
    throw new AppError("This change has already been decided", 409);

  // ⚠️ Somebody who is both a supervisor and HR would otherwise approve their own request,
  // which is exactly the conflict approval exists to stop.
  if (same(change.requestedBy, actor.id)) {
    throw new AppError(
      "You requested this change, so somebody else in HR has to decide it",
      403,
    );
  }

  change.status = approve ? "approved" : "refused";
  change.decidedBy = actor.id;
  change.decidedAt = new Date();
  await list.save();

  // ⚠️ The colleague the change concerns is never recorded: naming them would put the shape
  // of the list in the log. Whose list was changed, and how, is.
  await audit.record({
    actorId: actor.id,
    action: "colleague_list_decision",
    subjectUserId: review.userId,
    targetType: "reviewerList",
    targetId: list._id,
    reason: change.reason || null,
    detail: `${approve ? "Approved" : "Refused"} a requested ${change.type} on this person's colleague list`,
  });

  return listFor(reviewId, actor);
};

const drawReviewers = async (reviewId, actor, { acknowledged = false } = {}) => {
  const { review, cycle } = await loadReview(reviewId);
  await assertHrMayAct(review, actor, "choose colleague reviewers for this person");
  assertCollecting(cycle);

  const [list, already] = await Promise.all([
    ReviewerList.findOne({ reviewId: review._id }),
    Feedback.exists({ reviewId: review._id, reviewerType: "peer" }),
  ]);

  // ⚠️ ONE POOL PER PERSON PER CYCLE. A second draw would let anyone who saw the first list
  // narrow down the second.
  if (already || list?.drawnAt) {
    throw new AppError(
      "Colleague reviewers have already been chosen for this review",
      409,
    );
  }
  if (!list)
    throw new AppError("This person's colleague list has not been confirmed yet", 409);
  if (list.changes.some((c) => c.status === "pending")) {
    throw new AppError(
      "A requested change to this list is still waiting for a decision",
      409,
    );
  }

  const plan = await drawable(list, cycle);
  if (plan.needsAcknowledgement && !acknowledged) {
    throw new AppError(
      plan.noColleagueSection
        ? `Only ${plan.available} colleagues are available and at least ${PEER_REVIEWS_SMALL_POOL} are needed, so this review will have no colleague section. Acknowledge this to continue.`
        : `Only ${plan.available} colleagues are available, below the usual ${PEER_REVIEWS_MINIMUM}. As a small pool it needs ${PEER_REVIEWS_SMALL_POOL}. Acknowledge this to continue.`,
      409,
    );
  }

  // Claimed before anything is written, so two HR officers drawing at once cannot both succeed.
  const claimed = await ReviewerList.findOneAndUpdate(
    { _id: list._id, drawnAt: null },
    { $set: { drawnAt: new Date(), drawnBy: actor.id } },
    { returnDocument: "after" },
  );
  if (!claimed)
    throw new AppError(
      "Colleague reviewers have already been chosen for this review",
      409,
    );

  // ⚠️ Shuffled AGAIN before the labels are dealt. The picks come out ordered by load, and labels
  // dealt in that order would carry it.
  const picked = shuffled(pickBalanced(plan.eligible, PEER_REVIEWS_TARGET));
  const reviewee = await User.findById(review.userId).select("jobFamily");

  try {
    if (picked.length) {
      await Feedback.insertMany(
        picked.map((p, i) => ({
          reviewId: review._id,
          reviewerId: p.userId,
          revieweeId: review.userId,
          reviewerType: "peer",
          // The reviewee's family decides the questions, never the reviewer's.
          formTemplateKey: reviewee.jobFamily,
          formTemplateVersion: 1,
          status: "assigned",
          label: `tm${i + 1}`,
          drawnFrom: p.via,
        })),
      );
    }
  } catch (err) {
    await ReviewerList.updateOne(
      { _id: list._id },
      { $set: { drawnAt: null, drawnBy: null } },
    );
    throw err;
  }

  claimed.drawnCount = picked.length;
  claimed.shortfallAcknowledged = plan.needsAcknowledgement;
  await claimed.save();

  return {
    reviewId: String(review._id),
    assigned: picked.length,
    available: plan.available,
    target: plan.target,
    required: plan.required,
    short: picked.length < plan.target,
    noColleagueSection: plan.noColleagueSection,
  };
};

module.exports = {
  listFor,
  listsForTeam,
  listsForCycle,
  addableFor,
  confirmList,
  decideChange,
  drawReviewers,
};
