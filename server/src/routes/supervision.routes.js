const router = require("express").Router();
const controller = require("../controllers/supervision.controller");
const { validateReportingLineQuery } = require("../validators/orgstructure.validator");
const { protect, authorizeSelfOr } = require("../middleware/auth.middleware");

// This endpoint IS the reporting line, so anyone holding the reader grant can see who
// supervises whom across the whole company. Reading YOUR OWN is open to any signed-in
// employee: the check compares the id in the URL against the id in the token, and it
// lives here rather than in the panel that calls it (build rule 1).
//
// ⚠️ An employee reading their own line does NOT get skipLevel. The client already
// chooses not to show it, but a choice made only on the client is not a rule, so it is
// stripped in the controller.
//
// ⚠️ No coverage check. An HR officer can still ask about anyone at Altrium, not only
// the units they cover. That gate arrives with HR coverage.
const CAN_READ = ["hr", "head_of_hr", "leadership"];

// The same grant as the reporting line below, being the same fact read from the other
// end. Declared before /:userId for readability, not necessity.
router
  .route("/team/:userId")
  .get(
    protect,
    authorizeSelfOr("userId", ...CAN_READ),
    validateReportingLineQuery,
    controller.getTeam,
  );

router
  .route("/:userId")
  .get(
    protect,
    authorizeSelfOr("userId", ...CAN_READ),
    validateReportingLineQuery,
    controller.getReportingLine,
  );

module.exports = router;
