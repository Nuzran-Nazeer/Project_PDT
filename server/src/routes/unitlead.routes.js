const router = require("express").Router();
const controller = require("../controllers/unitlead.controller");
const {
  validateAppointLead,
  validateClose,
  validateHistoryQuery,
} = require("../validators/orgstructure.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// ⚠️ This collection is the reporting line: a wider read grant tells anyone who
// supervises whom across the whole company.
const CAN_WRITE = ["hr", "head_of_hr"];
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/")
  .post(protect, authorize(...CAN_WRITE), validateAppointLead, controller.appointLead)
  .get(protect, authorize(...CAN_READ), validateHistoryQuery, controller.listLeads);

router.route("/:id").get(protect, authorize(...CAN_READ), controller.getLead);

router
  .route("/:id/close")
  .put(protect, authorize(...CAN_WRITE), validateClose, controller.closeLead);

module.exports = router;
