const router = require("express").Router();
const mongoose = require("mongoose");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const constantsRoutes = require("./constants.routes");
const orgUnitRoutes = require("./orgunit.routes");
const unitMembershipRoutes = require("./unitmembership.routes");
const unitLeadRoutes = require("./unitlead.routes");
const supervisionRoutes = require("./supervision.routes");

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

// Derived, not stored. Nothing is written here: this reads the two collections above
// and answers "who supervises whom on this date". It sits at the top level rather
// than under /users because the answer is about a RELATIONSHIP, not a property of the
// user record -- putting it at /users/:id/supervisor would imply a field that the
// data model specifically forbids.
router.use("/supervision", supervisionRoutes);

module.exports = router;
