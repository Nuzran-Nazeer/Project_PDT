const router = require("express").Router();
const controller = require("../controllers/orgunit.controller");
const {
  validateCreateUnit,
  validateUpdateUnit,
} = require("../validators/orgunit.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Only the HEAD OF HR shapes the tree (story 9, criterion 1). An HR officer gets to
// create sub-units too, but only inside a unit they already cover — and that check
// cannot be written yet, because coverage assigns officers to units and the units
// have to exist first. It arrives as criterion 6 of "Limit access to each user's own
// people", together with the scope check that makes it mean anything.
//
// Reading is wider than writing, mirroring the employee roster: HR needs the tree to
// assign coverage, Head of HR is the backstop, Leadership reports by unit.
const CAN_MANAGE = ["head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(protect, authorize(...CAN_MANAGE), validateCreateUnit, controller.createUnit)
  .get(protect, authorize(...CAN_READ), controller.listUnits);

// No DELETE. Closing a unit is not specified — what happens to its members, its
// children and its lead are all open — and a soft delete invented here would look
// perfectly reasonable and be wrong.
router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), controller.getUnit)
  .put(protect, authorize(...CAN_MANAGE), validateUpdateUnit, controller.updateUnit);

module.exports = router;
