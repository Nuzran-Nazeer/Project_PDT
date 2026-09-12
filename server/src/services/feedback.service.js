const Feedback = require("../models/feedback.model");
const Review = require("../models/review.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { forConsumerList } = require("./feedback.privacy");
const { teamOn } = require("./supervision.service");
const { currentCycleFor } = require("./cycle.service");
const { competenciesFor, FEEDBACK_EDIT_WINDOW_HOURS } = require("../config/constants");

const HOUR_MS = 60 * 60 * 1000;

// Writing colleague feedback, and serving what has arrived to the one person allowed to
// read it raw.

// ⚠️ Editing stays open for a window AFTER submitting, so `submitted` does not mean
// finished. Nothing flips the status to `locked` because no scheduled job exists; the
// window is computed from `locksAt` on every read and write instead. A stored status
// would claim a transition nobody performed.
const isEditable = (doc, now = new Date()) => {
  if (doc.status === "locked") return false;
  if (!doc.submittedAt) return true;
  return Boolean(doc.locksAt) && now.getTime() < doc.locksAt.getTime();
};

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
    doc.locksAt = new Date(
      doc.submittedAt.getTime() + FEEDBACK_EDIT_WINDOW_HOURS * HOUR_MS,
    );
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
 * ⚠️ NOTHING IS RELEASED UNTIL HALF THE ASSIGNED REVIEWERS HAVE SUBMITTED, and the rest
 * only once everyone is in. Releasing one at a time is the hole this closes: a trickle
 * can be correlated against who was on leave, or who mentioned they had a review to
 * write, and the reviewer is identified without a name ever being served.
 *
 * The batch is the EARLIEST submissions by time, which is stable as more arrive, so a
 * record already shown never disappears again. The response is ordered by label, so the
 * ordering the server used is not the ordering the supervisor sees.
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

  const submitted = assigned.filter((d) => d.submittedAt);
  const threshold = Math.ceil(assigned.length / 2);
  const complete = assigned.length > 0 && submitted.length === assigned.length;

  if (!assigned.length || submitted.length < threshold) {
    return {
      reviewId: String(reviewId),
      released: false,
      assignedCount: assigned.length,
      submittedCount: submitted.length,
      needed: Math.max(threshold - submitted.length, 0),
      competencies,
      items: [],
      total: 0,
    };
  }

  const batch = complete ? submitted : submitted.slice(0, threshold);

  return {
    reviewId: String(reviewId),
    released: true,
    assignedCount: assigned.length,
    submittedCount: submitted.length,
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
};
