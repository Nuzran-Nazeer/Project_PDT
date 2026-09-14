const express = require("express");
const cors = require("cors");

const routes = require("./routes");
const identityGuard = require("./middleware/identityGuard");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Global middleware
// One address, never a comma-separated list: CLIENT_URL also builds the invite link.
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

// ⚠️ Before the routes, so every JSON response is checked on its way out. Refuses any
// body naming a reviewer unless the route marked it an authorised identity read.
app.use(identityGuard);

// All API routes live under /api
app.use("/api", routes);

// 404 + centralized error handling (must be registered last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
