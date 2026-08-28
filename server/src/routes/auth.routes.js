const router = require("express").Router();
const controller = require("../controllers/auth.controller");
const { validateActivate } = require("../validators/invite.validator");
const { protect } = require("../middleware/auth.middleware");

router.post("/login", controller.login);

// ⚠️ PUBLIC on purpose: the employee redeeming an invite cannot sign in yet, so
// `protect` here makes it unreachable by the only people who need it. The code is the
// credential, which is why it is single-use and expiring.
router.post("/activate", validateActivate, controller.activate);

// Takes no id, reading it out of the token, so it only answers about the caller.
router.get("/me", protect, controller.me);

module.exports = router;
