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

// The tests only ever run against the qa database: the connection string from
// server/.env, with its database name replaced by qa.
function qaDatabaseUri() {
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
    baseURL: "http://localhost:5174",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm start",
      cwd: "../server",
      url: "http://localhost:5001/api/status",
      reuseExistingServer: false,
      env: {
        PORT: "5001",
        MONGO_URI: qaDatabaseUri(),
        // ⚠️ The server accepts requests from this one address only. Leave it out and
        // every sign-in from the test client is refused.
        CLIENT_URL: "http://localhost:5174",
      },
    },
    {
      command: "npm run dev -- --port 5174 --strictPort",
      cwd: "../client",
      url: "http://localhost:5174",
      reuseExistingServer: false,
      env: { VITE_API_URL: "http://localhost:5001/api" },
    },
  ],
});
