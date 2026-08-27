const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/supervision.service");

// Nothing is trimmed for a self read, unlike the reporting line: the whole answer is
// about the caller.
exports.getTeam = asyncHandler(async (req, res) => {
  const on = req.query.on || new Date();
  res.json(await service.teamOn(req.params.userId, on));
});

exports.getReportingLine = asyncHandler(async (req, res) => {
  // No `on` means today. The service normalises to UTC midnight.
  const on = req.query.on || new Date();
  const line = await service.reportingLineOn(req.params.userId, on);

  // ⚠️ An employee gets their supervisor but NOT their skip-level, trimmed here
  // rather than trusted to stay hidden on a screen. `resolvedUpward` stays, or a
  // supervisor from an unfamiliar unit looks like a bug.
  if (req.isSelfRead) {
    const { skipLevel: _skipLevel, ...ownView } = line;
    return res.json(ownView);
  }

  res.json(line);
});
