const router = require("express").Router();
const controller = require("../controllers/orgunit.controller");
const {
  validateCreateUnit,
  validateUpdateUnit,
  validateDiscontinueUnit,
} = require("../validators/orgunit.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Only the Head of HR shapes the tree. Reading is wider than writing: HR needs the
// tree to assign coverage, Leadership reports by unit.
//
// ⚠️ An HR officer should also create sub-units inside units they cover. That needs
// the coverage collection, which does not exist yet.
const CAN_MANAGE = ["head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(protect, authorize(...CAN_MANAGE), validateCreateUnit, controller.createUnit)
  .get(protect, authorize(...CAN_READ), controller.listUnits);

// No DELETE, ever: a unit is somebody's appraisal history. Closing one has its own
// route below, being a considered operation with three checks in front of it.
router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), controller.getUnit)
  .put(protect, authorize(...CAN_MANAGE), validateUpdateUnit, controller.updateUnit);

// Head of HR only: an HR officer can move people between units but cannot close one
// out from under them.
router
  .route("/:id/discontinue")
  .put(
    protect,
    authorize(...CAN_MANAGE),
    validateDiscontinueUnit,
    controller.discontinueUnit,
  );

module.exports = router;
