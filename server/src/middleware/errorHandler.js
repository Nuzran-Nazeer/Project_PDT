// ⚠️ `next` is unused but must stay: Express only treats a four-argument function as an
// error handler.
module.exports = (err, req, res, next) => {
  if (err.name === "CastError") {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || { field: "" })[0];
    return res.status(409).json({ error: `${field} already in use` });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join("; ") });
  }

  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || "Internal server error" });
};
