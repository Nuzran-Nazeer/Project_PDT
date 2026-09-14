const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/unitlead.service");
const { assertCoversUnit } = require("../services/coverageAuth.service");

// Appointing or ending a lead decides who supervises a unit's people, so the officer must
// cover the unit being led. Checked here: the seed scripts call the service with no actor.

exports.appointLead = asyncHandler(async (req, res) => {
  await assertCoversUnit(req.user, req.body.unitId, new Date(), "appoint its lead");
  const record = await service.appointLead(req.body);
  res.status(201).json(record);
});

exports.closeLead = asyncHandler(async (req, res) => {
  const existing = await service.getLeadById(req.params.id);
  await assertCoversUnit(req.user, existing.unitId, new Date(), "end its lead's term");
  res.json(await service.closeLead(req.params.id, req.body.to));
});

exports.listLeads = asyncHandler(async (req, res) => {
  const { unitId, userId, on } = req.query;
  res.json(await service.listLeads({ unitId, userId, on }));
});

exports.getLead = asyncHandler(async (req, res) => {
  res.json(await service.getLeadById(req.params.id));
});
