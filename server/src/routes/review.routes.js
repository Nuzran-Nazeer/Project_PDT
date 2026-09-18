const router = require("express").Router();
const controller = require("../controllers/review.controller");
const { validateReviewId, validateSendBack } = require("../validators/review.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Coarse role gates only; which reviews an officer may see is decided in the service.
const HR = ["hr", "head_of_hr"];

// Declared before `/:id` so the word is never read as an id.

// No role gate and no id: a published result belongs to the person signing in for it.
router.route("/my-result").get(protect, controller.getMyResult);

router.route("/my-result/acknowledge").put(protect, controller.acknowledgeMyResult);

router
  .route("/summary-checks")
  .get(protect, authorize(...HR), controller.listSummaryChecks);

// The summary beside the raw responses, the supervisor's record read-only, and the history.
router
  .route("/:id/summary-check")
  .get(protect, authorize(...HR), validateReviewId, controller.getSummaryCheck);

router
  .route("/:id/summary-check/clear")
  .put(protect, authorize(...HR), validateReviewId, controller.clearSummary);

router
  .route("/:id/summary-check/send-back")
  .put(
    protect,
    authorize(...HR),
    validateReviewId,
    validateSendBack,
    controller.sendBackSummary,
  );

// Publishing a whole cycle is the move into its published stage, on the cycle routes.
// This publishes one review left out of that move.
router
  .route("/:id/publish")
  .put(protect, authorize(...HR), validateReviewId, controller.publishReview);

module.exports = router;
