const crypto = require("crypto");
const { INVITE_CODE_BYTES, INVITE_EXPIRY_DAYS } = require("../config/constants");

// The invite code is generated ONCE, shown to HR ONCE, and never stored anywhere.
// What the database keeps is the hash below — so a leaked database yields no usable
// codes, exactly as it yields no usable passwords.
//
// SHA-256 here, bcrypt for passwords, and the reason is the opposite of the password
// reasoning rather than an inconsistency:
//
//   • bcrypt is slow ON PURPOSE, because a human-chosen password is guessable and
//     slowness is what makes guessing expensive. This code is 32 random bytes —
//     guessing it is not an attack anyone can mount, so slowness buys nothing.
//   • bcrypt salts every hash differently, so the same code hashes to a different
//     value each time and CANNOT BE LOOKED UP. Finding the owner would mean loading
//     every invited user and comparing one at a time. SHA-256 is deterministic, so
//     redemption is a single indexed query.
const hashInviteCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

// Returns the raw code (for HR), the hash (for the database) and the expiry.
// The caller stores the last two and must never store the first.
const generateInviteCode = () => {
  const code = crypto.randomBytes(INVITE_CODE_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return { code, hash: hashInviteCode(code), expiresAt };
};

module.exports = { generateInviteCode, hashInviteCode };
