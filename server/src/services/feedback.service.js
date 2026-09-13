const Feedback = require("../models/feedback.model");
const Review = require("../models/review.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { forConsumerList } = require("./feedback.privacy");
const { teamOn, readinessOn } = require("./supervision.service");
const { currentCycleFor } = require("./cycle.service");
const {
  competenciesFor,
  FEEDBACK_EDIT_WINDOW_HOURS,
  PEER_DISPLAY_THRESHOLD,
} = require("../config/constants");
const { isEditable, hasSettled, lockTimeFor } = require("./feedback.window");

// Writing colleague feedback, and serving what has arrived to the one person allowed to
// read it raw.

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

// The reviewee's family decides the questions, never the reviewer's: a Tech Lead
// reviewing a QA Engineer answers the QA set.
const competenciesForRecord = (doc) =>
  competenciesFor(doc.revieweeId?.jobFamily || doc.formTemplateKey);

/**
 * Everything this person has been asked to write, with the questions attached.
 *
 * A reviewer only ever sees their OWN assignments: the query is filtered by the id in
 * the token, so there is no request shape that returns somebody else's.
 */
const owedBy = async (userId) => {
  // ⚠️ The self-assessment lives in this collection with the author as its own
  // reviewer, so without this exclusion a person's own form appears in the list of
  // colleagues they have been asked to review.
  const items = await Feedback.find({ reviewerId: userId, reviewerType: { $ne: "self" } })
    .populate("revieweeId", "name employeeId designation jobFamily")
    .sort({ status: 1, createdAt: 1 });

  return {
    items: items.map((doc) => asOwnRecord(doc, competenciesForRecord(doc))),
    total: items.length,
    outstanding: items.filter((d) => d.status !== "submitted").length,
  };
};

// ⚠️ The ownership check for every write below. It matches on reviewerId AND the id, so
// a reviewer asking for a record that is not theirs gets the same 404 as one that does
// not exist. A 403 would confirm the record exists and who it belongs to.
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

// Rules about the ANSWERS rather than the request's shape, so they live here: they read
// the competency list the record was assigned against.
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

    // A real answer, not a blank: declining stores neither a score nor evidence, so
    // sending either alongside it means the form asked two things at once.
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
    // A number on its own is not accepted anywhere in this system.
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

  // Submitting is a one-way door: an already-submitted record stays submitted while it
  // is still inside its window, rather than dropping back to a draft.
  if (!doc.submittedAt) doc.status = "draft";

  await doc.save();
  return asOwnRecord(doc, competenciesForRecord(doc));
};

// Everything a submission does once the record has been found. The colleague form and
// the self-assessment differ in how they find it and in nothing after that.
const applyAndSubmit = (doc, payload) => {
  assertOpen(doc);
  applyAnswers(doc, payload);

  // Every competency has to be answered one way or the other before it counts as
  // submitted. A draft may be partial; a submission may not.
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

// ⚠️ A REAL RELATIONSHIP CHECK, not the coarse role gate used elsewhere. This is the
// only endpoint serving raw colleague text, so "any signed-in employee" is not a gate
// that can be defended. It is narrow and targeted; the general scope rule is its own
// story and this does not replace it.
const assertMayRead = async (review, viewer) => {
  // ⚠️ BEFORE the role check, never after. An HR officer is somebody's colleague too, and
  // is appraised like everybody else: holding the role must not hand them the raw feedback
  // written about THEMSELVES. Nobody reads their own, whatever they hold.
  if (String(review.userId) === String(viewer.id)) {
    throw new AppError("Review not found", 404);
  }

  const held = viewer?.roles || [];
  if (held.includes("hr") || held.includes("head_of_hr")) return;

  const { team = [] } = await teamOn(viewer.id, new Date());
  const supervises = team.some((p) => String(p.id) === String(review.userId));

  // The same refusal whether the review is out of reach or does not exist, so nobody
  // can map the organisation by probing.
  if (!supervises) throw new AppError("Review not found", 404);
};

/**
 * What has arrived for one person, for the supervisor writing from it.
 *
 * ⚠️ NOTHING IS RELEASED UNTIL HALF THE ASSIGNED REVIEWERS HAVE SETTLED, never fewer
 * than the minimum, and the rest only once everyone is in. Releasing one at a time is
 * the hole this closes: a trickle can be correlated against who was on leave, or who
 * mentioned they had a review to write, and the reviewer is identified without a name
 * ever being served.
 *
 * ⚠️ A POOL SMALLER THAN THE MINIMUM HAS NO COLLEAGUE SECTION AT ALL, which is a
 * different answer from "not enough yet" and never resolves. Two voices in a sub-unit of
 * eight are guessable, and a summary drawn from one is an attribution.
 *
 * The batch is the EARLIEST submissions by time, which is stable as more arrive, so a
 * record already shown never disappears again. The response is ordered by label, so the
 * ordering the server used is not the ordering the supervisor sees.
 *
 * ⚠️ `submittedCount` counts what has SETTLED, deliberately. The gap between that and
 * what has merely been submitted is a submission time to within the edit window.
 */
const collectedFor = async (reviewId, viewer) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError("Review not found", 404);

  await assertMayRead(review, viewer);

  // Resolved here, never by the reader: a rating is stored under a stable key and the
  // wording that key stands for belongs to the reviewee's job family, not the
  // supervisor's. A client working it out is a second copy of that rule.
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
    submittedCount: settled.length,
    minimum: PEER_DISPLAY_THRESHOLD,
    competencies,
    items: [],
    total: 0,
  };

  // Resolved here rather than left to the screen: a client comparing two numbers is a
  // second copy of the rule, and this is the one it must never get wrong.
  if (assigned.length < PEER_DISPLAY_THRESHOLD) {
    return { ...held, reason: "below_minimum", needed: 0 };
  }

  const threshold = Math.max(
    Math.ceil(assigned.length / 2),
    PEER_DISPLAY_THRESHOLD,
  );

  if (settled.length < threshold) {
    return { ...held, reason: "waiting", needed: threshold - settled.length };
  }

  const complete = settled.length === assigned.length;
  const batch = complete ? settled : settled.slice(0, threshold);

  return {
    reviewId: String(reviewId),
    released: true,
    assignedCount: assigned.length,
    submittedCount: settled.length,
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

// The self-assessment. Same collection, same answer rules and the same five-hour
// window; the author is also the subject, and it is attributed rather than
// confidential, so nothing here strips anything.

// ⚠️ NO ID IN ANY OF THESE. The cycle comes from the signed-in person's own appraisal
// group and the review from their own id, so there is no request shape that reaches
// somebody else's self-assessment, and none can be added by taking a parameter.
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

// ⚠️ `not_started` is NOT a stored status. The record is created by the first save, so
// until then there is nothing to report one from. Creating it on sight would put an
// empty document into the cycle for everybody who never opened the form.
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

  // Null is a real answer twice over: for most of the year a group is between cycles,
  // and somebody in no unit has no review to attach one to.
  const doc = review
    ? await Feedback.findOne({
        reviewId: review._id,
        reviewerId: user._id,
        reviewerType: "self",
      })
    : null;

  return asSelfRecord({ user, cycle, review, doc });
};

// Created by the first write rather than when the cycle opens. A second one is
// impossible regardless: the unique index on review + reviewee + reviewer refuses it.
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
    // The subject's job family decides the questions, and here that is the author.
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

  // Submitting is a one-way door here too: an already-submitted assessment stays
  // submitted inside its window rather than dropping back to a draft.
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

// The supervisor's own review of one of their team. Same collection, same answer rules
// and the same window; it is attributed, and it alone carries the colleague summary.

// ⚠️ NOT the gate the collected read uses. HR may READ a supervisor review and may never
// write one, so this check has no role branch at all: supervising somebody is a
// relationship, and no role is a substitute for it.
const assertSupervises = async (review, viewer) => {
  const { team = [] } = await teamOn(viewer.id, new Date());

  // The same refusal as a review that does not exist, so nobody can map the
  // organisation by probing ids.
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

const supervisorRecordFor = async (reviewId, viewer) => {
  const review = await Review.findById(reviewId);
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

  // ⚠️ The gate stops somebody STARTING one, and never touches a record that exists.
  // Readiness can fall back to waiting when a late colleague record appears, and shutting
  // an author out of their own half-written review would strand it.
  if (!doc && readiness.state !== "ready") throw notReadyError(readiness);

  return { review, reviewee, doc, readiness };
};

// Created by the first write, like the self-assessment: opening the form must not put an
// empty review into the cycle for everybody a supervisor merely looked at.
const openSupervisorRecord = async (reviewId, viewer) => {
  const found = await supervisorRecordFor(reviewId, viewer);
  if (found.doc) return found;

  const doc = await Feedback.create({
    reviewId: found.review._id,
    reviewerId: viewer.id,
    revieweeId: found.review.userId,
    reviewerType: "supervisor",
    // The REVIEWEE's family decides the questions, never the supervisor's.
    formTemplateKey: found.reviewee.jobFamily,
    formTemplateVersion: 1,
    status: "assigned",
  });

  return { ...found, doc };
};

// ⚠️ Applied only here. The summary is a digest of OTHER people's feedback, so it has no
// meaning on a self-assessment or a colleague's form and is ignored on both.
const applyColleagueSummary = (doc, payload) => {
  if (payload.colleagueSummary !== undefined) {
    doc.colleagueSummary = payload.colleagueSummary ?? null;
  }
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
  // ⚠️ `not_started` is NOT a stored status: the record does not exist until the first
  // save, so until then there is nothing to report one from.
  status: doc ? doc.status : "not_started",
  ratings: doc ? doc.ratings : [],
  freeText: doc ? doc.freeText : { strengths: null, development: null },
  colleagueSummary: doc ? doc.colleagueSummary : null,
  submittedAt: doc ? doc.submittedAt : null,
  locksAt: doc ? doc.locksAt : null,
  editable: !doc || isEditable(doc),
  readiness,
  competencies: competenciesFor(reviewee.jobFamily),
});

const supervisorReviewFor = async (reviewId, viewer) =>
  asSupervisorRecord(await supervisorRecordFor(reviewId, viewer));

const saveSupervisorDraft = async (reviewId, viewer, payload) => {
  const found = await openSupervisorRecord(reviewId, viewer);
  assertOpen(found.doc);

  applyAnswers(found.doc, payload);
  applyColleagueSummary(found.doc, payload);

  // Submitting is a one-way door here too: an already-submitted review stays submitted
  // inside its window rather than dropping back to a draft.
  if (!found.doc.submittedAt) found.doc.status = "draft";

  await found.doc.save();
  return asSupervisorRecord(found);
};

const submitSupervisorReview = async (reviewId, viewer, payload) => {
  const found = await openSupervisorRecord(reviewId, viewer);

  applyAndSubmit(found.doc, payload);
  applyColleagueSummary(found.doc, payload);

  await found.doc.save();
  return asSupervisorRecord(found);
};

/**
 * One person's own assessment, read by their supervisor or by HR.
 *
 * ⚠️ NOT `/feedback/self`, which takes no id and reaches only the caller's own record. That
 * narrowness is the point of it, so this is a separate route with its own gate rather than a
 * parameter added to that one.
 *
 * ⚠️ SETTLED, not submitted. The access matrix says "once submitted" and the state machine says
 * nothing downstream reads a document until its window has closed; **the stricter of the two
 * wins**, or a supervisor starts reading an assessment that is then rewritten underneath them.
 */
const assessmentFor = async (reviewId, viewer) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError("Review not found", 404);

  // The same gate as the collected read, and deliberately not the form's: HR reads an
  // assessment, and HR never writes the review drawn from it.
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
    // Served in every state: a screen must never resolve a job family to wording itself.
    competencies: competenciesFor(reviewee.jobFamily),
  };

  const withheld = (reason) => ({
    ...shell,
    available: false,
    reason,
    ratings: [],
    freeText: { strengths: null, development: null },
  });

  // ⚠️ Two absences a screen has to tell apart: one is waiting on the author, the other on a
  // clock that has already started. "Nothing written yet" in the second case is false.
  //
  // A draft is reported as not submitted rather than as a draft. Whether somebody has saved
  // and not sent is theirs, and no criterion needs it.
  if (!doc || !doc.submittedAt) return withheld("not_submitted");
  if (!hasSettled(doc)) return withheld("in_window");

  // ⚠️ No timestamps, even though this record is attributed and its author is its subject:
  // every time-bearing field on a feedback record is identifying by default, and one is added
  // only when something actually needs it.
  return { ...shell, available: true, reason: null, ratings: doc.ratings, freeText: doc.freeText };
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
