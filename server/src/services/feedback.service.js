const Feedback = require("../models/feedback.model");
const Review = require("../models/review.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { forConsumerList } = require("./feedback.privacy");
const { teamOn, readinessOn } = require("./supervision.service");
const { assertHrMayRead } = require("./coverageAuth.service");
const { currentCycleFor } = require("./cycle.service");
const {
  competenciesFor,
  FEEDBACK_EDIT_WINDOW_HOURS,
  PEER_DISPLAY_THRESHOLD,
  hasColleagueSection,
} = require("../config/constants");
const { isEditable, hasSettled, lockTimeFor } = require("./feedback.window");
const { pendingSendBack } = require("./summaryCheck.state");

const asOwnRecord = (doc, competencies) => ({
  id: String(doc._id),
  reviewId: String(doc.reviewId),
  reviewee: doc.revieweeId?.name
    ? {
        id: String(doc.revieweeId._id),
        name: doc.revieweeId.name,
        employeeId: doc.revieweeId.employeeId,
        designation: doc.revieweeId.designation,
        jobFamily: doc.revieweeId.jobFamily,
      }
    : { id: String(doc.revieweeId) },
  reviewerType: doc.reviewerType,
  status: doc.status,
  ratings: doc.ratings,
  freeText: doc.freeText,
  submittedAt: doc.submittedAt,
  locksAt: doc.locksAt,
  editable: isEditable(doc),
  competencies,
});

// The reviewee's family decides the questions, never the reviewer's.
const competenciesForRecord = (doc) =>
  competenciesFor(doc.revieweeId?.jobFamily || doc.formTemplateKey);

const owedBy = async (userId) => {
  // ⚠️ The self-assessment has the author as its own reviewer, so it must be excluded here.
  const items = await Feedback.find({ reviewerId: userId, reviewerType: { $ne: "self" } })
    .populate("revieweeId", "name employeeId designation jobFamily")
    .sort({ status: 1, createdAt: 1 });

  return {
    items: items.map((doc) => asOwnRecord(doc, competenciesForRecord(doc))),
    total: items.length,
    outstanding: items.filter((d) => !d.submittedAt).length,
  };
};

// ⚠️ Matches on reviewerId and id together: a record that is not yours 404s like one that
// does not exist. A 403 would confirm it exists.
const ownedBy = async (id, userId) => {
  const doc = await Feedback.findOne({ _id: id, reviewerId: userId }).populate(
    "revieweeId",
    "name employeeId designation jobFamily",
  );
  if (!doc) throw new AppError("Feedback not found", 404);
  return doc;
};

const getForReviewer = async (id, userId) => {
  const doc = await ownedBy(id, userId);
  return asOwnRecord(doc, competenciesForRecord(doc));
};

const assertAnswersValid = (ratings = [], doc) => {
  const allowed = new Set(competenciesForRecord(doc).map((c) => c.key));
  const seen = new Set();
  const errors = [];

  for (const row of ratings) {
    if (!allowed.has(row.competencyKey)) {
      errors.push(`${row.competencyKey} is not a competency on this form`);
      continue;
    }
    if (seen.has(row.competencyKey)) {
      errors.push(`${row.competencyKey} is answered twice`);
    }
    seen.add(row.competencyKey);

    // Declining stores neither a score nor evidence.
    if (row.notObserved) {
      if (row.score !== null && row.score !== undefined) {
        errors.push(`${row.competencyKey} is marked not observed but carries a score`);
      }
      if (row.evidence) {
        errors.push(`${row.competencyKey} is marked not observed but carries evidence`);
      }
      continue;
    }

    if (row.score === null || row.score === undefined) {
      errors.push(`${row.competencyKey} needs a score or must be marked not observed`);
    }
    if (row.score !== null && row.score !== undefined && !row.evidence) {
      errors.push(`${row.competencyKey} needs evidence for the score given`);
    }
  }

  if (errors.length) throw new AppError(errors.join("; "), 400);
};

const applyAnswers = (doc, { ratings, freeText }) => {
  if (ratings !== undefined) {
    assertAnswersValid(ratings, doc);
    doc.ratings = ratings.map((row) => ({
      competencyKey: row.competencyKey,
      notObserved: Boolean(row.notObserved),
      score: row.notObserved ? null : (row.score ?? null),
      evidence: row.notObserved ? null : (row.evidence ?? null),
    }));
  }
  if (freeText !== undefined) {
    doc.freeText = {
      strengths: freeText.strengths ?? null,
      development: freeText.development ?? null,
    };
  }
};

const assertOpen = (doc) => {
  if (isEditable(doc)) return;
  throw new AppError(
    `This feedback locked ${FEEDBACK_EDIT_WINDOW_HOURS} hours after it was submitted and can no longer be changed`,
    409,
  );
};

const saveDraft = async (id, userId, payload) => {
  const doc = await ownedBy(id, userId);
  assertOpen(doc);

  applyAnswers(doc, payload);

  // A submitted record inside its window never drops back to a draft.
  if (!doc.submittedAt) doc.status = "draft";

  await doc.save();
  return asOwnRecord(doc, competenciesForRecord(doc));
};

const applyAndSubmit = (doc, payload) => {
  assertOpen(doc);
  applyAnswers(doc, payload);

  // A draft may be partial; a submission may not.
  const expected = competenciesForRecord(doc).length;
  if (doc.ratings.length !== expected) {
    throw new AppError(
      `All ${expected} competencies must be answered or marked not observed before submitting`,
      400,
    );
  }
  assertAnswersValid(doc.ratings, doc);

  if (!doc.submittedAt) {
    doc.submittedAt = new Date();
    doc.locksAt = lockTimeFor(doc.submittedAt);
    doc.status = "submitted";
  }
};

const submit = async (id, userId, payload) => {
  const doc = await ownedBy(id, userId);
  applyAndSubmit(doc, payload);

  await doc.save();
  return asOwnRecord(doc, competenciesForRecord(doc));
};

// A relationship check, not a role gate: HR within their coverage, or the supervisor today.
const assertMayRead = async (review, viewer) => {
  // ⚠️ Before the role check: nobody reads the raw feedback about themselves, whatever they hold.
  if (String(review.userId) === String(viewer.id)) {
    throw new AppError("Review not found", 404);
  }

  const held = viewer?.roles || [];
  if (held.includes("hr") || held.includes("head_of_hr")) {
    const covered = await assertHrMayRead(viewer, review.userId).then(
      () => true,
      () => false,
    );
    if (covered) return;
  }

  const { team = [] } = await teamOn(viewer.id, new Date());
  const supervises = team.some((p) => String(p.id) === String(review.userId));

  // The same refusal as a review that does not exist, so nobody can map the organisation.
  if (!supervises) throw new AppError("Review not found", 404);
};

// ⚠️ Nothing is released until half the reviewers have settled (submitted and past the edit
// window), never fewer than the minimum, and the rest only once everyone is in: a trickle
// identifies its authors. A pool below the minimum has no colleague section at all.
const collectedFor = async (reviewId, viewer) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError("Review not found", 404);

  await assertMayRead(review, viewer);

  // The wording belongs to the reviewee's job family, resolved here, never by the screen.
  const reviewee = await User.findById(review.userId).select("jobFamily");
  const competencies = competenciesFor(reviewee?.jobFamily);

  const assigned = await Feedback.find({ reviewId, reviewerType: "peer" }).sort({
    submittedAt: 1,
  });

  const settled = assigned.filter(hasSettled);

  const held = {
    reviewId: String(reviewId),
    released: false,
    assignedCount: assigned.length,
    settledCount: settled.length,
    minimum: PEER_DISPLAY_THRESHOLD,
    competencies,
    items: [],
    total: 0,
  };

  if (!hasColleagueSection(assigned.length)) {
    return { ...held, reason: "below_minimum", needed: 0 };
  }

  const threshold = Math.max(Math.ceil(assigned.length / 2), PEER_DISPLAY_THRESHOLD);

  if (settled.length < threshold) {
    return { ...held, reason: "waiting", needed: threshold - settled.length };
  }

  const complete = settled.length === assigned.length;
  const batch = complete ? settled : settled.slice(0, threshold);

  return {
    reviewId: String(reviewId),
    released: true,
    assignedCount: assigned.length,
    settledCount: settled.length,
    minimum: PEER_DISPLAY_THRESHOLD,
    needed: 0,
    complete,
    competencies,
    items: forConsumerList(batch).sort((a, b) =>
      String(a.id).localeCompare(String(b.id)),
    ),
    total: batch.length,
  };
};

// ⚠️ The self-assessment takes no id anywhere: cycle and review come from the signed-in
// person, so no request shape reaches somebody else's. Never add a parameter.
const liveReviewFor = async (userId) => {
  const user = await User.findById(userId).select(
    "name employeeId designation jobFamily parGroup",
  );
  if (!user) throw new AppError("Employee not found", 404);

  const cycle = await currentCycleFor(user.parGroup);
  const review = cycle
    ? await Review.findOne({ cycleId: cycle._id, userId: user._id })
    : null;

  return { user, cycle, review };
};

const asCycle = (cycle) =>
  cycle
    ? {
        id: String(cycle._id),
        parGroup: cycle.parGroup,
        year: cycle.year,
        status: cycle.status,
      }
    : null;

// `not_started` is not a stored status: the record is created by the first save.
const asSelfRecord = ({ user, cycle, review, doc }) => ({
  cycle: asCycle(cycle),
  reviewId: review ? String(review._id) : null,
  status: doc ? doc.status : "not_started",
  ratings: doc ? doc.ratings : [],
  freeText: doc ? doc.freeText : { strengths: null, development: null },
  submittedAt: doc ? doc.submittedAt : null,
  locksAt: doc ? doc.locksAt : null,
  editable: Boolean(review) && (!doc || isEditable(doc)),
  competencies: competenciesFor(user.jobFamily),
});

const selfAssessmentFor = async (userId) => {
  const { user, cycle, review } = await liveReviewFor(userId);

  const doc = review
    ? await Feedback.findOne({
        reviewId: review._id,
        reviewerId: user._id,
        reviewerType: "self",
      })
    : null;

  return asSelfRecord({ user, cycle, review, doc });
};

const openSelfRecord = async (userId) => {
  const { user, cycle, review } = await liveReviewFor(userId);

  if (!cycle) {
    throw new AppError("No appraisal cycle is running for your group", 409);
  }
  if (!review) {
    throw new AppError(
      "You have no review in this cycle, so there is no self-assessment to write",
      409,
    );
  }

  const existing = await Feedback.findOne({
    reviewId: review._id,
    reviewerId: user._id,
    reviewerType: "self",
  });
  if (existing) return { user, cycle, review, doc: existing };

  const doc = await Feedback.create({
    reviewId: review._id,
    reviewerId: user._id,
    revieweeId: user._id,
    reviewerType: "self",
    formTemplateKey: user.jobFamily,
    formTemplateVersion: 1,
    status: "assigned",
  });

  return { user, cycle, review, doc };
};

const saveSelfDraft = async (userId, payload) => {
  const found = await openSelfRecord(userId);
  assertOpen(found.doc);

  applyAnswers(found.doc, payload);

  if (!found.doc.submittedAt) found.doc.status = "draft";

  await found.doc.save();
  return asSelfRecord(found);
};

const submitSelf = async (userId, payload) => {
  const found = await openSelfRecord(userId);
  applyAndSubmit(found.doc, payload);

  await found.doc.save();
  return asSelfRecord(found);
};

// ⚠️ Not the gate the collected read uses: HR may read a supervisor review and may never
// write one, so there is no role branch here.
const assertSupervises = async (review, viewer) => {
  const { team = [] } = await teamOn(viewer.id, new Date());

  if (!team.some((p) => String(p.id) === String(review.userId))) {
    throw new AppError("Review not found", 404);
  }
};

const notReadyError = (readiness) => {
  const missing = [
    readiness.missing.selfAssessment && "the self-assessment is not in yet",
    readiness.missing.colleagues &&
      `${readiness.missing.colleagues} of the colleague responses are still outstanding`,
  ].filter(Boolean);

  return new AppError(`This review cannot be started yet: ${missing.join(", ")}`, 409);
};

const isPublished = (review) => Boolean(review.publishedAt);

const assertUnpublished = (review) => {
  if (!isPublished(review)) return;
  throw new AppError(
    "This review has been published, so the supervisor's review can no longer be changed",
    409,
  );
};

const supervisorRecordFor = async (reviewId, viewer) => {
  const review = await Review.findById(reviewId).populate("checks.officerId", "name");
  if (!review) throw new AppError("Review not found", 404);

  await assertSupervises(review, viewer);

  const reviewee = await User.findById(review.userId).select(
    "name employeeId designation jobFamily",
  );
  if (!reviewee) throw new AppError("Employee not found", 404);

  const doc = await Feedback.findOne({
    reviewId: review._id,
    reviewerId: viewer.id,
    reviewerType: "supervisor",
  });

  const readiness = await readinessOn(review._id);

  // ⚠️ The gate stops somebody starting one and never touches a record that exists, or a
  // late colleague record would strand a half-written review.
  if (!doc && readiness.state !== "ready") throw notReadyError(readiness);

  return { review, reviewee, doc, readiness };
};

const openSupervisorRecord = async (reviewId, viewer) => {
  const found = await supervisorRecordFor(reviewId, viewer);
  if (found.doc) return found;

  const doc = await Feedback.create({
    reviewId: found.review._id,
    reviewerId: viewer.id,
    revieweeId: found.review.userId,
    reviewerType: "supervisor",
    formTemplateKey: found.reviewee.jobFamily,
    formTemplateVersion: 1,
    status: "assigned",
  });

  return { ...found, doc };
};

// Only the supervisor's review carries a colleague summary; the other forms ignore it.
const applyColleagueSummary = (doc, payload) => {
  if (payload.colleagueSummary !== undefined) {
    doc.colleagueSummary = payload.colleagueSummary ?? null;
  }
};

// HR's send-back, until the supervisor answers it with a resubmission. The reason is
// the supervisor's to read; the employee never sees that one happened.
const sentBackNotice = (review, doc) => {
  const check = pendingSendBack(review, doc);
  return check
    ? {
        officer: check.officerId?.name
          ? { id: String(check.officerId._id), name: check.officerId.name }
          : { id: String(check.officerId), name: null },
        at: check.at,
        reason: check.reason,
      }
    : null;
};

const asSupervisorRecord = ({ review, reviewee, doc, readiness }) => ({
  reviewId: String(review._id),
  reviewee: {
    id: String(reviewee._id),
    name: reviewee.name,
    employeeId: reviewee.employeeId,
    designation: reviewee.designation,
    jobFamily: reviewee.jobFamily,
  },
  status: doc ? doc.status : "not_started",
  ratings: doc ? doc.ratings : [],
  freeText: doc ? doc.freeText : { strengths: null, development: null },
  colleagueSummary: doc ? doc.colleagueSummary : null,
  submittedAt: doc ? doc.submittedAt : null,
  locksAt: doc ? doc.locksAt : null,
  publishedAt: review.publishedAt,
  sentBack: sentBackNotice(review, doc),
  editable: !isPublished(review) && (!doc || isEditable(doc)),
  readiness,
  competencies: competenciesFor(reviewee.jobFamily),
});

const supervisorReviewFor = async (reviewId, viewer) =>
  asSupervisorRecord(await supervisorRecordFor(reviewId, viewer));

const saveSupervisorDraft = async (reviewId, viewer, payload) => {
  const found = await openSupervisorRecord(reviewId, viewer);
  assertUnpublished(found.review);
  assertOpen(found.doc);

  applyAnswers(found.doc, payload);
  applyColleagueSummary(found.doc, payload);

  if (!found.doc.submittedAt) found.doc.status = "draft";

  await found.doc.save();
  return asSupervisorRecord(found);
};

const submitSupervisorReview = async (reviewId, viewer, payload) => {
  const found = await openSupervisorRecord(reviewId, viewer);
  assertUnpublished(found.review);

  applyAndSubmit(found.doc, payload);
  applyColleagueSummary(found.doc, payload);

  await found.doc.save();
  return asSupervisorRecord(found);
};

// Somebody else's self-assessment, for their supervisor or HR. Kept apart from
// `/feedback/self`, which takes no id. Released once settled, not once submitted.
const assessmentFor = async (reviewId, viewer) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError("Review not found", 404);

  await assertMayRead(review, viewer);

  const reviewee = await User.findById(review.userId).select(
    "name employeeId designation jobFamily",
  );
  if (!reviewee) throw new AppError("Employee not found", 404);

  const doc = await Feedback.findOne({
    reviewId: review._id,
    revieweeId: review.userId,
    reviewerType: "self",
  });

  const shell = {
    reviewId: String(reviewId),
    reviewee: {
      id: String(reviewee._id),
      name: reviewee.name,
      employeeId: reviewee.employeeId,
      designation: reviewee.designation,
      jobFamily: reviewee.jobFamily,
    },
    competencies: competenciesFor(reviewee.jobFamily),
  };

  const withheld = (reason) => ({
    ...shell,
    available: false,
    reason,
    ratings: [],
    freeText: { strengths: null, development: null },
  });

  // A draft reports as not submitted: whether somebody has saved and not sent is theirs.
  if (!doc || !doc.submittedAt) return withheld("not_submitted");
  if (!hasSettled(doc)) return withheld("in_window");

  // ⚠️ No timestamps: every time-bearing field on a feedback record is identifying by default.
  return {
    ...shell,
    available: true,
    reason: null,
    ratings: doc.ratings,
    freeText: doc.freeText,
  };
};

module.exports = {
  owedBy,
  getForReviewer,
  saveDraft,
  submit,
  collectedFor,
  isEditable,
  selfAssessmentFor,
  saveSelfDraft,
  submitSelf,
  supervisorReviewFor,
  saveSupervisorDraft,
  submitSupervisorReview,
  assessmentFor,
};
