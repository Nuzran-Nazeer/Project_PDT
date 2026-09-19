const router = require("express").Router();
const controller = require("../controllers/audit.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

// ⚠️ The role gate is the coarse one. The service refuses again, so a route added later
// without it cannot open the trail by accident.
router.route("/").get(protect, authorize("head_of_hr"), controller.list);

module.exports = router;
