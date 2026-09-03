const router = require("express").Router();
const mongoose = require("mongoose");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const constantsRoutes = require("./constants.routes");
const orgUnitRoutes = require("./orgunit.routes");
const unitMembershipRoutes = require("./unitmembership.routes");
const unitLeadRoutes = require("./unitlead.routes");
const supervisionRoutes = require("./supervision.routes");
const cycleRoutes = require("./cycle.routes");
const feedbackRoutes = require("./feedback.routes");

// Health check: reports live DB connection state (consumed by the frontend).
router.get("/status", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    server: "running",
    database: states[mongoose.connection.readyState],
    dbName: mongoose.connection.name || null,
  });
});

router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/constants", constantsRoutes);

// "org-units", not "units": `unit` is one of three types this collection holds.
router.use("/org-units", orgUnitRoutes);

// Beside the tree rather than under it: these answer questions about a PERSON as
// often as about a unit.
router.use("/unit-memberships", unitMembershipRoutes);
router.use("/unit-leads", unitLeadRoutes);

// Read-only and derived from the two collections above. Top level, not
// /users/:id/supervisor, which would imply a field the data model forbids.
router.use("/supervision", supervisionRoutes);

// Top level: a cycle covers an appraisal GROUP, so it is nobody's sub-resource.
router.use("/cycles", cycleRoutes);

// Top level, and not under /reviews: the half a reviewer uses is addressed by THEIR
// assignment, not by the review it belongs to.
router.use("/feedback", feedbackRoutes);

module.exports = router;
