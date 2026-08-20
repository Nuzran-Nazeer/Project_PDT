const router = require("express").Router();
const controller = require("../controllers/constants.controller");
const { protect } = require("../middleware/auth.middleware");

// Authenticated, but no role gate: these lists are org vocabulary, not appraisal
// data, and every screen that offers a designation or a location needs them.
router.get("/", protect, controller.getConstants);

module.exports = router;
