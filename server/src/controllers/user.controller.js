const asyncHandler = require("../utils/asyncHandler");
const userService = require("../services/user.service");

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
exports.deleteUser = asyncHandler(async (req, res) => {
  res.json(await userService.deactivateUser(req.params.id));
});
