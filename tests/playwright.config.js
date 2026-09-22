import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)), quiet: true });

if (!process.env.DEMO_PASSWORD) {
  throw new Error(
    "DEMO_PASSWORD is not set. Copy tests/.env.example to tests/.env and fill it in.",
  );
}

// ⚠️ Defined once and exported: these addresses appear in the client's env, the server's
// accepted origin, `baseURL` and the API calls a test makes to arrange its own state. Two
// copies that drift apart show up as a refused request, not as a wrong address.
export const CLIENT_URL = "http://localhost:5174";
export const API_URL = "http://localhost:5001/api";

// The tests only ever run against the qa database: the connection string from
// server/.env, with its database name replaced by qa.
//
// ⚠️ Exported so that a test reaching for the database reaches for it through here and
// cannot name a database of its own. There is no argument to get this wrong with.
export function qaDatabaseUri() {
  const serverEnv = dotenv.parse(
    fs.readFileSync(new URL("../server/.env", import.meta.url)),
  );
  const match = (serverEnv.MONGO_URI || "").match(
    /^(mongodb(?:\+srv)?:\/\/[^/?]+)\/?[^?]*(\?.*)?$/,
  );
  if (!match) throw new Error("server/.env has no usable MONGO_URI.");
  return `${match[1]}/qa${match[2] || ""}`;
}

export default defineConfig({
  testDir: "./tests",
  // One test at a time: every test shares the one qa database.
  workers: 1,
  fullyParallel: false,
  // "never": on a failure the HTML report otherwise holds the command open until Ctrl+C.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: CLIENT_URL,
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm start",
      cwd: "../server",
      url: `${API_URL}/status`,
      reuseExistingServer: false,
      env: {
        PORT: String(new URL(API_URL).port),
        MONGO_URI: qaDatabaseUri(),
        // ⚠️ The server accepts requests from this one address only. Leave it out and
        // every sign-in from the test client is refused.
        CLIENT_URL,
      },
    },
    {
      command: `npm run dev -- --port ${new URL(CLIENT_URL).port} --strictPort`,
      cwd: "../client",
      url: CLIENT_URL,
      reuseExistingServer: false,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
