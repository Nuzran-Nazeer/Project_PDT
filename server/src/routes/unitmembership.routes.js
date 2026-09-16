const router = require("express").Router();
const controller = require("../controllers/unitmembership.controller");
const {
  validateCreateMembership,
  validateTransfer,
  validateClose,
  validateHistoryQuery,
} = require("../validators/orgstructure.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Coarse role gates only; HR coverage is checked in the controller and service.
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

router
  .route("/transfer")
  .post(
    protect,
    authorize(...CAN_WRITE),
    validateTransfer,
    controller.transferMembership,
  );

// No DELETE anywhere: a membership is evidence an appraisal was built on.
router.route("/:id").get(protect, authorize(...CAN_READ), controller.getMembership);

router
  .route("/:id/close")
  .put(protect, authorize(...CAN_WRITE), validateClose, controller.closeMembership);

module.exports = router;
