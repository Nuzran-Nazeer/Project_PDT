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

// ⚠️ THESE GATES ARE THE COARSE HALF ONLY. They answer "may this role write projects
// at all"; whether this particular HR officer may act on this particular person is
// decided inside the service, by coverageAuth.service.js, because it depends on
// request data a route cannot see.
//
// READING IS DELIBERATELY NOT SCOPED BY COVERAGE. A project spans units by definition,
// so filtering the team by who the reader covers would hide exactly the cross-unit
// work this collection exists to make visible.
const CAN_WRITE = ["hr", "head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(protect, authorize(...CAN_WRITE), validateCreateProject, controller.createProject)
  .get(protect, authorize(...CAN_READ), validateProjectQuery, controller.listProjects);

// Declared before "/:id". Two segments cannot be read as one, so this is convention
// rather than necessity here -- but the ordering rule is what keeps a later single
// segment route like "/current" from being swallowed.
router
  .route("/:id/team")
  .get(protect, authorize(...CAN_READ), validateTeamQuery, controller.getTeam);

router
  .route("/:id/close")
  .put(protect, authorize(...CAN_WRITE), validateCloseProject, controller.closeProject);

router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), validateProjectId, controller.getProject);

// No DELETE. A closed project is the record of who worked on what, and the feedback a
// project lead writes at its close hangs off it.

module.exports = router;
