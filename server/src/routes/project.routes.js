const router = require("express").Router();
const controller = require("../controllers/project.controller");
const {
  validateCreateProject,
  validateCloseProject,
  validateProjectId,
  validateProjectQuery,
  validateTeamQuery,
} = require("../validators/project.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Coarse role gates only; HR coverage is checked in the service. ⚠️ Reading is
// deliberately not scoped: a project spans units by definition.
const CAN_WRITE = ["hr", "head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(protect, authorize(...CAN_WRITE), validateCreateProject, controller.createProject)
  .get(protect, authorize(...CAN_READ), validateProjectQuery, controller.listProjects);

router
  .route("/:id/team")
  .get(protect, authorize(...CAN_READ), validateTeamQuery, controller.getTeam);

router
  .route("/:id/close")
  .put(protect, authorize(...CAN_WRITE), validateCloseProject, controller.closeProject);

router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), validateProjectId, controller.getProject);

// No DELETE: a closed project is the record of who worked on what.

module.exports = router;
