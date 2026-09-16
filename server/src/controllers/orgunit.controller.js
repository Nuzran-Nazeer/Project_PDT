const asyncHandler = require("../utils/asyncHandler");
const orgUnitService = require("../services/orgunit.service");
const { assertMayCreateUnit } = require("../services/coverageAuth.service");

// A single resource comes back plain, a collection as { items, total } (B3).

exports.createUnit = asyncHandler(async (req, res) => {
  await assertMayCreateUnit(req.user, req.body);
  const unit = await orgUnitService.createUnit(req.body);
  res.status(201).json(unit);
});

exports.listUnits = asyncHandler(async (req, res) => {
  res.json(await orgUnitService.listUnits());
});

exports.getUnit = asyncHandler(async (req, res) => {
  res.json(await orgUnitService.getUnitById(req.params.id));
});

exports.updateUnit = asyncHandler(async (req, res) => {
  res.json(await orgUnitService.updateUnit(req.params.id, req.body));
});

// `lastDay` has no default: stamping today onto a closing would invent the fact being recorded.
exports.discontinueUnit = asyncHandler(async (req, res) => {
  res.json(await orgUnitService.discontinueUnit(req.params.id, req.body.lastDay));
});
