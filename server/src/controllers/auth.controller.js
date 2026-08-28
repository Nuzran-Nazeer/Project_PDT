const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/auth.service");
const inviteService = require("../services/invite.service");

exports.login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  res.json({ token, user });
});

// PUBLIC: the invite code is the credential for this one request. Returns NO TOKEN on
// purpose, so `login` stays the single place a session is minted.
exports.activate = asyncHandler(async (req, res) => {
  const user = await inviteService.activateAccount(req.body);
  res.json(user);
});

// Re-read rather than taken from the token, so a role granted today takes effect
// without signing out.
exports.me = asyncHandler(async (req, res) => {
  res.json(await authService.currentSession(req.user.id));
});
