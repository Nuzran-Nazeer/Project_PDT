const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/supervision.service");

exports.getReportingLine = asyncHandler(async (req, res) => {
  // No `on` means "as things stand today". The service normalises whatever arrives
  // to UTC midnight, so a bare Date here is the same day HR would have typed.
  const on = req.query.on || new Date();
  const line = await service.reportingLineOn(req.params.userId, on);

  // Criterion 6 lets an employee see their own SUPERVISOR. It does not give them
  // their skip-level, so the answer is trimmed before it leaves the server rather
  // than trusted to stay hidden on a screen. A reader role gets the whole thing.
  //
  // `resolvedUpward` stays: without it a supervisor from a unit they have never
  // heard of looks like a bug rather than a vacant post covered from above.
  if (req.isSelfRead) {
    const { skipLevel: _skipLevel, ...ownView } = line;
    return res.json(ownView);
  }

  res.json(line);
});
