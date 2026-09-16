const router = require("express").Router();
const controller = require("../controllers/user.controller");
const {
  validateCreateUser,
  validateUpdateUser,
} = require("../validators/user.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Admin is a technical account with no part in people data.
// Coarse role gates only; HR coverage is checked in the controller and service.
const CAN_MANAGE = ["hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(protect, authorize(...CAN_MANAGE), validateCreateUser, controller.createUser)
  .get(protect, authorize(...CAN_READ), controller.listUsers);

// Redeeming is public and lives in auth.routes.js.
router.post("/:id/invite", protect, authorize(...CAN_MANAGE), controller.createInvite);

router
  .route("/:id")
  .get(protect, authorize(...CAN_READ), controller.getUser)
  .put(protect, authorize(...CAN_MANAGE), validateUpdateUser, controller.updateUser)
  .delete(protect, authorize(...CAN_MANAGE), controller.deleteUser);

module.exports = router;
