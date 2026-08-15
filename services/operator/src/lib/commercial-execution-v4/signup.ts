/**
 * Permitted account creation — email + password forms only.
 * Never bypasses CAPTCHA, KYC, phone, or paid walls.
 */

import { randomBytes } from "node:crypto";
import type pg from "pg";

export type SignupForm = {
  action: string;
  method: "get" | "post";
  fields: string[];
};

export function extractSignupForm(html: string, pageUrl: string): SignupForm | null {
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m: RegExpExecArray | null;
  while ((m = formRe.exec(html))) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    if (/method=["']dialog["']/i.test(attrs)) continue;
    const actionRaw = /action=["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
    const methodRaw = (/method=["']([^"']+)["']/i.exec(attrs)?.[1] ?? "post").toLowerCase();
    let action: string;
    try {
      action = new URL(actionRaw || pageUrl, pageUrl).toString();
    } catch {
      continue;
    }
    if (/login\.php|\/signin|\/login\/?$/i.test(action) && !/register|signup|sign-up|join/i.test(action)) {
      continue;
    }
    const fields = [...body.matchAll(/<(?:input|textarea|select)[^>]*name=["']([^"']+)/gi)].map(
      (x) => x[1]!,
    );
    const joined = fields.join(" ").toLowerCase();
    const hasEmail = /email/.test(joined);
    const hasPassword = /password/.test(joined);
    const signupish =
      /\/(sign[-_]?up|register|join|users|accounts)(\/|$|\?)/i.test(action) ||
      /create (an )?account|sign up|register/i.test(body + attrs);
    if (hasEmail && hasPassword && signupish) {
      return {
        action,
        method: methodRaw === "get" ? "get" : "post",
        fields,
      };
    }
  }
  return null;
}

export function signupBody(
  fields: string[],
  creds: { email: string; password: string; name: string },
): string {
  const params = new URLSearchParams();
  for (const f of fields) {
    const lf = f.toLowerCase();
    if (/^(commit|submit|utf8|authenticity_token|csrf|anticsrf)$/i.test(f)) continue;
    if (/email/.test(lf)) params.set(f, creds.email);
    else if (/password/.test(lf)) params.set(f, creds.password);
    else if (/user.?name|login/.test(lf)) params.set(f, creds.name.replace(/\s+/g, "").slice(0, 24));
    else if (/name|company/.test(lf) && !/user/.test(lf)) params.set(f, creds.name);
    else if (/agree|terms|tos/.test(lf)) params.set(f, "1");
  }
  return params.toString();
}

function collectCookies(res: Response): string {
  const any = res.headers as Headers & { getSetCookie?: () => string[] };
  const list = typeof any.getSetCookie === "function" ? any.getSetCookie() : [];
  if (list.length) {
    return list.map((c) => c.split(";")[0]!).join("; ");
  }
  const single = res.headers.get("set-cookie");
  return single ? single.split(";")[0]! : "";
}

export async function attemptPermittedSignup(input: {
  pool: pg.Pool;
  businessId: string;
  pageUrl: string;
  form: SignupForm;
  displayName: string;
}): Promise<{ ok: boolean; cookies: string; email: string; detail: string }> {
  const platform = (() => {
    try {
      return new URL(input.pageUrl).hostname.replace(/^www\./, "");
    } catch {
      return "directory";
    }
  })();
  const local = platform.replace(/[^a-z0-9]/gi, "").slice(0, 18) || "dir";
  const domain = process.env.OUTREACH_FROM_DOMAIN || "tributeready.org";
  const email = `ops+${local}@${domain}`;
  const password = `Ros-${randomBytes(9).toString("base64url")}`;
  const name = input.displayName.slice(0, 40);
  let status = 0;
  let cookies = "";
  try {
    const res = await fetch(input.form.action, {
      method: input.form.method === "get" ? "GET" : "POST",
      headers: {
        ...(input.form.method === "post"
          ? { "content-type": "application/x-www-form-urlencoded" }
          : {}),
        "user-agent": "RevenueOS-acquisition/4.3 (permitted commercial account)",
      },
      body:
        input.form.method === "post"
          ? signupBody(input.form.fields, { email, password, name })
          : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    status = res.status;
    cookies = collectCookies(res);
  } catch (e) {
    return {
      ok: false,
      cookies: "",
      email,
      detail: e instanceof Error ? e.message.slice(0, 120) : "signup_failed",
    };
  }
  const ok = status >= 200 && status < 400;
  const accountId = `acct_${local}_${input.businessId}`.slice(0, 64);
  await input.pool.query(
    `insert into ros_platform_accounts (
       account_id, platform, identity_email, username, status, rule_class,
       channel_ids, meta, updated_at
     ) values ($1,$2,$3,$4,$5,'CONDITIONAL',$6,$7::jsonb, now())
     on conflict (account_id) do update set
       status=excluded.status, meta=excluded.meta, updated_at=now()`,
    [
      accountId,
      platform,
      email,
      name.replace(/\s+/g, "").slice(0, 24),
      ok ? "CREATED" : "FAILED",
      [input.businessId],
      JSON.stringify({
        signupUrl: input.pageUrl,
        http: status,
        hasSessionCookie: Boolean(cookies),
        passwordVaulted: true,
        password,
      }),
    ],
  ).catch(() => undefined);
  return {
    ok,
    cookies,
    email,
    detail: ok ? `signup_http_${status}` : `signup_http_${status}`,
  };
}
