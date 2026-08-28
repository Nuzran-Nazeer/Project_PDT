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

// HR runs the cycle and Head of HR is the backstop: administering the process, not
// shaping the company. Leadership reads but does not write.
//
// ⚠️ Still a coarse gate, like every route here. HR is meant to reach only the units
// they cover, and that check needs the coverage collection, which does not exist.
const CAN_WRITE = ["hr", "head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

// Open to any signed-in user, and declared first so `current` is never read as an id.
// It takes no parameters: the group comes off their own record, so there is no version
// of this that asks about anybody else.
router.route("/current").get(protect, controller.getMyCurrentCycle);

router
  .route("/")
  .post(protect, authorize(...CAN_WRITE), validateCreateCycle, controller.createCycle)
  .get(protect, authorize(...CAN_READ), validateCycleQuery, controller.listCycles);

router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), validateCycleId, controller.getCycle);

// Who the cycle covers, on the reader gate.
//
// ⚠️ The coarse-gate caveat bites harder here: a LIST OF PEOPLE is exactly what the
// scope rule exists to limit. Revisit this route first when HR coverage lands.
router
  .route("/:id/people")
  .get(protect, authorize(...CAN_READ), validateCycleId, controller.getCyclePeople);

// Its own route rather than a field on an update: a transition with rules, where only
// one destination is legal. A general PATCH would invite a client to set `status` to
// anything.
router
  .route("/:id/advance")
  .put(protect, authorize(...CAN_WRITE), validateAdvanceCycle, controller.advanceCycle);

router
  .route("/:id/cancel")
  .put(protect, authorize(...CAN_WRITE), validateCancelCycle, controller.cancelCycle);

// NO DELETE, at any stage. A published cycle is somebody's appraisal record and the
// evidence the process was followed, so deleting one destroys what an appeal would be
// defended with. Cancelling is a status, never a removal. (Spec §5.4, LOCKED)

module.exports = router;
