const asyncHandler = require("../utils/asyncHandler");
const audit = require("../services/audit.service");

exports.list = asyncHandler(async (req, res) => {
  res.json(await audit.list(req.user, req.query));
});
