const router = require("express").Router();
const controller = require("../controllers/feedback.controller");
const {
  validateFeedbackId,
  validateReviewId,
  validateAnswers,
  validateReveal,
} = require("../validators/feedback.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// ⚠️ No `authorize()` here on purpose, the reveal route aside: being asked to review a
// colleague is a record with your id on it, not a role. Every handler filters by the id in the token.

router.route("/owed").get(protect, controller.listOwed);

router
  .route("/owed/:id")
  .get(protect, validateFeedbackId, controller.getOwed)
  .put(protect, validateFeedbackId, validateAnswers, controller.saveDraft);

// Its own route: a general PUT would invite a client to set `status` to anything.
router
  .route("/owed/:id/submit")
  .put(protect, validateFeedbackId, validateAnswers, controller.submit);

// ⚠️ No id in the path, deliberately: the record is reached through the token alone.
router
  .route("/self")
  .get(protect, controller.getSelfAssessment)
  .put(protect, validateAnswers, controller.saveSelfDraft);

router.route("/self/submit").put(protect, validateAnswers, controller.submitSelf);

// Gated on actually supervising the person, in the service.
router
  .route("/collected/:reviewId")
  .get(protect, validateReviewId, controller.getCollected);

// Somebody else's assessment. ⚠️ Never an optional id on `/self`: that route takes none.
router
  .route("/self-assessment/:reviewId")
  .get(protect, validateReviewId, controller.getAssessment);

// Keyed by the review: until the first save there is no record to name.
router
  .route("/supervisor/:reviewId")
  .get(protect, validateReviewId, controller.getSupervisorReview)
  .put(protect, validateReviewId, validateAnswers, controller.saveSupervisorDraft);

router
  .route("/supervisor/:reviewId/submit")
  .put(protect, validateReviewId, validateAnswers, controller.submitSupervisorReview);

// ⚠️ Addressed by the random label, not by the record's id: the id is never served for
// confidential feedback, so this route only reaches what the officer was already shown.
// POST, not GET: a reveal carries a written reason and is not a repeatable read.
// ⚠️ The one role gate in this file. The service checks the role again and is the real
// rule, but it runs inside the block that writes the audit entry: without the gate, anyone with
// a login can put a permanent row and a monitoring flag in the record that proves confidentiality.
router
  .route("/collected/:reviewId/:label/reveal")
  .post(protect, authorize("hr", "head_of_hr"), validateReveal, controller.revealAuthor);

// No DELETE: submitted feedback is part of somebody's appraisal record.

module.exports = router;
