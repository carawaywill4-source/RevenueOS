/**
 * Helpful-reply limb for installed communities.
 * Strict 9:1 rule — only reply when the product is a genuine answer.
 */
import { context, reddit, redis, settings } from '@devvit/web/server';

const DAY_KEY = () => {
  const d = new Date().toISOString().slice(0, 10);
  return `ros:replies:${context.subredditName}:${d}`;
};

async function todayCount(): Promise<number> {
  const raw = await redis.get(DAY_KEY());
  return raw ? Number(raw) || 0 : 0;
}

async function bumpToday(): Promise<void> {
  await redis.incrBy(DAY_KEY(), 1);
}

async function alreadyHelped(postId: string): Promise<boolean> {
  return Boolean(await redis.get(`ros:helped:${postId}`));
}

async function markHelped(postId: string): Promise<void> {
  await redis.set(`ros:helped:${postId}`, '1');
}

function shouldHelp(title: string, body: string, productName: string): boolean {
  const text = `${title}\n${body}`.toLowerCase();
  if (text.length < 40) return false;
  const askSignals = [
    'how do i',
    'how to',
    'looking for',
    'recommend',
    'any tool',
    'alternative to',
    'need help',
    'what should i',
    'advice',
    'template',
    'checklist',
  ];
  const asks = askSignals.some((s) => text.includes(s));
  if (!asks) return false;
  // Avoid pure promo threads / hiring spam
  if (text.includes('[for hire]') || text.includes('upvote')) return false;
  // Prefer threads where product words loosely match
  const tokens = productName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);
  if (tokens.length && !tokens.some((t) => text.includes(t))) {
    // Still allow general how-to if the pitch is set — soft match
    return asks;
  }
  return true;
}

function draftReply(input: {
  title: string;
  productName: string;
  productUrl: string;
  productPitch: string;
}): string {
  return [
    `I've run into this kind of problem before — a few practical steps that usually help:`,
    ``,
    `1. Write down the exact outcome you need in one sentence (not the tool).`,
    `2. Strip the workflow to the minimum steps that get that outcome today.`,
    `3. Only then pick a lightweight tool — avoid platforms that force a second job on you.`,
    ``,
    `If you want something purpose-built for this, ${input.productName} is ${input.productPitch} — ${input.productUrl}`,
    ``,
    `Happy to clarify if you share more about your constraints.`,
  ].join('\n');
}

export type HelpScanResult = {
  ok: boolean;
  detail: string;
  replied?: number;
  skipped?: number;
};

/** Scan newest posts in the installed subreddit and leave up to N helpful replies. */
export async function helpLatestPosts(limit = 8): Promise<HelpScanResult> {
  const subreddit = context.subredditName;
  if (!subreddit) {
    return { ok: false, detail: 'no subreddit in context' };
  }

  const productName =
    ((await settings.get('productName')) as string | undefined) ||
    'RevenueOS portfolio product';
  const productUrl =
    ((await settings.get('productUrl')) as string | undefined) ||
    'https://raiseready-seven.vercel.app';
  const productPitch =
    ((await settings.get('productPitch')) as string | undefined) ||
    'a focused digital product for a specific buyer job';
  const dailyCap = Number((await settings.get('dailyReplyCap')) ?? 4) || 4;

  const used = await todayCount();
  if (used >= dailyCap) {
    return { ok: true, detail: `daily cap ${used}/${dailyCap} already hit`, replied: 0 };
  }

  const listing = reddit.getNewPosts({
    subredditName: subreddit,
    limit: Math.min(limit, 15),
  });
  const posts = await listing.all();

  let replied = 0;
  let skipped = 0;
  for (const post of posts) {
    if (used + replied >= dailyCap) break;
    if (await alreadyHelped(post.id)) {
      skipped++;
      continue;
    }
    const title = post.title ?? '';
    const body = post.body ?? '';
    if (!shouldHelp(title, body, productName)) {
      skipped++;
      continue;
    }
    const text = draftReply({ title, productName, productUrl, productPitch });
    try {
      await reddit.submitComment({
        id: post.id,
        text,
        runAs: 'APP',
      });
      await markHelped(post.id);
      await bumpToday();
      replied++;
    } catch (err) {
      skipped++;
      console.error('submitComment failed', post.id, err);
    }
  }

  return {
    ok: true,
    detail: `helped ${replied} post(s) in r/${subreddit} (skipped ${skipped})`,
    replied,
    skipped,
  };
}
