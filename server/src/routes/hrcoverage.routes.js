const router = require("express").Router();
const controller = require("../controllers/hrcoverage.controller");
const {
  validateAssignCoverage,
  validateClose,
  validateCoverageHistoryQuery,
  validateEffectiveCoverageQuery,
} = require("../validators/orgstructure.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Assigning coverage is the same tier as shaping the tree: Head of HR only.
const CAN_WRITE = ["head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(
    protect,
    authorize(...CAN_WRITE),
    validateAssignCoverage,
    controller.assignCoverage,
  )
  .get(
    protect,
    authorize(...CAN_READ),
    validateCoverageHistoryQuery,
    controller.listCoverage,
  );

// Declared before "/:id", which would otherwise swallow "/mine".
router
  .route("/mine")
  .get(protect, authorize("hr", "head_of_hr"), controller.getMyCoverage);

router
  .route("/effective/:unitId")
  .get(
    protect,
    authorize(...CAN_READ),
    validateEffectiveCoverageQuery,
    controller.getEffectiveCoverage,
  );

router.route("/:id").get(protect, authorize(...CAN_READ), controller.getCoverage);

router
  .route("/:id/close")
  .put(protect, authorize(...CAN_WRITE), validateClose, controller.closeCoverage);

module.exports = router;
