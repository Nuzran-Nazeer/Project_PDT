import { test, expect } from "@playwright/test";
import { API_URL } from "../../playwright.config.js";
import { ActivatePage } from "../../pages/activate-page.js";
import { EmployeeDetailPage } from "../../pages/employee-detail-page.js";
import { LoginPage } from "../../pages/login-page.js";
import { DashboardPage } from "../../pages/dashboard-page.js";
import { SEEDED } from "../../support/accounts.js";
import { INVITEE, ensureInvitee, issueInvite, readUser } from "../../support/api.js";
import { expireOutstandingInvite } from "../../support/db.js";
import { signInAs } from "../../support/session.js";

// ⚠️ One message for a code that was never issued, one already used and one past its
// expiry. Two cases below turn on it, and the point of both is that they are told apart
// by nothing the page shows.
const INVITE_REFUSED =
  "This invite code is not valid, has already been used, or has expired";

// Deliberately not the shared demo password: the last case proves the account opens with
// the password activation set, which is only worth asserting if it is a different one.
const CHOSEN_PASSWORD = "qa-invite-pw-2026";

test.describe("PDT-9 Activate account with invite", () => {
  test("Generate one-time invite code", async ({ page, request }) => {
    const invitee = await ensureInvitee(request);
    await signInAs(page, request, SEEDED.hr.email);

    const employee = new EmployeeDetailPage(page);
    await employee.goto(invitee._id);
    await expect(employee.statusBadge("Awaiting activation")).toBeVisible();

    await employee.generateInvite();

    await expect(employee.issuedNotice).toBeVisible();
    const code = await employee.issuedCode();
    expect(code, "the issued link carries no 64-character code").toMatch(
      /^[0-9a-f]{64}$/,
    );

    // ⚠️ One-time in two senses, and this is the half the page is answerable for: coming
    // back must not show the code again, because the record kept only a hash of it.
    await employee.goto(invitee._id);
    await expect(employee.inviteLink).toBeHidden();
    await expect(employee.generateInviteButton).toBeVisible();
  });

  test("Invite allows password change only", async ({ page, request }) => {
    const invitee = await ensureInvitee(request);
    const { code } = await issueInvite(request, invitee._id);
    const before = await readUser(request, invitee._id);

    // What the page offers: a password, twice, and nothing else about the person. The code
    // came in on the link, so the form does not ask for that either.
    const activate = new ActivatePage(page);
    await activate.gotoWithCode(code);
    await expect(activate.passwordInput).toBeVisible();
    await expect(activate.confirmPasswordInput).toBeVisible();
    await expect(activate.formFields).toHaveCount(2);

    // ⚠️ The half that matters. Activation is a public endpoint, so the real question is
    // not what the form draws but what the server accepts from anyone who sends more.
    const res = await request.post(`${API_URL}/auth/activate`, {
      data: {
        code,
        password: CHOSEN_PASSWORD,
        name: "Renamed During Activation",
        email: "somewhere.else@altrium.test",
        roles: ["admin"],
        designation: "CEO",
      },
    });
    expect(res.ok(), `activation was refused: ${await res.text()}`).toBeTruthy();

    const after = await readUser(request, invitee._id);
    expect(after.name).toBe(before.name);
    expect(after.email).toBe(before.email);
    expect(after.roles).toEqual(before.roles);
    expect(after.designation).toBe(before.designation);

    // The two things activation is allowed to change, so the case cannot pass by the
    // request having been ignored wholesale.
    expect(after.status).toBe("active");
    expect(before.status).toBe("invited");
  });

  test("Reject reused invite code", async ({ page, request }) => {
    const invitee = await ensureInvitee(request);
    const { code } = await issueInvite(request, invitee._id);

    const activate = new ActivatePage(page);
    await activate.gotoWithCode(code);
    await activate.setPassword(CHOSEN_PASSWORD);
    await expect(page).toHaveURL(/\/login$/);

    // The same link a second time.
    await activate.gotoWithCode(code);
    await activate.setPassword(CHOSEN_PASSWORD);

    await expect(activate.errorMessage).toHaveText(INVITE_REFUSED);
    await expect(activate.deadLinkAdvice).toBeVisible();
    await expect(activate.passwordInput).toBeHidden();
  });

  test("Reject expired invite code", async ({ page, request }) => {
    const invitee = await ensureInvitee(request);
    const { code } = await issueInvite(request, invitee._id);

    // Seven days cannot be waited out and no endpoint sets an expiry, so this one is
    // written to the record directly. See support/db.js.
    await expireOutstandingInvite(INVITEE.employeeId);

    const activate = new ActivatePage(page);
    await activate.gotoWithCode(code);
    await activate.setPassword(CHOSEN_PASSWORD);

    // ⚠️ Word for word what a used code and an invented one get. An expired code that
    // announced itself as expired would confirm the account exists.
    await expect(activate.errorMessage).toHaveText(INVITE_REFUSED);
    await expect(activate.deadLinkAdvice).toBeVisible();

    // Refused, not half-applied: the account is still waiting for a working invite.
    expect((await readUser(request, invitee._id)).status).toBe("invited");
  });

  test("Account becomes active after activation", async ({ page, request }) => {
    const invitee = await ensureInvitee(request);
    expect((await readUser(request, invitee._id)).status).toBe("invited");

    const { code } = await issueInvite(request, invitee._id);

    const activate = new ActivatePage(page);
    await activate.gotoWithCode(code);
    await activate.setPassword(CHOSEN_PASSWORD);

    // Activation mints no session of its own: it hands the employee to the sign-in page.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("status")).toHaveText(
      "Your account is ready. Sign in with your new password.",
    );

    expect((await readUser(request, invitee._id)).status).toBe("active");

    // The status is the system's claim about the account; signing in is the proof of it.
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);
    await login.signIn(INVITEE.email, CHOSEN_PASSWORD);
    await expect(dashboard.heading(SEEDED.employee.dashboard)).toBeVisible();
  });
});
