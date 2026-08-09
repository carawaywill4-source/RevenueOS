/**
 * Browser sidecar entrypoint.
 *
 * Runs LOCALLY on the owner's macOS machine (or a small always-on
 * Mac Mini / VPS) so the operator has access to the owner's real
 * logged-in browser sessions. Not intended for internet exposure —
 * put it behind a Tailscale tunnel or ngrok reserved domain.
 */

import { loadEnv } from "./lib/env.js";
import { BrowserManager } from "./lib/browser.js";
import { PlatformRateLimiter } from "./lib/rate-limiter.js";
import { buildApp } from "./lib/server.js";

function log(event: string, fields: Record<string, unknown> = {}) {
  const line = { at: new Date().toISOString(), event, ...fields };
  try {
    console.log(JSON.stringify(line));
  } catch {
    console.log(`[sidecar] ${event}`);
  }
}

async function main() {
  const env = loadEnv();
  log("sidecar.boot", {
    port: env.PORT,
    dryRun: env.DRY_RUN,
    headless: env.HEADLESS,
    profileDir: env.PROFILE_DIR,
  });

  const rateLimiter = new PlatformRateLimiter();
  const browser = new BrowserManager({
    profileDir: env.PROFILE_DIR,
    headless: env.HEADLESS === true,
  });

  const app = buildApp({
    token: env.SIDECAR_TOKEN,
    screenshotDir: env.SCREENSHOT_DIR,
    dryRun: env.DRY_RUN === true,
    rateLimiter,
    createPage: () => browser.newPage(),
    logger: (event, fields) => log(event, fields),
  });

  const server = app.listen(env.PORT, () => {
    log("sidecar.listening", { port: env.PORT });
  });

  const shutdown = async (signal: string) => {
    log("sidecar.shutdown", { signal });
    server.close();
    await browser.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  log("sidecar.crash", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
