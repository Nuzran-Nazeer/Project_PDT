// Catch-all for unmatched routes -> consistent JSON 404 (not Express's HTML page).
module.exports = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
};
