const express = require("express");
const cors = require("cors");

const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());

// All API routes live under /api
app.use("/api", routes);

// 404 + centralized error handling (must be registered last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
