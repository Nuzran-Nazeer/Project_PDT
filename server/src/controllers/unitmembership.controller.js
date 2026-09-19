const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/unitmembership.service");
const audit = require("../services/audit.service");
const {
  assertMayActOnEmployee,
  assertMayReadEmployee,
  readScopeFor,
} = require("../services/coverageAuth.service");

// ⚠️ Coverage is checked here, not in the service: the seed scripts call it with no actor.
// A move needs the officer to cover the person, never the destination.

const mayChange = (req, userId, action) =>
  assertMayActOnEmployee(req.user, userId, new Date(), action, { allowUnplaced: true });

exports.createMembership = asyncHandler(async (req, res) => {
  await mayChange(req, req.body.userId, "place this person in a unit");
  const membership = await service.createMembership(req.body);
  await audit.recordHistoryEdit({
    actor: req.user,
    targetType: "unitMembership",
    record: membership,
    subjectUserId: membership.userId,
    detail: "Placed this person in a unit",
    from: membership.from,
    to: membership.to,
  });
  res.status(201).json(membership);
});

// 201: a move creates the new membership, which is the response.
exports.transferMembership = asyncHandler(async (req, res) => {
  await mayChange(req, req.body.userId, "move this person to another unit");
  const membership = await service.transferMembership(req.body);
  await audit.recordHistoryEdit({
    actor: req.user,
    targetType: "unitMembership",
    record: membership,
    subjectUserId: membership.userId,
    detail: "Moved this person to another unit",
    from: membership.from,
    to: membership.to,
  });
  res.status(201).json(membership);
});

exports.closeMembership = asyncHandler(async (req, res) => {
  const existing = await service.getMembershipById(req.params.id);
  await mayChange(req, existing.userId, "end this person's membership");
  const closed = await service.closeMembership(req.params.id, req.body.to);
  await audit.recordHistoryEdit({
    actor: req.user,
    targetType: "unitMembership",
    record: closed,
    subjectUserId: closed.userId,
    detail: "Ended this person's membership of a unit",
    from: closed.from,
    to: closed.to,
  });
  res.json(closed);
});

// A unit's roster is readable to every reader; one person's history is scoped.
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
