const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/auth.service");

exports.register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.register(req.body);
  res.status(201).json({ token, user });
});

exports.login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  res.json({ token, user });
});
