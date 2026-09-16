const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { generateInviteCode, hashInviteCode } = require("../utils/inviteCode");

// Generating and redeeming live in one file so the hashing and the lookup cannot drift apart.

// The system sends no email: HR sends this from their own mailbox.
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

  if (user.status !== "invited") {
    throw new AppError(
      `Only an account awaiting activation can be invited; this one is ${user.status}`,
      409,
    );
  }

  const { code, hash, expiresAt } = generateInviteCode();

  // Re-issuing replaces the previous code, which is also how HR cancels one.
  user.inviteToken = hash;
  user.inviteExpiresAt = expiresAt;
  await user.save();

  return { code, expiresAt, emailBody: emailBodyFor(user, code, expiresAt) };
};

exports.activateAccount = async ({ code, password }) => {
  // `select: false` hides `inviteToken` from results only; matching on it works.
  const user = await User.findOne({
    inviteToken: hashInviteCode(code),
    status: "invited",
    inviteExpiresAt: { $gt: new Date() },
  });

  // ⚠️ One message for "no such code", "already used" and "expired": this endpoint is public.
  if (!user) {
    throw new AppError(
      "This invite code is not valid, has already been used, or has expired",
      400,
    );
  }

  // ⚠️ Never spread the request body here: this endpoint is public.
  user.password = password;
  user.status = "active";

  // Clearing the hash is what makes a second attempt fail.
  user.inviteToken = undefined;
  user.inviteExpiresAt = undefined;

  // ⚠️ save(), never findByIdAndUpdate: the pre('save') hook is what hashes the password.
  await user.save();

  return user;
};
