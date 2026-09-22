import { API_URL } from "../playwright.config.js";
import { PASSWORD } from "./accounts.js";

// Puts a signed-in session into the browser without driving the login form.
//
// ⚠️ Signing in is PDT-8's subject. Everywhere else it is a precondition, and a story that
// fails because the login page moved is a story reporting on the wrong thing.
export async function signInAs(page, request, identifier, password = PASSWORD) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { identifier, password },
  });

  if (!res.ok()) {
    throw new Error(
      `Could not sign in as ${identifier}: ${res.status()} ${await res.text()}`,
    );
  }

  const { token, user } = await res.json();

  // ⚠️ addInitScript rather than an evaluate after loading: the app reads its session as it
  // starts, so one written afterwards is one it has already decided is absent. And
  // sessionStorage rather than Playwright's storageState, because that carries localStorage
  // only — this app deliberately keeps the token where it dies with the tab.
  await page.addInitScript(
    ([storedToken, storedUser]) => {
      sessionStorage.setItem("pdt-token", storedToken);
      sessionStorage.setItem("pdt-user", storedUser);
    },
    [token, JSON.stringify(user)],
  );

  return user;
}
