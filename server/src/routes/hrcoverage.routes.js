const router = require("express").Router();
const controller = require("../controllers/hrcoverage.controller");
const {
  validateAssignCoverage,
  validateClose,
  validateCoverageHistoryQuery,
  validateEffectiveCoverageQuery,
} = require("../validators/orgstructure.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Head of HR only: the ACs name the Head of HR as the one who assigns coverage, and
// unlike unit-leads and unit-memberships (HR + Head of HR), this is a structural
// decision about who answers for a unit -- the same tier as shaping the tree or
// discontinuing a unit, both also Head of HR only.
//
// Reading is wider, and matters here for the same reason it does on unit-leads: this
// collection decides which HR officer is responsible for which people, so a wide read
// grant tells anyone holding it who covers whom across the whole company.
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

// ⚠️ Declared BEFORE "/:id": both are one path segment after the base, and Express
// matches routes in registration order, so "/:id" declared first would swallow every
// request to "/effective/:unitId" with "effective" bound to :id.
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
