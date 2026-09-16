const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/supervision.service");
const { assertMayReadEmployee } = require("../services/coverageAuth.service");

const assertMayAsk = (req) =>
  String(req.params.userId) === String(req.user.id)
    ? Promise.resolve()
    : assertMayReadEmployee(req.user, req.params.userId);

exports.getTeam = asyncHandler(async (req, res) => {
  await assertMayAsk(req);
  const on = req.query.on || new Date();
  res.json(await service.teamOn(req.params.userId, on));
});

exports.getReportingLine = asyncHandler(async (req, res) => {
  await assertMayAsk(req);
  const on = req.query.on || new Date();
  const line = await service.reportingLineOn(req.params.userId, on);

  // ⚠️ An employee never gets their skip-level, trimmed here rather than only on a screen.
  if (req.isSelfRead) {
    const { skipLevel: _skipLevel, ...ownView } = line;
    return res.json(ownView);
  }

  res.json(line);
});
