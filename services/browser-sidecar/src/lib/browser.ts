/**
 * Playwright persistent-context lifecycle.
 *
 * The sidecar holds ONE persistent browser context pointed at a real
 * user profile directory on disk. Cookies, localStorage, and IndexedDB
 * live there so the owner logs in once per platform and every future
 * call reuses that session.
 *
 * We lazy-construct the context on first use, then keep it warm for
 * the life of the process. If the user closes the browser window we
 * clear the singleton and open a new one on the next request.
 */

import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";

export type BrowserManagerOptions = {
  profileDir: string;
  headless: boolean;
};

export class BrowserManager {
  private context: BrowserContext | null = null;
  private closing = false;

  constructor(private readonly opts: BrowserManagerOptions) {}

  async getContext(): Promise<BrowserContext> {
    if (this.context && !this.closing) return this.context;
    await mkdir(this.opts.profileDir, { recursive: true });
    this.context = await chromium.launchPersistentContext(this.opts.profileDir, {
      headless: this.opts.headless,
      viewport: { width: 1280, height: 900 },
      // Match the owner's macOS Chrome fingerprint enough to avoid trivial
      // bot detection. Do not aggressively spoof — the site is being used
      // by its real owner and should not pretend otherwise.
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    });
    this.context.on("close", () => {
      if (!this.closing) this.context = null;
    });
    return this.context;
  }

  async newPage(): Promise<Page> {
    const ctx = await this.getContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(45_000);
    return page;
  }

  async close(): Promise<void> {
    this.closing = true;
    const ctx = this.context;
    this.context = null;
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        // ignore — user may have already closed the window
      }
    }
    this.closing = false;
  }
}
