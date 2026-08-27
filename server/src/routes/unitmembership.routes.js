const router = require("express").Router();
const controller = require("../controllers/unitmembership.controller");
const {
  validateCreateMembership,
  validateTransfer,
  validateClose,
  validateHistoryQuery,
} = require("../validators/orgstructure.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// HR writes, Head of HR backs it up. Wider than the unit tree, which is Head of HR
// only, because shaping the company is rarer than placing one person in a unit.
//
// ⚠️ Coarse gate: HR should reach only the units they cover, which needs the coverage
// collection. Today any HR officer can move anyone.
const CAN_WRITE = ["hr", "head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(
    protect,
    authorize(...CAN_WRITE),
    validateCreateMembership,
    controller.createMembership,
  )
  .get(protect, authorize(...CAN_READ), validateHistoryQuery, controller.listMemberships);

// Its own route rather than a flag on create, because it writes an end date onto an
// existing record and the route list should show that.
router
  .route("/transfer")
  .post(
    protect,
    authorize(...CAN_WRITE),
    validateTransfer,
    controller.transferMembership,
  );

// No DELETE anywhere: a delete route would erase the evidence an appraisal was built
// on.
router.route("/:id").get(protect, authorize(...CAN_READ), controller.getMembership);

router
  .route("/:id/close")
  .put(protect, authorize(...CAN_WRITE), validateClose, controller.closeMembership);

module.exports = router;
