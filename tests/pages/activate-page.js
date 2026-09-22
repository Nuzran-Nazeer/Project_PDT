// The invite link carries the code as a query parameter. ⚠️ 64 hex characters: the server's
// 32 random bytes, written out. Matching the shape is how a test tells a real code from a
// page that rendered something else where the link should be.
export const INVITE_LINK_PATTERN = /\/activate\?code=([0-9a-f]{64})\b/i;

export class ActivatePage {
  constructor(page) {
    this.page = page;
    this.codeInput = page.locator("#code");
    this.passwordInput = page.locator("#password");
    this.confirmPasswordInput = page.locator("#confirmPassword");
    this.submitButton = page.getByRole("button", { name: "Set password and continue" });
    this.errorMessage = page.getByRole("alert");

    // Shown instead of the form once the server has refused the code itself, so a retry
    // cannot help.
    this.deadLinkAdvice = page.getByText(/Ask HR to send a new invite/);
    this.signInLink = page.getByRole("link", { name: "Go to sign in" });

    // ⚠️ Every field the form offers, for asserting what it does not offer. The story's
    // claim is that an invite changes a password and nothing else about the person.
    this.formFields = page.locator("form input");
  }

  async gotoWithCode(code) {
    await this.page.goto(`/activate?code=${code}`);
  }

  async setPassword(password) {
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.submitButton.click();
  }
}
