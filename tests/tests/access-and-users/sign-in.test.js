import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/login-page.js";
import { EmployeeDashboardPage } from "../../pages/employee-dashboard-page.js";

test.describe("Sign in", () => {
  test("Sign in and reach the starting page", async ({ page }) => {
    const login = new LoginPage(page);
    const employeeDashboard = new EmployeeDashboardPage(page);

    await login.goto();
    await login.signIn("employee@altrium.test", process.env.DEMO_PASSWORD);

    await expect(employeeDashboard.heading).toBeVisible();
  });
});
