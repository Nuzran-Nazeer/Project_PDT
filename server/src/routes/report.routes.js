const router = require("express").Router();
const controller = require("../controllers/report.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

// ⚠️ The role gate is the coarse one. The service refuses again, so a route added later
// without it cannot open the reports by accident.
router.get(
  "/rating-distribution",
  protect,
  authorize("leadership"),
  controller.ratingDistribution,
);
router.get("/plan-progress", protect, authorize("leadership"), controller.planProgress);
router.get("/audit-counts", protect, authorize("leadership"), controller.auditCounts);

module.exports = router;
