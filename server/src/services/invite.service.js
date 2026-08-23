const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { generateInviteCode, hashInviteCode } = require("../utils/inviteCode");

// Both halves of the invite live in ONE file on purpose. Generating a code and
// redeeming one are the same mechanism seen from two sides, and the failure mode of
// splitting them is that the hashing on one side and the lookup on the other drift
// apart — which produces codes that are refused with no error anywhere to explain it.
//
// The two halves sit behind very different doors, though:
//   generate  POST /api/users/:id/invite   protected, HR only
//   redeem    POST /api/auth/activate      PUBLIC — the employee has no account yet,
//                                          so the code IS their credential for it.

// The system sends no email (story 8, criterion 1). HR gets the text and sends it
// from their own mailbox, so the code never passes through a third-party service.
const emailBodyFor = (user, code, expiresAt) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const link = `${clientUrl}/activate?code=${code}`;
  const expiry = expiresAt.toDateString();

  return [
    `Hi ${user.name},`,
    ``,
    `Your Altrium PDT account is ready. Open the link below to set your password:`,
    ``,
    link,
    ``,
    `The link stops working after ${expiry}. If it expires, ask HR for a new one.`,
    ``,
    `Nobody at Altrium knows the password you choose, including HR.`,
  ].join("\n");
};

exports.createInvite = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  // Only an account that has never been opened can be invited. An ACTIVE account
  // asking for a new password is a reset — a different story, and one that needs its
  // own audit trail — and an INACTIVE one belongs to someone who has left.
  if (user.status !== "invited") {
    throw new AppError(
      `Only an account awaiting activation can be invited; this one is ${user.status}`,
      409,
    );
  }

  const { code, hash, expiresAt } = generateInviteCode();

  // Overwriting is also how HR cancels: any code issued earlier hashes to a value
  // that is no longer in the database, so re-issuing kills the previous one.
  user.inviteToken = hash;
  user.inviteExpiresAt = expiresAt;
  await user.save();

  // The one and only moment the raw code exists outside HR's screen.
  return { code, expiresAt, emailBody: emailBodyFor(user, code, expiresAt) };
};

exports.activateAccount = async ({ code, password }) => {
  // Three conditions, and each refuses a different failure:
  //   the hash       — a code that was never issued
  //   status         — an account already activated, or deactivated since
  //   inviteExpiresAt — a code past its date
  //
  // A used code fails on the hash alone, because activation clears the field. The
  // status check is belt and braces: it makes a stale token on a live account unusable.
  //
  // `inviteToken` is select:false, which hides it from RESULTS. Matching on it in a
  // query is unaffected.
  const user = await User.findOne({
    inviteToken: hashInviteCode(code),
    status: "invited",
    inviteExpiresAt: { $gt: new Date() },
  });

  // ONE message for "no such code", "already used" and "expired" — the same reasoning
  // as the login failure message. Distinct messages would let a stranger sit outside
  // the login wall and learn which codes exist.
  if (!user) {
    throw new AppError(
      "This invite code is not valid, has already been used, or has expired",
      400,
    );
  }

  // Criterion 2: the invite sets a PASSWORD and nothing else. Note what is NOT here —
  // no Object.assign, no spread of the request body. Anything else the caller sent is
  // ignored rather than filtered, so a field added to the model later cannot become
  // editable through this public endpoint by accident.
  user.password = password;
  user.status = "active";

  // Single use. Clearing the hash is what makes a second attempt with the same code
  // fail, so it is not tidying — it is the criterion.
  user.inviteToken = undefined;
  user.inviteExpiresAt = undefined;

  // save(), never findByIdAndUpdate: the pre('save') hook is what hashes the password.
  await user.save();

  return user;
};
