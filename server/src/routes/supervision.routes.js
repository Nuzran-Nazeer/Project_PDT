const router = require("express").Router();
const controller = require("../controllers/supervision.controller");
const {
  validateReportingLineQuery,
} = require("../validators/orgstructure.validator");
const { protect, authorize } = require("../middleware/auth.middleware");

// The same read grant as /api/unit-leads, and for the same reason stated there: this
// endpoint IS the reporting line, so anyone holding it can see who supervises whom
// across the whole company. Widening it is not a small change.
//
// ⚠️ NOT SPECIFIED: whether an employee may ask who their own supervisor is. No
// criterion in this story covers it, so the grant is deliberately no wider than the
// collection it reads. It needs deciding for the employee dashboard, where an
// employee plainly does need to see their own supervisor's name.
//
// ⚠️ NO SCOPE CHECK. An HR officer holding this can ask about anyone at Altrium, not
// only the units they cover. That gate arrives with Limit access to each user's own
// people; until then every role check in this codebase is a coarse gate.
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/:userId")
  .get(
    protect,
    authorize(...CAN_READ),
    validateReportingLineQuery,
    controller.getReportingLine,
  );

module.exports = router;
