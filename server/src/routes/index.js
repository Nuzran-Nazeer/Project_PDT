const router = require("express").Router();
const mongoose = require("mongoose");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const constantsRoutes = require("./constants.routes");
const orgUnitRoutes = require("./orgunit.routes");
const unitMembershipRoutes = require("./unitmembership.routes");
const unitLeadRoutes = require("./unitlead.routes");

// Health check: reports live DB connection state (consumed by the frontend).
router.get("/status", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    server: "running",
    database: states[mongoose.connection.readyState],
    dbName: mongoose.connection.name || null,
  });
});

// Feature routers - add new ones here as the PAR system grows.
router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/constants", constantsRoutes);

// "org-units" rather than "units": `unit` is only ONE of the three types this
// collection holds, so /api/units returning companies and sub-units too would read
// as a bug.
router.use("/org-units", orgUnitRoutes);

// The dated collections. They sit beside the tree rather than under it because both
// answer questions about a PERSON as often as about a unit -- "which unit was she in
// last March" is not naturally a sub-resource of a unit.
router.use("/unit-memberships", unitMembershipRoutes);
router.use("/unit-leads", unitLeadRoutes);

module.exports = router;
