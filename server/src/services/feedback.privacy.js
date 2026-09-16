const {
  CONFIDENTIAL_REVIEWER_TYPES,
  IDENTIFYING_FIELDS,
} = require("../config/constants");

// ⚠️ The one place feedback is prepared for somebody who did not write it. No route
// deletes a field of its own: copied logic works until one endpoint forgets.

const isConfidential = (type) => CONFIDENTIAL_REVIEWER_TYPES.includes(type);

const plain = (doc) => (typeof doc?.toJSON === "function" ? doc.toJSON() : { ...doc });

// Confidential types lose the reviewer, every timestamp and the record's own id: an
// ObjectId encodes the time it was created. The random label is the only handle served.
const forConsumer = (doc) => {
  const record = plain(doc);

  if (!isConfidential(record.reviewerType)) {
    return record;
  }

  for (const field of IDENTIFYING_FIELDS) delete record[field];

  // A record with no label has not been through reviewer selection.
  record.id = record.label || null;
  delete record._id;
  delete record.label;

  return record;
};

const forConsumerList = (docs = []) => docs.map(forConsumer);

// ⚠️ The single authorised exception. The guard refuses any body carrying an identifying
// field without this mark, so an endpoint that skips it fails loudly instead of leaking.
const withReviewerIdentity = (res, payload) => {
  res.locals.identityRevealed = true;
  return payload;
};

module.exports = { forConsumer, forConsumerList, withReviewerIdentity, isConfidential };
