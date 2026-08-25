const router = require("express").Router();
const controller = require("../controllers/unitmembership.controller");
const {
  validateCreateMembership,
  validateTransfer,
  validateClose,
  validateHistoryQuery,
} = require("../validators/orgstructure.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// "As HR, I want membership and leadership stored with dates" -- so HR writes, and
// Head of HR writes as the backstop. Wider than the unit tree, which is Head of HR
// only: shaping the company is rarer and more consequential than placing one person
// in a unit.
//
// ⚠️ Still a COARSE gate. HR is supposed to reach only the units they cover, and that
// check needs the coverage collection, which does not exist yet. Today any HR officer
// can move anyone. This is the same gap that sits on every other route in the
// codebase and it closes with "Limit access to each user's own people".
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

// A move is its own route rather than a flag on create, because it does two things
// and one of them is destructive-looking: it writes an end date onto an existing
// record. Someone reading the route list should be able to see that happening.
router
  .route("/transfer")
  .post(
    protect,
    authorize(...CAN_WRITE),
    validateTransfer,
    controller.transferMembership,
  );

// No DELETE anywhere in this collection. The entire point of dating these records is
// that history survives; a delete route would hand someone a way to erase the
// evidence an appraisal was built on.
router.route("/:id").get(protect, authorize(...CAN_READ), controller.getMembership);

router
  .route("/:id/close")
  .put(protect, authorize(...CAN_WRITE), validateClose, controller.closeMembership);

module.exports = router;
