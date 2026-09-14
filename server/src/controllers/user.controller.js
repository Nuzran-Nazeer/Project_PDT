const asyncHandler = require("../utils/asyncHandler");
const userService = require("../services/user.service");
const inviteService = require("../services/invite.service");
const {
  assertMayActOnEmployee,
  assertMayReadEmployee,
  readScopeFor,
} = require("../services/coverageAuth.service");

// Response shape (build decision B3): a single resource plain, a collection as
// { items, total }. The HTTP status carries the verdict, never the body.

// ⚠️ Scope is checked HERE, not in user.service: the seed scripts call the service with no
// actor, and a service check that passed without one would be open to any route that
// forgot to supply it.
const mayChange = (req, action) =>
  assertMayActOnEmployee(req.user, req.params.id, new Date(), action, {
    allowUnplaced: true,
  });

exports.createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
});

exports.listUsers = asyncHandler(async (req, res) => {
  const [{ items }, inScope] = await Promise.all([
    userService.listUsers(req.query),
    readScopeFor(req.user),
  ]);
  const visible = items.filter((user) => inScope(user._id));
  res.json({ items: visible, total: visible.length });
});

exports.getUser = asyncHandler(async (req, res) => {
  await assertMayReadEmployee(req.user, req.params.id);
  res.json(await userService.getUserById(req.params.id));
});

exports.updateUser = asyncHandler(async (req, res) => {
  await mayChange(req, "change this person's record");
  res.json(await userService.updateUser(req.params.id, req.body));
});

// ⚠️ The record is SPREAD, not nested under a `user` key, because the client does
// `setPerson(await deactivateUser(id))` and reads `.name` off the result. Nesting is
// tidier and breaks it.
exports.deleteUser = asyncHandler(async (req, res) => {
  await mayChange(req, "record this person as a leaver");
  const { user, warnings } = await userService.deactivateUser(
    req.params.id,
    req.body ? req.body.lastWorkingDay : undefined,
  );
  res.json({ ...user.toJSON(), warnings });
});

// ⚠️ This response is the only place the code is ever readable: the database keeps a
// hash, so re-issuing is the only way back if HR loses it.
exports.createInvite = asyncHandler(async (req, res) => {
  await mayChange(req, "issue this person an invite");
  res.status(201).json(await inviteService.createInvite(req.params.id));
});
