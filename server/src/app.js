const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const routes = require("./routes");
const identityGuard = require("./middleware/identityGuard");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ⚠️ Vercel runs this file, not index.js: its builder needs an entry that requires express.
if (process.env.VERCEL) connectDB();

// One address, never a comma-separated list: CLIENT_URL also builds the invite link.
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

// ⚠️ Before the routes, so every JSON response is checked on its way out.
app.use(identityGuard);

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
