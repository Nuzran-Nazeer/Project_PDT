const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/unitlead.service");

exports.appointLead = asyncHandler(async (req, res) => {
  const record = await service.appointLead(req.body);
  res.status(201).json(record);
});

exports.closeLead = asyncHandler(async (req, res) => {
  res.json(await service.closeLead(req.params.id, req.body.to));
});

exports.listLeads = asyncHandler(async (req, res) => {
  const { unitId, userId, on } = req.query;
  res.json(await service.listLeads({ unitId, userId, on }));
});

exports.getLead = asyncHandler(async (req, res) => {
  res.json(await service.getLeadById(req.params.id));
});
