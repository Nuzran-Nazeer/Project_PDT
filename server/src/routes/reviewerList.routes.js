const router = require("express").Router();
const controller = require("../controllers/reviewerList.controller");
const {
  validateReviewId,
  validateChangeId,
  validateCycleQuery,
  validateConfirm,
  validateDecision,
  validateDraw,
} = require("../validators/reviewerList.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// ⚠️ The role gates here are coarse. Supervising somebody is a relationship, not a role, and
// HR's coverage depends on which person: both are checked in the service.
const HR = ["hr", "head_of_hr"];

router
  .route("/")
  .get(protect, authorize(...HR), validateCycleQuery, controller.listForCycle);

// Declared before `/:reviewId` so `team` is never read as an id.
router.route("/team").get(protect, controller.listForTeam);

router.route("/:reviewId").get(protect, validateReviewId, controller.getList);

router
  .route("/:reviewId/confirm")
  .put(protect, validateReviewId, validateConfirm, controller.confirm);

router
  .route("/:reviewId/changes/:changeId")
  .put(
    protect,
    authorize(...HR),
    validateReviewId,
    validateChangeId,
    validateDecision,
    controller.decide,
  );

router
  .route("/:reviewId/draw")
  .put(protect, authorize(...HR), validateReviewId, validateDraw, controller.draw);

module.exports = router;
