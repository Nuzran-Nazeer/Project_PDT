const asyncHandler = require("../utils/asyncHandler");
const userService = require("../services/user.service");
const inviteService = require("../services/invite.service");

// Response shape (build decision B3): a single resource plain, a collection as
// { items, total }. The HTTP status carries the verdict, never the body.

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

// ⚠️ The record is SPREAD, not nested under a `user` key, because the client does
// `setPerson(await deactivateUser(id))` and reads `.name` off the result. Nesting is
// tidier and breaks it.
exports.deleteUser = asyncHandler(async (req, res) => {
  const { user, warnings } = await userService.deactivateUser(
    req.params.id,
    req.body ? req.body.lastWorkingDay : undefined,
  );
  res.json({ ...user.toJSON(), warnings });
});

// ⚠️ This response is the only place the code is ever readable: the database keeps a
// hash, so re-issuing is the only way back if HR loses it.
exports.createInvite = asyncHandler(async (req, res) => {
  res.status(201).json(await inviteService.createInvite(req.params.id));
});
