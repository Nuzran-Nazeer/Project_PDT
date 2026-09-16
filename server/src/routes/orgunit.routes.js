const router = require("express").Router();
const controller = require("../controllers/orgunit.controller");
const {
  validateCreateUnit,
  validateUpdateUnit,
  validateDiscontinueUnit,
} = require("../validators/orgunit.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// An HR officer may create a sub-unit inside a unit they cover, which the controller checks.
const CAN_MANAGE = ["head_of_hr"];
const CAN_CREATE = ["hr", "head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(protect, authorize(...CAN_CREATE), validateCreateUnit, controller.createUnit)
  .get(protect, authorize(...CAN_READ), controller.listUnits);

// No DELETE, ever: a unit is somebody's appraisal history.
router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), controller.getUnit)
  .put(protect, authorize(...CAN_MANAGE), validateUpdateUnit, controller.updateUnit);

router
  .route("/:id/discontinue")
  .put(
    protect,
    authorize(...CAN_MANAGE),
    validateDiscontinueUnit,
    controller.discontinueUnit,
  );

module.exports = router;
