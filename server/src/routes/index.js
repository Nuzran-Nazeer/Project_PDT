const router = require("express").Router();
const mongoose = require("mongoose");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const constantsRoutes = require("./constants.routes");
const orgUnitRoutes = require("./orgunit.routes");
const unitMembershipRoutes = require("./unitmembership.routes");
const unitLeadRoutes = require("./unitlead.routes");
const hrCoverageRoutes = require("./hrcoverage.routes");
const projectRoutes = require("./project.routes");
const projectAssignmentRoutes = require("./projectassignment.routes");
const supervisionRoutes = require("./supervision.routes");
const cycleRoutes = require("./cycle.routes");
const feedbackRoutes = require("./feedback.routes");
const reviewRoutes = require("./review.routes");
const reviewerListRoutes = require("./reviewerList.routes");
const auditRoutes = require("./audit.routes");
const monitoringRoutes = require("./monitoring.routes");

// A cold start is still connecting on its first request; wait for it rather than report it,
// but no longer than Mongoose buffers a query. `asPromise` returns at once when nothing is connecting.
const CONNECT_WAIT_MS = 10000;

router.get("/status", async (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  if (mongoose.connection.readyState === 2) {
    await Promise.race([
      mongoose.connection.asPromise().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, CONNECT_WAIT_MS)),
    ]);
  }
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
router.use("/unit-memberships", unitMembershipRoutes);
router.use("/unit-leads", unitLeadRoutes);
router.use("/hr-coverage", hrCoverageRoutes);
router.use("/projects", projectRoutes);
router.use("/project-assignments", projectAssignmentRoutes);

// Top level, not /users/:id/supervisor: that would imply a field the data model forbids.
router.use("/supervision", supervisionRoutes);
router.use("/cycles", cycleRoutes);
router.use("/reviews", reviewRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/reviewer-lists", reviewerListRoutes);
router.use("/audit", auditRoutes);
router.use("/monitoring", monitoringRoutes);

module.exports = router;
