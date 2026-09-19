const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/unitlead.service");
const audit = require("../services/audit.service");
const { assertCoversUnit } = require("../services/coverageAuth.service");

// ⚠️ Coverage is checked here, not in the service: the seed scripts call it with no actor.

exports.appointLead = asyncHandler(async (req, res) => {
  await assertCoversUnit(req.user, req.body.unitId, new Date(), "appoint its lead");
  const record = await service.appointLead(req.body);
  await audit.recordHistoryEdit({
    actor: req.user,
    targetType: "unitLead",
    record,
    subjectUserId: record.userId,
    detail: "Appointed this person to lead a unit",
    from: record.from,
    to: record.to,
  });
  res.status(201).json(record);
});

exports.closeLead = asyncHandler(async (req, res) => {
  const existing = await service.getLeadById(req.params.id);
  await assertCoversUnit(req.user, existing.unitId, new Date(), "end its lead's term");
  const closed = await service.closeLead(req.params.id, req.body.to);
  await audit.recordHistoryEdit({
    actor: req.user,
    targetType: "unitLead",
    record: closed,
    subjectUserId: closed.userId,
    detail: "Ended this person's term leading a unit",
    from: closed.from,
    to: closed.to,
  });
  res.json(closed);
});

exports.listLeads = asyncHandler(async (req, res) => {
  const { unitId, userId, on } = req.query;
  res.json(await service.listLeads({ unitId, userId, on }));
});

exports.getLead = asyncHandler(async (req, res) => {
  res.json(await service.getLeadById(req.params.id));
});
