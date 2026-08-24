const router = require("express").Router();
const controller = require("../controllers/unitlead.controller");
const {
  validateAppointLead,
  validateClose,
  validateHistoryQuery,
} = require("../validators/orgstructure.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// Same access as membership, and for the same reason -- these two are one job done
// in two records, and splitting who may do them would mean HR could place someone in
// a unit but not say who runs it.
//
// Reading matters more here than it looks: this collection IS the reporting line, so
// a wider read grant would tell anyone holding it who supervises whom across the
// whole company.
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
