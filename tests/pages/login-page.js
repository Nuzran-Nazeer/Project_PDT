export class LoginPage {
  constructor(page) {
    this.page = page;
    this.identifierInput = page.locator("#identifier");
    this.passwordInput = page.locator("#password");
    this.signInButton = page.getByRole("button", { name: "Sign in" });
    this.errorMessage = page.getByRole("alert");
  }

  async goto() {
    await this.page.goto("/login");
  }

  async signIn(identifier, password) {
    await this.identifierInput.fill(identifier);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }
}
