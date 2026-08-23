const router = require("express").Router();
const controller = require("../controllers/user.controller");
const {
  validateCreateUser,
  validateUpdateUser,
} = require("../validators/user.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// HR owns people-data. Admin is a technical account and has no part in it —
// it cannot create, edit or deactivate an employee record.
//
// Reading is wider than writing: Head of HR is the neutral backstop, and Leadership
// needs the roster. HR's own reach is limited to the units they cover, which is a
// SCOPE check inside the service — the role check below is only a coarse gate.
const CAN_MANAGE = ["hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(protect, authorize(...CAN_MANAGE), validateCreateUser, controller.createUser)
  .get(protect, authorize(...CAN_READ), controller.listUsers);

// Generating an invite is an HR action on an employee record, so it sits with the
// records rather than with auth — and behind the same gate as editing one. Redeeming
// it is public and lives in auth.routes.js.
router.post("/:id/invite", protect, authorize(...CAN_MANAGE), controller.createInvite);

router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), controller.getUser)
  .put(protect, authorize(...CAN_MANAGE), validateUpdateUser, controller.updateUser)
  .delete(protect, authorize(...CAN_MANAGE), controller.deleteUser);

module.exports = router;
