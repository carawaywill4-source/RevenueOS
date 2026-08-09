import express, { type Request, type Response, type NextFunction } from "express";
import { z, ZodError } from "zod";
import type { PlatformRateLimiter } from "./rate-limiter.js";
import {
  postHackerNews,
  postIndieHackers,
  postQuora,
  postSubstack,
  replyRedditThread,
  submitRedditPost,
  type HandlerContext,
  type HandlerResult,
  type PageLike,
} from "./handlers.js";

export type ServerDeps = {
  token: string;
  screenshotDir: string;
  dryRun: boolean;
  rateLimiter: PlatformRateLimiter;
  createPage: () => Promise<PageLike>;
  now?: () => Date;
  logger?: (event: string, fields: Record<string, unknown>) => void;
};

const HN_SCHEMA = z.object({ title: z.string().min(1), url: z.string().min(1) });
const IH_SCHEMA = z.object({
  productSlug: z.string().min(0).default(""),
  body: z.string().min(1),
});
const SUBSTACK_SCHEMA = z.object({
  publicationId: z.string().min(1),
  html: z.string().min(1),
  subject: z.string().min(1),
});
const QUORA_SCHEMA = z.object({
  questionId: z.string().min(1),
  body: z.string().min(1),
});
const REDDIT_POST_SCHEMA = z.object({
  subreddit: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});
const REDDIT_REPLY_SCHEMA = z.object({
  threadUrl: z.string().url(),
  body: z.string().min(1),
});

function requireToken(expected: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/healthz" || req.path === "/status") return next();
    const supplied = req.header("x-sidecar-token");
    if (!supplied || supplied !== expected) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
    return next();
  };
}

function shouldRunLive(bodyDryRun: unknown, defaultDryRun: boolean): boolean {
  if (bodyDryRun === true) return false;
  if (bodyDryRun === false) return true;
  return !defaultDryRun;
}

type PlatformRoute = {
  path: string;
  platform: string;
  schema: z.ZodTypeAny;
  run: (
    ctx: HandlerContext,
    input: Record<string, unknown>,
  ) => Promise<HandlerResult>;
};

const ROUTES: PlatformRoute[] = [
  {
    path: "/post/hackernews",
    platform: "hackernews",
    schema: HN_SCHEMA,
    run: (ctx, input) =>
      postHackerNews(ctx, input as { title: string; url: string }),
  },
  {
    path: "/post/indiehackers",
    platform: "indiehackers",
    schema: IH_SCHEMA,
    run: (ctx, input) =>
      postIndieHackers(ctx, input as { productSlug: string; body: string }),
  },
  {
    path: "/post/substack",
    platform: "substack",
    schema: SUBSTACK_SCHEMA,
    run: (ctx, input) =>
      postSubstack(
        ctx,
        input as { publicationId: string; html: string; subject: string },
      ),
  },
  {
    path: "/post/quora",
    platform: "quora",
    schema: QUORA_SCHEMA,
    run: (ctx, input) =>
      postQuora(ctx, input as { questionId: string; body: string }),
  },
  {
    path: "/reddit/post",
    platform: "reddit",
    schema: REDDIT_POST_SCHEMA,
    run: (ctx, input) =>
      submitRedditPost(
        ctx,
        input as { subreddit: string; title: string; body: string },
      ),
  },
  {
    path: "/reddit/reply",
    platform: "reddit",
    schema: REDDIT_REPLY_SCHEMA,
    run: (ctx, input) =>
      replyRedditThread(ctx, input as { threadUrl: string; body: string }),
  },
];

export function buildApp(deps: ServerDeps): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(requireToken(deps.token));

  const log = deps.logger ?? (() => {});

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, at: new Date().toISOString() });
  });

  app.get("/status", (_req, res) => {
    res.json({
      ok: true,
      dryRun: deps.dryRun,
      screenshotDir: deps.screenshotDir,
      rateLimits: deps.rateLimiter.snapshot(),
    });
  });

  for (const route of ROUTES) {
    app.post(route.path, async (req, res) => {
      let input: Record<string, unknown>;
      try {
        input = route.schema.parse(req.body) as Record<string, unknown>;
      } catch (error) {
        if (error instanceof ZodError) {
          res.status(400).json({
            ok: false,
            error: "bad_request",
            detail: error.issues,
          });
          return;
        }
        res.status(400).json({ ok: false, error: "bad_request" });
        return;
      }
      const attempt = deps.rateLimiter.attempt(
        route.platform,
        deps.now?.() ?? new Date(),
      );
      if (!attempt.allowed) {
        res
          .status(429)
          .json({ ok: false, error: attempt.reason, retryAfterMs: attempt.retryAfterMs });
        return;
      }
      const dryRun = !shouldRunLive(req.body?.dryRun, deps.dryRun);
      let page: PageLike | null = null;
      try {
        page = await deps.createPage();
        const result = await route.run(
          {
            page,
            screenshotDir: deps.screenshotDir,
            dryRun,
          },
          input,
        );
        log("sidecar.action.done", {
          platform: route.platform,
          path: route.path,
          dryRun,
          url: result.url,
        });
        res.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("sidecar.action.error", {
          platform: route.platform,
          path: route.path,
          message,
        });
        res.status(500).json({ ok: false, error: "handler_failed", detail: message });
      } finally {
        try {
          await page?.close();
        } catch {
          // page close is best-effort
        }
      }
    });
  }

  return app;
}
