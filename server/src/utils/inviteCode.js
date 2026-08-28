const crypto = require("crypto");
const { INVITE_CODE_BYTES, INVITE_EXPIRY_DAYS } = require("../config/constants");

// The invite code is generated once, shown to HR once, and never stored. The database
// keeps only the hash, so a leaked database yields no usable codes.
//
// SHA-256 here rather than bcrypt, which is not an inconsistency with passwords.
// bcrypt is slow on purpose, because a human-chosen password is guessable; a code of
// 32 random bytes is not, so slowness buys nothing. bcrypt also salts every hash
// differently, so the same code would hash differently each time and could not be
// looked up. SHA-256 is deterministic, making redemption a single indexed query.
const hashInviteCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

// Returns the raw code (for HR), the hash (for the database) and the expiry. The
// caller stores the last two and must never store the first.
const generateInviteCode = () => {
  const code = crypto.randomBytes(INVITE_CODE_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return { code, hash: hashInviteCode(code), expiresAt };
};

module.exports = { generateInviteCode, hashInviteCode };
