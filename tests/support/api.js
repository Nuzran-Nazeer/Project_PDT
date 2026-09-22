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
  // ⚠️ Every status, asked for one at a time. The default list leaves out a leaver, and
  // an account that is only invited is in neither of the states you would think to ask for
  // first — leave one out and an account that plainly exists reads as missing.
  for (const status of ["invited", "active", "inactive"]) {
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

// The account the invite cases work on.
//
// ⚠️ Activation is one way and a code is good once, so this story cannot reuse an account
// the way the sign-in story does — each case needs one waiting to be activated. Rather than
// leaving a new person in qa on every run, one account is kept and put back to `invited`
// before each case that needs it.
export const INVITEE = {
  employeeId: `${OWNED_ID_PREFIX}002`,
  name: "QA Invitee",
  email: "qa.invitee@altrium.test",
};

// Returns the account in the state an invite story starts from: created, never activated.
export async function ensureInvitee(request) {
  const headers = await asHeadOfHr(request);

  const created = await request.post(`${API_URL}/users`, {
    headers,
    data: {
      ...INVITEE,
      // ⚠️ No password on purpose. That is what leaves the account `invited` and waiting
      // for a code, which is the whole premise of the story.
      joinedDate: "2021-03-08",
      designation: "QA Engineer",
      location: "Colombo",
    },
  });

  if (created.ok()) return created.json();

  if (created.status() !== 409) {
    throw new Error(
      `Could not create ${INVITEE.email}: ${created.status()} ${await created.text()}`,
    );
  }

  // Left activated by an earlier run. Putting the status back is enough: issuing an invite
  // replaces any code still outstanding, and activating overwrites whatever password the
  // earlier run set.
  const existing = await findOwnedUser(request, headers, INVITEE.email);
  if (!existing) throw new Error(`${INVITEE.email} exists but could not be read back.`);

  const reset = await request.put(`${API_URL}/users/${existing._id}`, {
    headers,
    data: { status: "invited" },
  });

  if (!reset.ok()) {
    throw new Error(
      `Could not return ${INVITEE.email} to invited: ${reset.status()} ${await reset.text()}`,
    );
  }

  return reset.json();
}

// ⚠️ The response is the only place the raw code ever exists; the database keeps a hash.
export async function issueInvite(request, userId) {
  const headers = await asHeadOfHr(request);

  const res = await request.post(`${API_URL}/users/${userId}/invite`, { headers });
  if (!res.ok()) {
    throw new Error(`Could not issue an invite: ${res.status()} ${await res.text()}`);
  }

  return res.json();
}

export async function readUser(request, userId) {
  const headers = await asHeadOfHr(request);

  const res = await request.get(`${API_URL}/users/${userId}`, { headers });
  if (!res.ok()) {
    throw new Error(`Could not read ${userId}: ${res.status()} ${await res.text()}`);
  }

  return res.json();
}
