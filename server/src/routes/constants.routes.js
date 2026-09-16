const router = require("express").Router();
const controller = require("../controllers/constants.controller");
const { protect } = require("../middleware/auth.middleware");

// No role gate: every screen that offers a designation or a location needs these.
router.get("/", protect, controller.getConstants);

module.exports = router;
