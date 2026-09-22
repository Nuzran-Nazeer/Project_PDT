// One object for every role's dashboard. They are the same page: the title is what says
// which role the system decided the signed-in user lands as, so it is a parameter and not
// a page object each.
export class DashboardPage {
  constructor(page) {
    this.page = page;
    this.signOutButton = page.getByRole("button", { name: "Sign out" });
  }

  heading(title) {
    return this.page.getByRole("heading", { level: 1, name: title, exact: true });
  }

  async goto() {
    await this.page.goto("/dashboard");
  }

  async signOut() {
    await this.signOutButton.click();
  }
}
