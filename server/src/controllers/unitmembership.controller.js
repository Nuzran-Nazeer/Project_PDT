const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/unitmembership.service");

// Thin HTTP layer. Response shape per build decision B3: a single record plain, a
// collection as { items, total }.

exports.createMembership = asyncHandler(async (req, res) => {
  const membership = await service.createMembership(req.body);
  res.status(201).json(membership);
});

// A move is two writes -- one record closed, one opened -- so 201 is the honest
// status: something was created, and the response is the new membership.
exports.transferMembership = asyncHandler(async (req, res) => {
  const membership = await service.transferMembership(req.body);
  res.status(201).json(membership);
});

exports.closeMembership = asyncHandler(async (req, res) => {
  res.json(await service.closeMembership(req.params.id, req.body.to));
});

exports.listMemberships = asyncHandler(async (req, res) => {
  const { userId, unitId, on } = req.query;
  res.json(await service.listMemberships({ userId, unitId, on }));
});

exports.getMembership = asyncHandler(async (req, res) => {
  res.json(await service.getMembershipById(req.params.id));
});
