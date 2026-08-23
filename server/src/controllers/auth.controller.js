const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/auth.service");
const inviteService = require("../services/invite.service");

exports.login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  res.json({ token, user });
});

// PUBLIC. The new joiner has no account to sign in with, so the invite code is their
// credential for this one request.
//
// It returns the user and NO TOKEN, on purpose: `login` stays the single place in the
// system where a session is minted, which keeps one door to audit rather than two.
// The client sends them to the sign-in screen with the password they just chose.
exports.activate = asyncHandler(async (req, res) => {
  const user = await inviteService.activateAccount(req.body);
  res.json(user);
});
