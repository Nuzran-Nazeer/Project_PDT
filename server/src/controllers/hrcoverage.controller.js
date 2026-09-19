const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/hrcoverage.service");
const audit = require("../services/audit.service");
const { coveredUnitIds } = require("../services/coverageAuth.service");

// A guide rail for the screens: every write still runs its own coverage check.
exports.getMyCoverage = asyncHandler(async (req, res) => {
  if ((req.user.roles || []).includes("head_of_hr")) {
    return res.json({ all: true, unitIds: [] });
  }
  res.json({ all: false, unitIds: [...(await coveredUnitIds(req.user))] });
});

exports.assignCoverage = asyncHandler(async (req, res) => {
  const record = await service.assignCoverage(req.body);
  await audit.recordHistoryEdit({
    actor: req.user,
    targetType: "hrCoverage",
    record,
    subjectUserId: record.userId,
    detail: `Assigned this officer as ${record.role} coverage of a unit`,
    from: record.from,
    to: record.to,
  });
  res.status(201).json(record);
});

exports.closeCoverage = asyncHandler(async (req, res) => {
  const closed = await service.closeCoverage(req.params.id, req.body.to);
  await audit.recordHistoryEdit({
    actor: req.user,
    targetType: "hrCoverage",
    record: closed,
    subjectUserId: closed.userId,
    detail: "Ended this officer's coverage of a unit",
    from: closed.from,
    to: closed.to,
  });
  res.json(closed);
});

exports.listCoverage = asyncHandler(async (req, res) => {
  const { unitId, userId, role, on } = req.query;
  res.json(await service.listCoverage({ unitId, userId, role, on }));
});

exports.getCoverage = asyncHandler(async (req, res) => {
  res.json(await service.getCoverageById(req.params.id));
});

exports.getEffectiveCoverage = asyncHandler(async (req, res) => {
  const on = req.query.on || new Date();
  res.json(await service.coverageOn(req.params.unitId, on));
});
