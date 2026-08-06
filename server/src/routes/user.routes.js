const router = require("express").Router();
const controller = require("../controllers/user.controller");
const { validateCreateUser } = require("../validators/user.validator");

router
  .route("/")
  .post(validateCreateUser, controller.createUser)
  .get(controller.listUsers);

router
  .route("/:id")
  .get(controller.getUser)
  .put(controller.updateUser)
  .delete(controller.deleteUser);

module.exports = router;
