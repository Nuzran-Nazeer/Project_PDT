const router = require("express").Router();
const controller = require("../controllers/monitoring.controller");
const { validateFlagReview } = require("../validators/monitoring.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// ⚠️ The role gate is the coarse one. The service refuses again, so a route added later
// without it cannot open the flags by accident.
router.route("/").get(protect, authorize("head_of_hr"), controller.list);

router
  .route("/:id/reviewed")
  .patch(protect, authorize("head_of_hr"), validateFlagReview, controller.markReviewed);

module.exports = router;
