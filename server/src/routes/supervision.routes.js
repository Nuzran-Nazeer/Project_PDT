const router = require("express").Router();
const controller = require("../controllers/supervision.controller");
const { validateReportingLineQuery } = require("../validators/orgstructure.validator");
const { protect, authorizeSelfOr } = require("../middleware/auth.middleware");

// Your own line is open to any signed-in employee. ⚠️ An employee reading their own
// line does not get skipLevel: the controller strips it, never only the client.
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/team/:userId")
  .get(
    protect,
    authorizeSelfOr("userId", ...CAN_READ),
    validateReportingLineQuery,
    controller.getTeam,
  );

router
  .route("/:userId")
  .get(
    protect,
    authorizeSelfOr("userId", ...CAN_READ),
    validateReportingLineQuery,
    controller.getReportingLine,
  );

module.exports = router;
