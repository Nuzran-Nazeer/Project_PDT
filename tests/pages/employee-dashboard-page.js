export class EmployeeDashboardPage {
  constructor(page) {
    this.page = page;
    this.heading = page.getByRole("heading", {
      level: 1,
      name: "Employee dashboard",
      exact: true,
    });
  }
}
