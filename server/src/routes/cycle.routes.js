const router = require("express").Router();
const controller = require("../controllers/cycle.controller");
const {
  validateCreateCycle,
  validateAdvanceCycle,
  validateCancelCycle,
  validateCycleId,
  validateCycleQuery,
} = require("../validators/cycle.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Coarse role gates only; HR coverage is checked in the controller and service.
const CAN_WRITE = ["hr", "head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

// Declared first so `current` is never read as an id. Answers only about the caller.
router.route("/current").get(protect, controller.getMyCurrentCycle);

router
  .route("/")
  .post(protect, authorize(...CAN_WRITE), validateCreateCycle, controller.createCycle)
  .get(protect, authorize(...CAN_READ), validateCycleQuery, controller.listCycles);

router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), validateCycleId, controller.getCycle);

router
  .route("/:id/people")
  .get(protect, authorize(...CAN_READ), validateCycleId, controller.getCyclePeople);

// Its own route: a general PATCH would invite a client to set `status` to anything.
router
  .route("/:id/advance")
  .put(protect, authorize(...CAN_WRITE), validateAdvanceCycle, controller.advanceCycle);

router
  .route("/:id/cancel")
  .put(protect, authorize(...CAN_WRITE), validateCancelCycle, controller.cancelCycle);

// No DELETE at any stage: a published cycle is somebody's appraisal record.

module.exports = router;
