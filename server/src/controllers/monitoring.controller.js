const asyncHandler = require("../utils/asyncHandler");
const monitoring = require("../services/monitoring.service");

exports.list = asyncHandler(async (req, res) => {
  res.json(await monitoring.list(req.user, req.query));
});

exports.markReviewed = asyncHandler(async (req, res) => {
  res.json(await monitoring.markReviewed(req.user, req.params.id, req.body?.note));
});
