const { NEVER_SERVED_FIELDS } = require("../config/constants");

// ⚠️ The last of three layers, and the only one that catches a hand-built object.
// `select: false` stops the field being loaded, the model's toJSON stops it being
// serialised, and this stops a response that assembled one by hand.

const FORBIDDEN = new Set(NEVER_SERVED_FIELDS);

// Depth is bounded rather than trusted: a cyclic or pathological body must not be able
// to hang a response inside a safety check.
const MAX_DEPTH = 8;

const findForbidden = (value, depth = 0) => {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findForbidden(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) return key;
    const hit = findForbidden(nested, depth + 1);
    if (hit) return hit;
  }
  return null;
};

// Runs before the routes so every JSON response passes through it. Thrown from inside
// res.json, which controllers call synchronously, so asyncHandler still catches it.
module.exports = (req, res, next) => {
  const send = res.json.bind(res);

  res.json = (body) => {
    if (!res.locals.identityRevealed) {
      // ⚠️ Scan what will actually be SENT, not the object handed in. A Mongoose
      // document carries the schema's path names as keys in its own bookkeeping, so
      // walking the live object finds "reviewerId" on a document that never loaded it.
      // Serialising first also runs every toJSON transform, so this sees the bytes.
      const leak = findForbidden(JSON.parse(JSON.stringify(body ?? null)));
      if (leak) {
        // A 500 is the correct outcome. A refused response is recoverable; a reviewer
        // named to their reviewee is not.
        const error = new Error(
          `Response carries "${leak}". Serve feedback through feedback.privacy.js, ` +
            `or mark an authorised identity read with withReviewerIdentity(res, ...).`,
        );
        error.statusCode = 500;
        throw error;
      }
    }
    return send(body);
  };

  next();
};
