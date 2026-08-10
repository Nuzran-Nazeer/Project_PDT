const asyncHandler = require("../utils/asyncHandler");
const userService = require("../services/user.service");

// Thin HTTP layer: read the request, call the service, shape the response.

exports.createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
});

exports.listUsers = asyncHandler(async (req, res) => {
  const users = await userService.listUsers(req.query);
  res.json(users);
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.json(user);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  res.json(user);
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.params.id);
  res.json({ message: "User deactivated", user });
});
