const router = require("express").Router();
const controller = require("../controllers/supervision.controller");
const { validateReportingLineQuery } = require("../validators/orgstructure.validator");
const { protect, authorizeSelfOr } = require("../middleware/auth.middleware");

// Reading somebody ELSE's line is the same grant as /api/unit-leads, and for the same
// reason stated there: this endpoint IS the reporting line, so anyone holding it can
// see who supervises whom across the whole company.
//
// Reading YOUR OWN is open to any signed-in employee. That is criterion 6, added after
// the server half was merged, and it settles what this file previously flagged as
// unspecified: the rule is "your own, and only your own". The check compares the id in
// the URL against the id in the token, so it cannot be widened from the client -- and
// per the client-hides-server-enforces rule it lives HERE, not in the panel that calls it.
//
// ⚠️ An employee reading their own line does NOT get skipLevel. Criterion 6 grants them
// their supervisor and nothing further, and the client already chooses not to show it --
// but a choice made only on the client is not a rule. Stripped in the controller.
//
// ⚠️ NO COVERAGE CHECK. An HR officer holding this can still ask about anyone at
// Altrium, not only the units they cover. That gate arrives with Limit access to each
// user's own people; the role check remains a coarse one.
const CAN_READ = ["hr", "head_of_hr", "leadership"];

router
  .route("/:userId")
  .get(
    protect,
    authorizeSelfOr("userId", ...CAN_READ),
    validateReportingLineQuery,
    controller.getReportingLine,
  );

module.exports = router;
