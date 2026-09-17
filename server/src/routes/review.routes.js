const router = require("express").Router();
const controller = require("../controllers/review.controller");
const { validateReviewId } = require("../validators/review.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Publishing a whole cycle is the move into its published stage, on the cycle routes.
// This publishes one review left out of that move.
router
  .route("/:id/publish")
  .put(
    protect,
    authorize("hr", "head_of_hr"),
    validateReviewId,
    controller.publishReview,
  );

module.exports = router;
