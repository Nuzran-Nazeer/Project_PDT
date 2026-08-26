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

// HR runs the cycle, and Head of HR is the backstop -- the same pair that writes
// membership and leadership, for the same reason: this is administering the process,
// not shaping the company.
//
// Leadership READS but does not write. They are shown how the company is doing; they do
// not open or cancel the cycle it is measured in.
//
// ⚠️ Still a COARSE gate, like every other route here. HR is meant to reach only the
// units they cover, and that check needs the coverage collection, which does not exist.
// A cycle covers a whole appraisal group rather than a unit, so this is less wrong here
// than elsewhere, but it is the same gap.
const CAN_WRITE = ["hr", "head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

// The cycle the signed-in person's own group is in.
//
// OPEN TO ANY SIGNED-IN USER, and declared first so `current` is never read as an id.
// It takes no parameters at all: the group comes off their own record, so there is no
// version of this that asks about anybody else. Everyone needs it -- it is what the
// dashboard reports on -- and it carries a period and a stage, nothing about a person.
router.route("/current").get(protect, controller.getMyCurrentCycle);

router
  .route("/")
  .post(protect, authorize(...CAN_WRITE), validateCreateCycle, controller.createCycle)
  .get(protect, authorize(...CAN_READ), validateCycleQuery, controller.listCycles);

router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), validateCycleId, controller.getCycle);

// Moving a cycle on is its own route rather than a field on an update, because it is
// not an edit: it is a transition with rules, and only one destination is ever legal.
// A general PATCH would invite a client to set `status` to anything.
router
  .route("/:id/advance")
  .put(protect, authorize(...CAN_WRITE), validateAdvanceCycle, controller.advanceCycle);

router
  .route("/:id/cancel")
  .put(protect, authorize(...CAN_WRITE), validateCancelCycle, controller.cancelCycle);

// NO DELETE, AT ANY STAGE, and this comment is the reason there is not one. A published
// cycle is somebody's appraisal record and the evidence that the process was followed;
// deleting one destroys the thing an appeal would be defended with. Cancelling is a
// status, never a removal. (Spec §5.4, LOCKED)

module.exports = router;
