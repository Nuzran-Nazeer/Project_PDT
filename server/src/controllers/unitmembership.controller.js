const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/unitmembership.service");
const {
  assertMayActOnEmployee,
  assertMayReadEmployee,
  readScopeFor,
} = require("../services/coverageAuth.service");

// Thin HTTP layer. Response shape per build decision B3: a single record plain, a
// collection as { items, total }.
//
// ⚠️ Scope is checked here rather than in the service, which the seed scripts call with no
// actor. A move needs the officer to cover the PERSON, never the destination: it hands
// them to the receiving unit's officer.

const mayChange = (req, userId, action) =>
  assertMayActOnEmployee(req.user, userId, new Date(), action, { allowUnplaced: true });

exports.createMembership = asyncHandler(async (req, res) => {
  await mayChange(req, req.body.userId, "place this person in a unit");
  const membership = await service.createMembership(req.body);
  res.status(201).json(membership);
});

// A move is two writes -- one record closed, one opened -- so 201 is the honest
// status: something was created, and the response is the new membership.
exports.transferMembership = asyncHandler(async (req, res) => {
  await mayChange(req, req.body.userId, "move this person to another unit");
  const membership = await service.transferMembership(req.body);
  res.status(201).json(membership);
});

exports.closeMembership = asyncHandler(async (req, res) => {
  const existing = await service.getMembershipById(req.params.id);
  await mayChange(req, existing.userId, "end this person's membership");
  res.json(await service.closeMembership(req.params.id, req.body.to));
});

// A unit's roster stays readable to every reader: it is the org structure, and HR needs it
// to appoint leads. One person's history, or the whole collection, is scoped.
exports.listMemberships = asyncHandler(async (req, res) => {
  const { userId, unitId, on } = req.query;
  if (userId) await assertMayReadEmployee(req.user, userId);

  const result = await service.listMemberships({ userId, unitId, on });
  if (userId || unitId) return res.json(result);

  const inScope = await readScopeFor(req.user);
  const items = result.items.filter((m) => inScope(m.userId?._id || m.userId));
  res.json({ items, total: items.length });
});

exports.getMembership = asyncHandler(async (req, res) => {
  const membership = await service.getMembershipById(req.params.id);
  await assertMayReadEmployee(req.user, membership.userId);
  res.json(membership);
});
