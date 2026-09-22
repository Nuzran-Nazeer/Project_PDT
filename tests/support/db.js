import { MongoClient } from "mongodb";
import { qaDatabaseUri } from "../playwright.config.js";

// The one way a test reaches past the server, and it should stay the only one.
//
// ⚠️ A test comes here when the behaviour it is about depends on state no endpoint can
// produce — an invite that expired, a date already in the past — and never to save itself
// an API call. Arranging through the database what the app could have arranged proves
// nothing about the app: the record ends up in a shape the app would never have written.
//
// The connection string comes from the config, so there is no argument to point this at
// the wrong database with.

// The suite owns ALT-9xxx. The seed is ALT-1xxx, ALT-2xxx and ALT-3xxx and is read-only.
const SUITE_OWNED = /^ALT-9\d{3}$/;

async function inQaDatabase(run) {
  const client = new MongoClient(qaDatabaseUri());
  try {
    await client.connect();
    return await run(client.db());
  } finally {
    await client.close();
  }
}

function assertOwned(employeeId) {
  if (!SUITE_OWNED.test(employeeId)) {
    throw new Error(
      `${employeeId} is not a record this suite owns. Editing a seeded person behind the server's back is never allowed.`,
    );
  }
}

// Moves an outstanding invite's expiry into the past.
//
// ⚠️ Codes last seven days and nothing can shorten that from outside: `createInvite`
// computes the expiry itself and no endpoint accepts one. Waiting is not an option and a
// code that never existed is a different case, so the date is written directly.
export async function expireOutstandingInvite(employeeId) {
  assertOwned(employeeId);

  return inQaDatabase(async (db) => {
    const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await db
      .collection("users")
      .updateOne(
        { employeeId, status: "invited", inviteToken: { $ne: null } },
        { $set: { inviteExpiresAt: expiredAt } },
      );

    if (result.matchedCount !== 1) {
      throw new Error(`${employeeId} has no outstanding invite to expire.`);
    }
    return expiredAt;
  });
}
