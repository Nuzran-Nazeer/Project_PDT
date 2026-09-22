import { API_URL } from "../playwright.config.js";
import { PASSWORD } from "./accounts.js";

// Arranging state, never the thing under test. A test drives the browser for the behaviour
// its case is about and comes here for everything that merely has to be true first.

// ⚠️ Reserved for records the suite owns. The seed uses ALT-1xxx, ALT-2xxx and ALT-3xxx, so
// nothing here can collide with a seeded person.
const OWNED_ID_PREFIX = "ALT-9";

export async function apiSignIn(request, identifier, password = PASSWORD) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { identifier, password },
  });

  if (!res.ok()) {
    throw new Error(`Could not sign in as ${identifier}: ${res.status()} ${await res.text()}`);
  }

  return (await res.json()).token;
}

// The Head of HR, never an officer: coverage checks pass for them whatever unit a person is
// in, or is not in, so provisioning never fails for a reason the test is not about.
async function asHeadOfHr(request) {
  const token = await apiSignIn(request, "headhr@altrium.test");
  return { Authorization: `Bearer ${token}` };
}

// The account the "deactivated account cannot sign in" case needs.
//
// ⚠️ The qa seed holds no inactive user and must not be edited to hold one, so the suite
// brings its own. Provisioned on first use and reused for ever after: re-running the suite
// must not leave a new leaver behind every time.
export const DEACTIVATED = {
  employeeId: `${OWNED_ID_PREFIX}001`,
  name: "QA Deactivated",
  email: "qa.deactivated@altrium.test",
};

async function findOwnedUser(request, headers, email) {
  // A leaver is filtered out of the default list, so both states have to be asked for.
  for (const status of ["inactive", "active"]) {
    const res = await request.get(`${API_URL}/users?status=${status}`, { headers });
    if (!res.ok()) continue;

    const { items } = await res.json();
    const found = items.find((user) => user.email === email);
    if (found) return found;
  }
  return null;
}

export async function ensureDeactivatedAccount(request) {
  const headers = await asHeadOfHr(request);

  const created = await request.post(`${API_URL}/users`, {
    headers,
    data: {
      ...DEACTIVATED,
      // Supplying one is what makes the account active rather than awaiting an invite:
      // the case needs an account that could have signed in and now cannot.
      password: PASSWORD,
      joinedDate: "2020-01-06",
      designation: "Software Engineer",
      location: "Colombo",
    },
  });

  let user;
  if (created.ok()) {
    user = await created.json();
  } else if (created.status() === 409) {
    // Left behind by an earlier run, in whichever state that run reached.
    user = await findOwnedUser(request, headers, DEACTIVATED.email);
  } else {
    throw new Error(
      `Could not create ${DEACTIVATED.email}: ${created.status()} ${await created.text()}`,
    );
  }

  if (!user) throw new Error(`${DEACTIVATED.email} exists but could not be read back.`);

  // Unconditional, so the account is left deactivated however it was found.
  const updated = await request.put(`${API_URL}/users/${user._id}`, {
    headers,
    data: { status: "inactive" },
  });

  if (!updated.ok()) {
    throw new Error(
      `Could not deactivate ${DEACTIVATED.email}: ${updated.status()} ${await updated.text()}`,
    );
  }

  return DEACTIVATED;
}
