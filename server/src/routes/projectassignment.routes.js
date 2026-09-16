const router = require("express").Router();
const controller = require("../controllers/projectassignment.controller");
const {
  validateCreateAssignment,
  validateCloseAssignment,
  validateTeamLead,
  validateAssignmentQuery,
} = require("../validators/project.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Coarse role gates only; HR coverage is checked in the controller and service.
const CAN_WRITE = ["hr", "head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(
    protect,
    authorize(...CAN_WRITE),
    validateCreateAssignment,
    controller.createAssignment,
  )
  .get(
    protect,
    authorize(...CAN_READ),
    validateAssignmentQuery,
    controller.listAssignments,
  );

router
  .route("/:id/close")
  .put(
    protect,
    authorize(...CAN_WRITE),
    validateCloseAssignment,
    controller.closeAssignment,
  );

// ⚠️ Its own route: a general PATCH would let a client set `isTeamLead` directly and
// overwrite the history this collection exists to keep.
router
  .route("/:id/team-lead")
  .put(protect, authorize(...CAN_WRITE), validateTeamLead, controller.markTeamLead);

router.route("/:id").get(protect, authorize(...CAN_READ), controller.getAssignment);

// No DELETE: an assignment is evidence somebody worked on something.

module.exports = router;
