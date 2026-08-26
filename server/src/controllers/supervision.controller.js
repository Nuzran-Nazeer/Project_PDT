const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/supervision.service");

// The people this person supervises on a date. Story 17, criterion 1.
//
// Nothing is trimmed for a self read, unlike the reporting line. There the employee
// is granted their supervisor and NOT their skip-level, so the answer has parts they
// may not have. Here the whole answer is about them: these are their own reports.
exports.getTeam = asyncHandler(async (req, res) => {
  const on = req.query.on || new Date();
  res.json(await service.teamOn(req.params.userId, on));
});

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
