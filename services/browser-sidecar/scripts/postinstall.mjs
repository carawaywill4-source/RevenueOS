#!/usr/bin/env node
/**
 * After `npm install` in the sidecar, download the Chromium runtime.
 * Playwright ships an installer; we just call it. If the env variable
 * SKIP_PLAYWRIGHT_INSTALL is set we skip (useful for CI / offline dev).
 */
import { spawn } from "node:child_process";

if (process.env.SKIP_PLAYWRIGHT_INSTALL === "1") {
  console.log("[sidecar] SKIP_PLAYWRIGHT_INSTALL=1 — skipping browser download");
  process.exit(0);
}

const child = spawn("npx", ["--yes", "playwright", "install", "chromium"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log("[sidecar] Chromium installed");
    process.exit(0);
  }
  console.warn(
    `[sidecar] playwright install exited with code ${code}. Run it manually: npx playwright install chromium`,
  );
  process.exit(0);
});
