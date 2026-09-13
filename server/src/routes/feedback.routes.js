const router = require("express").Router();
const controller = require("../controllers/feedback.controller");
const {
  validateFeedbackId,
  validateReviewId,
  validateAnswers,
} = require("../validators/feedback.validator");
const { protect } = require("../middleware/auth.middleware");

// ⚠️ NO `authorize()` ANYWHERE HERE, and that is deliberate rather than forgotten.
// Being asked to review a colleague is not a role, it is a record with your id on it,
// so a role gate would answer the wrong question. Every handler filters by the id in
// the token instead, which is narrower than any role check could be.

router.route("/owed").get(protect, controller.listOwed);

router
  .route("/owed/:id")
  .get(protect, validateFeedbackId, controller.getOwed)
  .put(protect, validateFeedbackId, validateAnswers, controller.saveDraft);

// Its own route rather than a status field on the update: submitting starts a window
// after which the record can no longer change, and a general PUT would invite a client
// to set `status` to anything.
router
  .route("/owed/:id/submit")
  .put(protect, validateFeedbackId, validateAnswers, controller.submit);

// Your own assessment. No id in the path, deliberately: the record is reached through
// the token alone, which is narrower than any check on an id could be.
router
  .route("/self")
  .get(protect, controller.getSelfAssessment)
  .put(protect, validateAnswers, controller.saveSelfDraft);

router.route("/self/submit").put(protect, validateAnswers, controller.submitSelf);

// The supervisor's read. Gated on actually supervising the person, in the service,
// because the role alone does not say whose feedback this is.
router
  .route("/collected/:reviewId")
  .get(protect, validateReviewId, controller.getCollected);

// Somebody else's own assessment. A separate path from `/self` above rather than an id added
// to it: that route takes no id at all, and keeping it that way is what guarantees there is no
// request shape reaching another person's record through it.
router
  .route("/self-assessment/:reviewId")
  .get(protect, validateReviewId, controller.getAssessment);

// The supervisor's own review, keyed by the REVIEW rather than by a record id: until the
// first save there is no record to name, and the person it is about is not the caller.
router
  .route("/supervisor/:reviewId")
  .get(protect, validateReviewId, controller.getSupervisorReview)
  .put(protect, validateReviewId, validateAnswers, controller.saveSupervisorDraft);

router
  .route("/supervisor/:reviewId/submit")
  .put(protect, validateReviewId, validateAnswers, controller.submitSupervisorReview);

// NO DELETE. A submitted piece of feedback is part of somebody's appraisal record.

module.exports = router;
