// Single place that turns any thrown/next-ed error into an HTTP response.
// Keeps services and controllers free of status-code handling.
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  // Mongoose: malformed ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }

  // Mongoose: unique index violation (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || { field: "" })[0];
    return res.status(409).json({ error: `${field} already in use` });
  }

  // Mongoose: schema validation
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join("; ") });
  }

  const status = err.statusCode || 500;
  if (status >= 500) console.error(err); // log real bugs, not expected 4xx
  res.status(status).json({ error: err.message || "Internal server error" });
};
