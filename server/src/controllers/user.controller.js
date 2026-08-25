const asyncHandler = require("../utils/asyncHandler");
const userService = require("../services/user.service");
const inviteService = require("../services/invite.service");

// Thin HTTP layer: read the request, call the service, shape the response.
//
// Response shape (build decision B3): a single resource comes back plain, a
// collection comes back as { items, total }. The HTTP status carries the verdict —
// the body never says whether the request succeeded.

exports.createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
});

exports.listUsers = asyncHandler(async (req, res) => {
  res.json(await userService.listUsers(req.query));
});

exports.getUser = asyncHandler(async (req, res) => {
  res.json(await userService.getUserById(req.params.id));
});

exports.updateUser = asyncHandler(async (req, res) => {
  res.json(await userService.updateUser(req.params.id, req.body));
});

// Soft delete. Returns the updated record rather than a message, so the client can
// re-render without a second request.
//
// The record is SPREAD rather than nested under a `user` key, and `warnings` sits
// alongside it. Nesting would have been tidier and would have broken the merged
// client, which does `setPerson(await deactivateUser(id))` and reads `.name` off the
// result. Additive keeps that working while the new field waits for the client half.
//
// `lastWorkingDay` is optional and defaults to today inside the service, so the
// existing client -- which sends no body at all -- keeps behaving exactly as before.
exports.deleteUser = asyncHandler(async (req, res) => {
  const { user, warnings } = await userService.deactivateUser(
    req.params.id,
    req.body ? req.body.lastWorkingDay : undefined,
  );
  res.json({ ...user.toJSON(), warnings });
});

// Returns the raw code and a ready-to-send email body. This response is the ONLY
// place the code is ever readable — the database keeps a hash — so HR gets one look
// at it and re-issuing is the only way back if they lose it.
exports.createInvite = asyncHandler(async (req, res) => {
  res.status(201).json(await inviteService.createInvite(req.params.id));
});
