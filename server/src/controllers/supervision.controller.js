const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/supervision.service");

exports.getReportingLine = asyncHandler(async (req, res) => {
  // No `on` means "as things stand today". The service normalises whatever arrives
  // to UTC midnight, so a bare Date here is the same day HR would have typed.
  const on = req.query.on || new Date();
  res.json(await service.reportingLineOn(req.params.userId, on));
});
