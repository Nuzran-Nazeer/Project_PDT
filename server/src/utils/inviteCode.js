const crypto = require("crypto");
const { INVITE_CODE_BYTES, INVITE_EXPIRY_DAYS } = require("../config/constants");

// SHA-256 rather than bcrypt: 32 random bytes are not guessable, so slowness buys nothing,
// and bcrypt's per-hash salt would make the code impossible to look up.
const hashInviteCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

// The caller stores the hash and the expiry and must never store the code.
const generateInviteCode = () => {
  const code = crypto.randomBytes(INVITE_CODE_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return { code, hash: hashInviteCode(code), expiresAt };
};

module.exports = { generateInviteCode, hashInviteCode };
