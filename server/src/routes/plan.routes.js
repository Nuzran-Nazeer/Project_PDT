const router = require("express").Router();
const controller = require("../controllers/plan.controller");
const {
  validatePlanId,
  validateActionId,
  validateReviewIdBody,
  validateImprovementSource,
  validateAction,
  validateActionStatus,
  validateCheckIn,
  validateNote,
  validateUserId,
} = require("../validators/plan.validator");
const { protect } = require("../middleware/auth.middleware");

// ⚠️ No role gate on any of these. `supervisor` is derived from leading a unit on a date and
// is never in the token, so a coarse gate here would be either wrong or nothing. The service
// refuses anyone who does not supervise the employee today.

// Declared before `/:id` so the word is never read as an id.
router.route("/team").get(protect, controller.listTeamPlans);

// The employee's own plan, reached without an id: nothing they send chooses whose plan it is.
router.route("/mine").get(protect, controller.getMyPlan);

router.route("/mine/acknowledge").put(protect, controller.acknowledgeMyPlan);

router
  .route("/mine/actions/:actionId/notes")
  .post(protect, validateActionId, validateNote, controller.addProgressNote);

// HR's read within their coverage, addressed by the employee rather than by the plan: it is
// reached from that person's record, and the officer has no plan id before opening it.
router
  .route("/employee/:userId")
  .get(protect, validateUserId, controller.getPlanForCoverage);

router.route("/").post(protect, validateReviewIdBody, controller.startPlan);

// Its own route, not a field on the one above: the two have different entry points, different
// references in the body and different rules about who may start one.
router
  .route("/improvement")
  .post(protect, validateImprovementSource, controller.startImprovementPlan);

router.route("/:id").get(protect, validatePlanId, controller.getPlan);

router
  .route("/:id/actions")
  .post(protect, validatePlanId, validateAction, controller.addAction);

router
  .route("/:id/actions/:actionId")
  .put(protect, validatePlanId, validateActionId, validateAction, controller.editAction)
  .delete(protect, validatePlanId, validateActionId, controller.removeAction);

// Sharing hands the plan to the employee; their acknowledgement is what makes it active.
router.route("/:id/share").put(protect, validatePlanId, controller.sharePlan);

router
  .route("/:id/actions/:actionId/status")
  .put(
    protect,
    validatePlanId,
    validateActionId,
    validateActionStatus,
    controller.setActionStatus,
  );

// Appended only: there is no route to edit or delete one, because a check-in is the record of
// a conversation that happened. A correction is a further check-in.
router
  .route("/:id/check-ins")
  .post(protect, validatePlanId, validateCheckIn, controller.recordCheckIn);

module.exports = router;
