/**
 * Fence climber. A blocked form is not the end of the tick.
 * Next legal move: sibling URL, listing-desk email on the same page, then another channel.
 * Does not bypass CAPTCHA, KYC, or phone walls.
 */

import type { ListingPayload } from "./directory.js";
import { extractPublicEmails, type HarvestedContact } from "./contacts.js";

export function siblingSubmitUrls(pageUrl: string): string[] {
  let u: URL;
  try {
    u = new URL(pageUrl);
  } catch {
    return [];
  }
  const paths = [
    "/submit",
    "/submit-product",
    "/submit-a-tool",
    "/add",
    "/add-product",
    "/new",
    "/contribute",
    "/register",
    "/signup",
    "/sign-up",
    "/contact",
    "/about",
  ];
  return paths
    .map((p) => `${u.origin}${p}`)
    .filter((x) => x !== pageUrl && x !== `${pageUrl.replace(/\/$/, "")}/`);
}

export function listingDeskEmails(html: string, pageUrl: string): HarvestedContact[] {
  const extra: HarvestedContact[] = [];
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let host = "";
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  const registrable = host.split(".").slice(-2).join(".");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const email = m[0]!.toLowerCase();
    if (!registrable || !email.endsWith(registrable)) continue;
    if (/noreply|no-reply|donotreply|mailer-daemon|abuse@|postmaster@/.test(email)) continue;
    if (
      /^(listings?|submit|editor|hello|contact|info|press|partners|support|sales)@/.test(email)
    ) {
      extra.push({ email, sourceUrl: pageUrl, method: "visible_text" });
    }
  }
  const seen = new Set(extra.map((c) => c.email));
  for (const c of extractPublicEmails(html, pageUrl)) {
    if (!seen.has(c.email)) extra.push(c);
  }
  return extra;
}

export function composeListingAsk(listing: ListingPayload): { subject: string; text: string } {
  return {
    subject: `Listing request: ${listing.name} ($${listing.priceUsd ?? 89})`,
    text: [
      `Please consider listing ${listing.name}.`,
      ``,
      listing.description,
      ``,
      `Live product: ${listing.url}`,
      `One-time $${listing.priceUsd ?? 89}. Instant download. No subscription.`,
      ``,
      `If listings go through a form I couldn't complete (captcha/account), this is the same request by email.`,
      `Reply STOP to unsubscribe.`,
      ``,
      `— ${listing.name}`,
    ].join("\n"),
  };
}

export function shouldAbandonResult(result: string): boolean {
  return /http_409|http_403|http_401|bounced_to_submit_form/.test(result);
}
