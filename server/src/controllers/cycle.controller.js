const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/cycle.service");
const User = require("../models/user.model");

exports.createCycle = asyncHandler(async (req, res) => {
  const cycle = await service.createCycle(req.body);
  res.status(201).json(cycle);
});

exports.listCycles = asyncHandler(async (req, res) => {
  res.json(await service.listCycles(req.query));
});

exports.getCycle = asyncHandler(async (req, res) => {
  res.json(await service.getCycleById(req.params.id));
});

// Who this cycle covers. Derived on the way out -- see the service.
//
// Behind the same reader gate as the rest of the collection, NOT open to everybody the
// way /current is. /current answers a question about the person asking; this answers a
// question about everybody else, which is the line the comment below draws.
exports.getCyclePeople = asyncHandler(async (req, res) => {
  res.json(await service.peopleInCycle(req.params.id));
});

// Criterion 8, and the question every dashboard asks on load.
//
// IT TAKES NO GROUP. The appraisal group comes off the signed-in person's own record,
// so there is no version of this call that asks about somebody else's group. That keeps
// it open to any signed-in user without widening what they can see: a cycle is a period
// and a stage, but the endpoint that answers "and who else is in it" is a later story
// and should not be reachable through this one by adding a parameter.
//
// Null is a real answer. For most of the year a group is between cycles.
exports.getMyCurrentCycle = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("parGroup");
  const cycle = await service.currentCycleFor(user?.parGroup);

  res.json({
    parGroup: user?.parGroup || null,
    cycle,
  });
});

// The user id comes from the TOKEN, never from the body. Who opened a cycle and who
// cancelled it are audit facts, and an audit fact a client can name is not one.
exports.advanceCycle = asyncHandler(async (req, res) => {
  res.json(await service.advanceCycle(req.params.id, req.body.status, req.user.id));
});

exports.cancelCycle = asyncHandler(async (req, res) => {
  res.json(await service.cancelCycle(req.params.id, req.body.reason, req.user.id));
});
