const router = require("express").Router();
const controller = require("../controllers/auth.controller");
const { validateActivate } = require("../validators/invite.validator");

router.post("/login", controller.login);

// PUBLIC, and it has to be: the employee is redeeming an invite precisely because
// they cannot sign in yet. `protect` here would make the endpoint unreachable by the
// only people who need it. The code itself is the credential, and it is single-use
// and expiring for that reason.
router.post("/activate", validateActivate, controller.activate);

module.exports = router;
