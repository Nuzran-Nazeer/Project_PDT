const router = require("express").Router();
const mongoose = require("mongoose");
const userRoutes = require("./user.routes");

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

module.exports = router;
