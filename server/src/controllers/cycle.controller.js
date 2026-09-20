const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/cycle.service");
const User = require("../models/user.model");
const { readScopeFor } = require("../services/coverageAuth.service");

exports.createCycle = asyncHandler(async (req, res) => {
  const cycle = await service.createCycle(req.body);
  res.status(201).json(cycle);
});

exports.listCycles = asyncHandler(async (req, res) => {
  res.json(await service.listCycles(req.query, await readScopeFor(req.user)));
});

exports.getCycle = asyncHandler(async (req, res) => {
  res.json(await service.getCycleById(req.params.id));
});

exports.getCyclePeople = asyncHandler(async (req, res) => {
  const [result, inScope] = await Promise.all([
    service.peopleInCycle(req.params.id),
    readScopeFor(req.user),
  ]);
  const items = result.items.filter((person) => inScope(person._id));
  res.json({
    ...result,
    items,
    total: items.length,
    appraised: items.filter((p) => p.appraised).length,
  });
});

// ⚠️ Takes no group: it comes off the caller's own record. Never add a parameter.
exports.getMyCurrentCycle = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("parGroup");
  const cycle = await service.currentCycleFor(user?.parGroup);

  res.json({
    parGroup: user?.parGroup || null,
    cycle,
  });
});

// The user id comes from the token, never the body: who opened or cancelled is an audit fact.
exports.advanceCycle = asyncHandler(async (req, res) => {
  res.json(
    await service.advanceCycle(req.params.id, req.body.status, req.user, {
      acknowledged: req.body.acknowledged === true,
    }),
  );
});

exports.cancelCycle = asyncHandler(async (req, res) => {
  res.json(await service.cancelCycle(req.params.id, req.body.reason, req.user.id));
});
