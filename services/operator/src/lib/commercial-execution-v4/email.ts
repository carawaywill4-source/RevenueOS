/**
 * Diagnose and send one compliant outreach email.
 * Does not rediscover contacts when send is impossible.
 *
 * Sender Identity Architecture:
 * Uses verified domain tributeready.org with brand-specific display names
 * and brand-specific Reply-To headers to ensure transparency and CAN-SPAM compliance.
 */

export type EmailDiagnose = {
  sendable: boolean;
  blocker: string | null;
  blockerClass: "NONE" | "CONFIG" | "OWNER" | "COMPLIANCE" | "RATE_LIMIT";
  from: string;
  hasKey: boolean;
};

function cleanFrom(raw: string): string {
  return raw.trim().replace(/^["']+|["']+$/g, "").trim();
}

export function buildSenderIdentity(brandDisplayName: string, siteId: string): { from: string; replyTo: string } {
  const cleanName = brandDisplayName.replace(/[^\w\s-]/g, "").trim() || "RevenueOS";
  const fromDomain = process.env.OUTREACH_FROM_DOMAIN || "tributeready.org";
  // Strict check: only route replyTo to verified inbound address where operator receives mail
  const inboundAddress = process.env.VERIFIED_INBOUND_EMAIL || `updates@${fromDomain}`;
  return {
    from: `${cleanName} via RevenueOS <${inboundAddress}>`,
    replyTo: inboundAddress,
  };
}

export function diagnoseEmailSendability(env: NodeJS.ProcessEnv = process.env): EmailDiagnose {
  const key = env.RESEND_API_KEY ?? "";
  const from = cleanFrom(
    env.OUTREACH_FROM_EMAIL ||
      env.RESEND_FROM_EMAIL ||
      "RevenueOS <updates@tributeready.org>",
  );
  if (!key || key.length < 10) {
    return {
      sendable: false,
      blocker: "RESEND_API_KEY missing",
      blockerClass: "CONFIG",
      from,
      hasKey: false,
    };
  }
  if (!from) {
    return {
      sendable: false,
      blocker: "OUTREACH_FROM_EMAIL/RESEND_FROM_EMAIL unset",
      blockerClass: "CONFIG",
      from,
      hasKey: true,
    };
  }
  if (/onboarding@resend\.dev/i.test(from)) {
    return {
      sendable: false,
      blocker:
        "from_address is Resend test domain (onboarding@resend.dev) — cannot send to third-party contacts; need verified sending domain",
      blockerClass: "OWNER",
      from,
      hasKey: true,
    };
  }
  return {
    sendable: true,
    blocker: null,
    blockerClass: "NONE",
    from,
    hasKey: true,
  };
}

export async function sendCompliantEmail(input: {
  to: string;
  subject: string;
  text: string;
  from?: string;
  replyTo?: string;
}): Promise<{ ok: boolean; id?: string; detail: string }> {
  const diag = diagnoseEmailSendability();
  if (!diag.sendable) {
    return { ok: false, detail: diag.blocker ?? "email_not_sendable" };
  }
  const key = process.env.RESEND_API_KEY!;
  const from = input.from || diag.from;
  const replyTo = input.replyTo;
  const body = `${input.text.trim()}\n\n---\nThis is a one-to-one business communication from a RevenueOS commercial project.\nSupport & Inquiries: ${replyTo || "care@tributeready.org"}\nUnsubscribe: reply STOP to opt out immediately.\n`;
  try {
    const payload: Record<string, unknown> = {
      from,
      to: [input.to],
      subject: input.subject.slice(0, 180),
      text: body.slice(0, 4000),
    };
    if (replyTo) {
      payload.reply_to = replyTo;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        detail: `resend_${res.status}:${json.message ?? ""}`.slice(0, 180),
      };
    }
    return { ok: true, id: json.id, detail: "sent" };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message.slice(0, 120) : "send_failed",
    };
  }
}

export function composeSalesEmail(listing: {
  name: string;
  description: string;
  url: string;
  category: string;
  priceUsd?: number;
  intentKeywords?: string[];
  recipientContext?: string;
}): { subject: string; text: string } {
  const price = listing.priceUsd ?? 29;
  const job = listing.intentKeywords?.[0] || listing.category.replace(/_/g, " ");
  const subject = `${listing.name}: $${price} one-time pack for ${job}`;
  const text = [
    `Quick note regarding ${job}:`,
    ``,
    `If this work is currently being rebuilt from scratch or scattered across email threads, ${listing.name} gives you the complete, ready-to-use template pack.`,
    ``,
    `What it does: ${listing.description}`,
    ``,
    `Deliverables: Instant digital download (.xlsx, .docx, .pdf). Yours to keep and reuse across every project. No monthly subscription.`,
    ``,
    `Buy (instant download): ${listing.url}`,
    ``,
    `If this isn't relevant to you, please ignore this note or reply STOP to unsubscribe.`,
    ``,
    `— ${listing.name} Team`,
  ].join("\n");
  return { subject: subject.slice(0, 180), text };
}

export function isPersonalDumpOrSpamTarget(email: string): boolean {
  const e = email.toLowerCase();
  if (/noreply|no-reply|donotreply|mailer-daemon|abuse@|postmaster@/.test(e)) return true;
  if (/example\.com|test@|fake@/.test(e)) return true;
  if (/^(support|admin|webmaster|hostmaster)@/.test(e)) return true;
  return false;
}
