import { INVITE_LINK_PATTERN } from "./activate-page.js";

export class EmployeeDetailPage {
  constructor(page) {
    this.page = page;
    this.name = page.getByRole("heading", { level: 1 });

    // Either label: the button offers a first invite or a replacement depending on whether
    // one is already outstanding, and both issue a code.
    this.generateInviteButton = page.getByRole("button", {
      name: /^Generate (invite link|a new link)$/,
    });

    // ⚠️ The one place the raw code is ever readable. The record keeps only a hash, so if
    // this is missed it cannot be recovered — which is also what makes it assertable.
    //
    // The paragraph, not any element holding the link: the ready-to-send email below it
    // quotes the same link, and the panel is the thing that issued it.
    this.inviteLink = page
      .getByRole("paragraph")
      .filter({ hasText: INVITE_LINK_PATTERN });
    this.issuedNotice = page.getByRole("status");
  }

  async goto(userId) {
    await this.page.goto(`/employees/${userId}`);
  }

  statusBadge(label) {
    return this.page.getByText(label, { exact: true });
  }

  async generateInvite() {
    await this.generateInviteButton.click();
  }

  // The code out of the link, for handing to the activation page.
  async issuedCode() {
    const link = await this.inviteLink.textContent();
    return link?.match(INVITE_LINK_PATTERN)?.[1] ?? null;
  }
}
