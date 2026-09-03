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

// The supervisor's read. Gated on actually supervising the person, in the service,
// because the role alone does not say whose feedback this is.
router
  .route("/collected/:reviewId")
  .get(protect, validateReviewId, controller.getCollected);

// NO DELETE. A submitted piece of feedback is part of somebody's appraisal record.

module.exports = router;
