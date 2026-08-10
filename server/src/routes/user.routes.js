const router = require("express").Router();
const controller = require("../controllers/user.controller");
const { validateCreateUser } = require("../validators/user.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

router
  .route("/")
  .post(protect, authorize("admin", "hr"), validateCreateUser, controller.createUser)
  .get(protect, controller.listUsers);

router
  .route("/:id")
  .get(protect, controller.getUser)
  .put(protect, authorize("admin", "hr"), controller.updateUser)
  .delete(protect, authorize("admin"), controller.deleteUser);

module.exports = router;
