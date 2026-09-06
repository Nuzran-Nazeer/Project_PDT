const router = require("express").Router();
const controller = require("../controllers/projectassignment.controller");
const {
  validateCreateAssignment,
  validateCloseAssignment,
  validateTeamLead,
  validateAssignmentQuery,
} = require("../validators/project.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// The same split as projects: a coarse role gate here, the coverage rule inside the
// service. See project.routes.js.
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

// Its own route rather than a field on an update: marking a team lead rewrites two
// people's records, and a general PATCH would invite a client to set `isTeamLead`
// directly, which is the one thing that must never happen -- it would overwrite the
// history this collection exists to keep.
router
  .route("/:id/team-lead")
  .put(protect, authorize(...CAN_WRITE), validateTeamLead, controller.markTeamLead);

router.route("/:id").get(protect, authorize(...CAN_READ), controller.getAssignment);

// No DELETE: an assignment is the evidence somebody worked on something.

module.exports = router;
