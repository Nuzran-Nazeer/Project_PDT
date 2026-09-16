const router = require("express").Router();
const controller = require("../controllers/auth.controller");
const { validateActivate } = require("../validators/invite.validator");
const { protect } = require("../middleware/auth.middleware");

router.post("/login", controller.login);

// ⚠️ Public on purpose: the employee redeeming an invite cannot sign in yet.
router.post("/activate", validateActivate, controller.activate);

router.get("/me", protect, controller.me);

module.exports = router;
