const { NEVER_SERVED_FIELDS } = require("../config/constants");

// ⚠️ The last of three layers, and the only one that catches a hand-built object.

const FORBIDDEN = new Set(NEVER_SERVED_FIELDS);

// Bounded so a pathological body cannot hang a response inside a safety check.
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

// Thrown from inside res.json, which controllers call synchronously, so asyncHandler catches it.
module.exports = (req, res, next) => {
  const send = res.json.bind(res);

  res.json = (body) => {
    if (!res.locals.identityRevealed) {
      // ⚠️ Scan the bytes, not the object: a Mongoose document carries every schema path
      // as a key in its bookkeeping, loaded or not.
      const leak = findForbidden(JSON.parse(JSON.stringify(body ?? null)));
      if (leak) {
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
