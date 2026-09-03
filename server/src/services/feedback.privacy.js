const {
  CONFIDENTIAL_REVIEWER_TYPES,
  IDENTIFYING_FIELDS,
} = require("../config/constants");

// ⚠️ THE ONE PLACE FEEDBACK IS PREPARED FOR SOMEBODY WHO DID NOT WRITE IT. No route
// deletes a field of its own: copied logic works until the sixth endpoint forgets, and
// there is no error when it does. The response simply carries a name it should not.

const isConfidential = (type) => CONFIDENTIAL_REVIEWER_TYPES.includes(type);

const plain = (doc) => (typeof doc?.toJSON === "function" ? doc.toJSON() : { ...doc });

/**
 * Prepare one record for a reviewee or their supervisor.
 *
 * Confidential types lose the reviewer, every timestamp, and the record's own id: a
 * consumer has no action to take on somebody else's feedback, so the random label is
 * the only handle they need, and an ObjectId encodes the time it was created.
 *
 * Attributed types keep their author, because feedback an employee cannot attribute is
 * feedback they cannot follow up.
 */
const forConsumer = (doc) => {
  const record = plain(doc);

  if (!isConfidential(record.reviewerType)) {
    return record;
  }

  for (const field of IDENTIFYING_FIELDS) delete record[field];

  // A record with no label has not been through reviewer selection, so nothing can
  // vouch that its position carries no information. Refusing is the safe answer.
  record.id = record.label || null;
  delete record._id;
  delete record.label;

  return record;
};

const forConsumerList = (docs = []) => docs.map(forConsumer);

/**
 * The single authorised exception: HR and the Head of HR hold reviewer identities and
 * see submission times, because they are the identity holder and the process owner.
 *
 * ⚠️ Marking the response is not optional. The guard refuses any body carrying an
 * identifying field without it, so an endpoint that skips this fails loudly instead of
 * leaking quietly. Every call is an identity reveal and is logged as one.
 */
const withReviewerIdentity = (res, payload) => {
  res.locals.identityRevealed = true;
  return payload;
};

module.exports = { forConsumer, forConsumerList, withReviewerIdentity, isConfidential };
