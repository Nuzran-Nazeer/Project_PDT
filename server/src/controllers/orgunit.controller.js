const asyncHandler = require("../utils/asyncHandler");
const orgUnitService = require("../services/orgunit.service");

// Thin HTTP layer: read the request, call the service, shape the response.
//
// Response shape (build decision B3): a single resource comes back plain, a
// collection comes back as { items, total }. The HTTP status carries the verdict —
// the body never says whether the request succeeded.

exports.createUnit = asyncHandler(async (req, res) => {
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
