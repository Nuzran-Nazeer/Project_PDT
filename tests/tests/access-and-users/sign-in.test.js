import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/login-page.js";
import { DashboardPage } from "../../pages/dashboard-page.js";
import { PASSWORD, SEEDED, UNKNOWN_EMAIL } from "../../support/accounts.js";
import { DEACTIVATED, ensureDeactivatedAccount } from "../../support/api.js";

// ⚠️ One message for a wrong password, an unknown address, an account not yet activated and
// a deactivated one. Four cases below turn on it, so it is written once: reword it in the
// server and they fail together rather than one of them going quiet.
const GENERIC_ERROR = "Invalid credentials";

const onLoginPage = /\/login$/;

test.describe("PDT-8 Log in", () => {
  test("Login with valid email", async ({ page }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await login.goto();
    await login.signIn(SEEDED.employee.email, PASSWORD);

    await expect(dashboard.heading(SEEDED.employee.dashboard)).toBeVisible();
  });

  test("Login with valid username", async ({ page }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await login.goto();
    // The generated username, not the address: the same field accepts either.
    await login.signIn(SEEDED.employee.username, PASSWORD);

    await expect(dashboard.heading(SEEDED.employee.dashboard)).toBeVisible();
  });

  test("Session token issued after login", async ({ page }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await login.goto();
    await login.signIn(SEEDED.employee.email, PASSWORD);
    await expect(dashboard.heading(SEEDED.employee.dashboard)).toBeVisible();

    // ⚠️ sessionStorage, not localStorage: the token is meant to die with the tab.
    const token = await page.evaluate(() => sessionStorage.getItem("pdt-token"));

    expect(token, "no session token was stored").toBeTruthy();
    // header.payload.signature — a JWT, not just any string the client kept.
    expect(token.split("."), `stored token is not a JWT: ${token}`).toHaveLength(3);
  });

  test("Generic error does not reveal account existence", async ({ page }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.signIn(SEEDED.employee.email, "not-the-right-password");
    await expect(login.errorMessage).toHaveText(GENERIC_ERROR);
    const forRegistered = await login.errorMessage.textContent();

    await login.goto();
    await login.signIn(UNKNOWN_EMAIL, PASSWORD);
    await expect(login.errorMessage).toHaveText(GENERIC_ERROR);
    const forUnregistered = await login.errorMessage.textContent();

    // The case itself: the two refusals have to be indistinguishable, or the form answers
    // "does this person work here" to anyone who asks.
    expect(forUnregistered).toBe(forRegistered);
  });

  test("Login with a not yet activated account", async ({ page }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.signIn(SEEDED.invited.email, PASSWORD);

    await expect(login.errorMessage).toHaveText(GENERIC_ERROR);
    await expect(page).toHaveURL(onLoginPage);
  });

  test("Login with a deactivated account", async ({ page, request }) => {
    const login = new LoginPage(page);

    // The seed has no leaver, so the suite provides one. It knows the right password:
    // the refusal has to come from the account's state and nothing else.
    await ensureDeactivatedAccount(request);

    await login.goto();
    await login.signIn(DEACTIVATED.email, PASSWORD);

    await expect(login.errorMessage).toHaveText(GENERIC_ERROR);
    await expect(page).toHaveURL(onLoginPage);
  });

  test("Logout ends the session", async ({ page }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await login.goto();
    await login.signIn(SEEDED.employee.email, PASSWORD);
    await expect(dashboard.heading(SEEDED.employee.dashboard)).toBeVisible();

    await dashboard.signOut();
    await expect(page).toHaveURL(onLoginPage);

    // ⚠️ The part worth testing: being sent to the login page is not the same as the old
    // session being over. Ask for a protected address again and it must still be refused.
    await dashboard.goto();
    await expect(page).toHaveURL(onLoginPage);
    await expect(dashboard.heading(SEEDED.employee.dashboard)).toBeHidden();
  });

  test("Login opens the highest-role dashboard", async ({ page }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    // This account holds head_of_hr, hr and employee, and leads a unit besides. Only the
    // first of those decides where it lands.
    await login.goto();
    await login.signIn(SEEDED.headOfHr.email, PASSWORD);

    await expect(dashboard.heading(SEEDED.headOfHr.dashboard)).toBeVisible();
    await expect(dashboard.heading(SEEDED.employee.dashboard)).toBeHidden();
  });
});
