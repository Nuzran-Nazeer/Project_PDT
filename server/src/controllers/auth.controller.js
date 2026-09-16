const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/auth.service");
const inviteService = require("../services/invite.service");

exports.login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  res.json({ token, user });
});

// Public. Returns no token on purpose: `login` is the one place a session is minted.
exports.activate = asyncHandler(async (req, res) => {
  const user = await inviteService.activateAccount(req.body);
  res.json(user);
});

// Re-read, so a role granted today takes effect without signing out.
exports.me = asyncHandler(async (req, res) => {
  res.json(await authService.currentSession(req.user.id));
});
