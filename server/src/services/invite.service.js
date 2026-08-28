const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { generateInviteCode, hashInviteCode } = require("../utils/inviteCode");

// Generating and redeeming live in ONE file so the hashing and the lookup cannot
// drift apart, which would produce codes refused with no error to explain it.
//
//   generate  POST /api/users/:id/invite   protected, HR only
//   redeem    POST /api/auth/activate      PUBLIC, the code being the credential

// The system sends no email: HR sends it from their own mailbox, so the code never
// passes through a third-party service.
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

  // Only an unopened account can be invited: an active one wanting a new password is
  // a reset, and an inactive one belongs to someone who has left.
  if (user.status !== "invited") {
    throw new AppError(
      `Only an account awaiting activation can be invited; this one is ${user.status}`,
      409,
    );
  }

  const { code, hash, expiresAt } = generateInviteCode();

  // Re-issuing kills the previous code, which is also how HR cancels one.
  user.inviteToken = hash;
  user.inviteExpiresAt = expiresAt;
  await user.save();

  return { code, expiresAt, emailBody: emailBodyFor(user, code, expiresAt) };
};

exports.activateAccount = async ({ code, password }) => {
  // `inviteToken` is select:false, which hides it from RESULTS only. Matching on it
  // in a query is unaffected.
  const user = await User.findOne({
    inviteToken: hashInviteCode(code),
    status: "invited",
    inviteExpiresAt: { $gt: new Date() },
  });

  // ⚠️ ONE message for "no such code", "already used" and "expired". Distinct ones
  // would let a stranger outside the login wall learn which codes exist.
  if (!user) {
    throw new AppError(
      "This invite code is not valid, has already been used, or has expired",
      400,
    );
  }

  // ⚠️ No Object.assign and no spread of the request body: anything else sent is
  // ignored rather than filtered, so a field added to the model later cannot become
  // editable through this PUBLIC endpoint by accident.
  user.password = password;
  user.status = "active";

  // Clearing the hash is what makes a second attempt fail. Not tidying.
  user.inviteToken = undefined;
  user.inviteExpiresAt = undefined;

  // save(), never findByIdAndUpdate: the pre('save') hook is what hashes the password.
  await user.save();

  return user;
};
