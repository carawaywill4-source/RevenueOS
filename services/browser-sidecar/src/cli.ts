#!/usr/bin/env tsx
/**
 * `sidecar login <platform>` — opens a headed Chromium window pointed at
 * the platform's login page. The owner completes login by hand; the
 * persistent context stores the resulting cookies in PROFILE_DIR so
 * subsequent HTTP calls to the sidecar reuse the session.
 *
 * Usage:
 *   sidecar login hackernews
 *   sidecar login reddit
 *   sidecar login indiehackers
 *   sidecar login substack
 *   sidecar login quora
 *
 * There is no automation of the login itself — the sidecar acts as the
 * owner, not the platform. This CLI just makes it easy to seed the
 * session once.
 */

import { loadEnv } from "./lib/env.js";
import { BrowserManager } from "./lib/browser.js";

const LOGIN_URLS: Record<string, string> = {
  hackernews: "https://news.ycombinator.com/login",
  reddit: "https://www.reddit.com/login",
  indiehackers: "https://www.indiehackers.com/login",
  substack: "https://substack.com/sign-in",
  quora: "https://www.quora.com/",
};

async function loginCommand(platform: string) {
  const url = LOGIN_URLS[platform];
  if (!url) {
    console.error(
      `Unknown platform: ${platform}. Supported: ${Object.keys(LOGIN_URLS).join(", ")}`,
    );
    process.exit(1);
  }
  const env = loadEnv({ ...process.env, HEADLESS: "0" } as NodeJS.ProcessEnv);
  const browser = new BrowserManager({
    profileDir: env.PROFILE_DIR,
    headless: false,
  });
  const page = await browser.newPage();
  console.log(
    `[sidecar] Opening ${platform} login page. Complete login in the browser, ` +
      `then close the window when done.`,
  );
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await new Promise<void>((resolve) => {
    page.on("close", () => resolve());
  });
  await browser.close();
  console.log(`[sidecar] Session persisted to ${env.PROFILE_DIR}`);
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (!command) {
    console.error("Usage: sidecar <login|status> [args]");
    process.exit(1);
  }
  if (command === "login") {
    if (!arg) {
      console.error(
        `Usage: sidecar login <platform>. Supported: ${Object.keys(LOGIN_URLS).join(", ")}`,
      );
      process.exit(1);
    }
    await loginCommand(arg);
    return;
  }
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
