const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Health route: reports live DB connection state
app.get("/api/status", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const state = states[mongoose.connection.readyState]; // 1 = connected
  res.json({
    server: "running",
    database: state,
    dbName: mongoose.connection.name || null,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
