const router = require("express").Router();
const controller = require("../controllers/plan.controller");
const {
  validatePlanId,
  validateActionId,
  validateReviewIdBody,
  validateAction,
  validateNote,
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

router.route("/").post(protect, validateReviewIdBody, controller.startPlan);

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

module.exports = router;
