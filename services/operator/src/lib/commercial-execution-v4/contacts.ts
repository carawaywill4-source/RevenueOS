/**
 * Buyer-adjacent contact harvest. Receipts are not contacts.
 * Discovers public role emails on pages that already talk about the offer.
 */

import type pg from "pg";
import { ensureCommercialExecutionSchema } from "./schema.js";
import { isPersonalDumpOrSpamTarget } from "./email.js";
import type { ListingPayload } from "./directory.js";

export type HarvestedContact = {
  email: string;
  sourceUrl: string;
  method: "mailto" | "visible_text" | "json_ld";
};

const JUNK_EMAIL =
  /example\.com|domain\.com|yourbusiness\.com|sentry\.|wixpress|schema\.|github\.|png$|jpg$|webp$|svg$|\.gov$|\.gov\.|noreply|no-reply|donotreply|mailer-daemon|privacy@|legal@|abuse@|postmaster@|care@buildgrid|datacaptive|bookyourdata|zoominfo|apollo\.io/;

function decodeCloudflareEmails(html: string): string {
  return html.replace(
    /(?:data-cfemail|email-protection#)["']?=?["']?([a-f0-9]{6,})/gi,
    (_full, hex: string) => {
      try {
        const key = Number.parseInt(hex.slice(0, 2), 16);
        let out = "";
        for (let i = 2; i < hex.length; i += 2) {
          out += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16) ^ key);
        }
        return ` ${out} `;
      } catch {
        return "";
      }
    },
  );
}

function deobfuscateEmails(html: string): string {
  return decodeCloudflareEmails(html)
    .replace(/\s*[\[(]at[\])]\s*/gi, "@")
    .replace(/\s*[\[(]dot[\])]\s*/gi, ".")
    .replace(/&#64;/g, "@")
    .replace(/&#46;/g, ".");
}

export function extractPublicEmails(html: string, pageUrl: string): HarvestedContact[] {
  const found = new Map<string, HarvestedContact>();
  const add = (raw: string, method: HarvestedContact["method"]) => {
    const email = raw.trim().toLowerCase();
    if (!email.includes("@") || JUNK_EMAIL.test(email)) return;
    if (isPersonalDumpOrSpamTarget(email)) return;
    if (found.has(email)) return;
    found.set(email, { email, sourceUrl: pageUrl, method });
  };

  const source = deobfuscateEmails(html);

  const mailto = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  let m: RegExpExecArray | null;
  while ((m = mailto.exec(source))) add(m[1]!, "mailto");

  const blocks =
    source.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const b of blocks) {
    const inner = b.replace(/^[^>]*>/, "").replace(/<\/script>$/i, "");
    try {
      const j = JSON.parse(inner) as { email?: unknown; contactPoint?: { email?: unknown } };
      const email = j?.email ?? j?.contactPoint?.email;
      if (typeof email === "string") add(email, "json_ld");
    } catch {
      /* ignore */
    }
  }

  const visible = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((m = visible.exec(source))) {
    const email = m[0]!.toLowerCase();
    const role =
      /^(info|hello|contact|press|media|editor|partnerships|partners|sales|tips|submissions|guest|writers|team)@/.test(
        email,
      );
    const named =
      /^[a-z][a-z._-]{1,30}@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) &&
      !/^(support|admin)@/.test(email);
    if (role || named || found.size < 4) add(email, "visible_text");
    if (found.size >= 12) break;
  }
  return [...found.values()];
}

export async function persistContacts(
  pool: pg.Pool,
  businessId: string,
  contacts: HarvestedContact[],
): Promise<number> {
  await ensureCommercialExecutionSchema(pool);
  let n = 0;
  for (const c of contacts) {
    const r = await pool.query(
      `insert into ros_commercial_contacts (email, source_url, business_id, method)
       values ($1,$2,$3,$4)
       on conflict (email) do nothing`,
      [c.email, c.sourceUrl.slice(0, 500), businessId, c.method],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

export async function discoverContactsFromSearch(
  pool: pg.Pool,
  businessId: string,
  listing: ListingPayload,
): Promise<{ pages: number; stored: number; harvested: number; queries: string[] }> {
  const { huntInternetContacts } = await import("./hunt.js");
  const r = await huntInternetContacts(pool, businessId, listing);
  return { pages: r.pages, stored: r.stored, harvested: r.harvested, queries: r.queries };
}

export async function nextSendableContacts(
  pool: pg.Pool,
  businessId: string,
  limit: number,
  opts?: { portfolioWide?: boolean },
): Promise<Array<{ email: string; sourceUrl: string }>> {
  await ensureCommercialExecutionSchema(pool);
  const r = await pool.query(
    `select c.email, c.source_url
       from ros_commercial_contacts c
       left join aq_suppression s on s.contact_key = c.email
      where s.contact_key is null
        and ($3::bool or c.business_id = $1 or c.business_id = '')
        and c.email !~* '(yourbusiness|example|domain)\\.com'
        and c.email not in (
          select target from ros_commercial_actions
           where action_type = 'email_send'
             and created_at > now() - interval '7 days'
        )
      order by
        case
          when c.email ~ '^(hello|editor|contact|info|press|tips)@' then 0
          else 1
        end,
        c.created_at desc
      limit $2`,
    [businessId, limit, Boolean(opts?.portfolioWide)],
  );
  return (r.rows as Array<{ email?: string; source_url?: string }>)
    .filter((row) => row.email)
    .map((row) => ({ email: row.email!, sourceUrl: row.source_url ?? "" }));
}

export async function nextSendableContact(
  pool: pg.Pool,
  businessId: string,
): Promise<{ email: string; sourceUrl: string } | null> {
  const rows = await nextSendableContacts(pool, businessId, 1);
  return rows[0] ?? null;
}

export async function markContactAttempt(
  pool: pg.Pool,
  email: string,
  result: string,
): Promise<void> {
  await pool.query(
    `update ros_commercial_contacts
        set last_attempted_at=now(), last_result=$2
      where email=$1`,
    [email, result.slice(0, 180)],
  );
}
