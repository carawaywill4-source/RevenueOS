/**
 * Directory / listing acquisition.
 * Discovers submit endpoints, classifies hard blockers, submits only when
 * automation is permitted and no CAPTCHA/KYC wall is present.
 * Search boxes and login forms are not listings.
 */

export type DirectoryHardBlocker =
  | "captcha"
  | "kyc"
  | "identity_verification"
  | "licensed_professional"
  | "payment_required"
  | "automation_prohibited"
  | "phone_verification"
  | "legal_certification"
  | null;

export type DirectoryClass = {
  policy: "PERMITTED_PUBLISH" | "CONDITIONAL" | "HARD_BLOCKED" | "UNKNOWN";
  hardBlocker: DirectoryHardBlocker;
  accountNeeded: boolean;
  hasSubmitForm: boolean;
  formAction: string | null;
  formMethod: "get" | "post";
  fieldNames: string[];
  reason: string;
};

export function isJunkDirectoryUrl(url: string): boolean {
  return /\/browse\/?$|\/trending\/?$|\/blog\/?$|login\.php|\/signin|\/auth\/login|\/search\b|list-manage|mailerlite|gumroad\.com\/l\/|\/subscribe/i.test(
    url,
  );
}

function fieldNamesFromForm(body: string): string[] {
  const names: string[] = [];
  const re = /<(?:input|textarea|select)[^>]*name=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) names.push(m[1]!);
  return names;
}

function isSearchFields(fields: string[], action: string): boolean {
  if (/\/search\b/i.test(action)) return true;
  const meaningful = fields.filter(
    (f) => !/^(commit|submit|utf8|authenticity_token|csrf|anticsrf|ml-submit)$/i.test(f),
  );
  if (meaningful.length === 0) return false;
  return meaningful.every((f) => /^(q|query|s|search|keyword|keywords)$/i.test(f));
}

function isNewsletterFields(fields: string[], urlAndHtml: string): boolean {
  if (/mailerlite|mailchimp|convertkit|list-manage|newsletter|\/subscribe/i.test(urlAndHtml)) {
    return true;
  }
  const meaningful = fields.filter(
    (f) => !/^(commit|submit|utf8|authenticity_token|csrf|anticsrf|ml-submit)$/i.test(f),
  );
  return (
    meaningful.length > 0 &&
    meaningful.every((f) => /email/i.test(f)) &&
    !meaningful.some((f) => /url|website|product|tool|listing|company/i.test(f))
  );
}

function isListingFields(fields: string[], pageHtml: string): boolean {
  const joined = fields.join(" ").toLowerCase();
  const hasUrl = /url|website|homepage/.test(joined);
  const hasName = /name|title|company|tool|product|startup|listing/.test(joined);
  const copy = /submit.{0,24}(listing|product|tool|startup)|add\s+(your\s+)?(product|listing|company|tool)/i.test(
    pageHtml,
  );
  return (hasUrl && (hasName || copy)) || (hasUrl && hasName);
}

export type ListingFormMeta = {
  action: string;
  method: "get" | "post";
  fields: string[];
};

export function extractListingForm(html: string, pageUrl: string): ListingFormMeta | null {
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m: RegExpExecArray | null;
  while ((m = formRe.exec(html))) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    if (/method=["']dialog["']/i.test(attrs)) continue;
    const actionRaw = /action=["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
    const methodRaw = (/method=["']([^"']+)["']/i.exec(attrs)?.[1] ?? "get").toLowerCase();
    let action: string;
    try {
      action = new URL(actionRaw || pageUrl, pageUrl).toString();
    } catch {
      continue;
    }
    if (/login\.php|\/signin|\/login\/?$/i.test(action)) continue;
    const fields = fieldNamesFromForm(body);
    if (isSearchFields(fields, action)) continue;
    if (isNewsletterFields(fields, `${pageUrl} ${html}`)) continue;
    if (isListingFields(fields, html)) {
      return {
        action,
        method: methodRaw === "post" ? "post" : "get",
        fields,
      };
    }
  }
  return null;
}

export function classifyDirectoryPage(url: string, html: string): DirectoryClass {
  const h = html.toLowerCase();
  const empty = {
    accountNeeded: /sign\s*up|create\s*account|log\s*in/.test(h),
    hasSubmitForm: /<form/i.test(html),
    formAction: null as string | null,
    formMethod: "get" as const,
    fieldNames: [] as string[],
  };
  if (/recaptcha|hcaptcha|cf-turnstile|g-recaptcha|captcha/.test(h)) {
    return {
      policy: "HARD_BLOCKED",
      hardBlocker: "captcha",
      ...empty,
      reason: "CAPTCHA/challenge present — not bypassed",
    };
  }
  if (/know your customer|\bkyc\b|government.?issued id|passport upload/.test(h)) {
    return {
      policy: "HARD_BLOCKED",
      hardBlocker: "kyc",
      ...empty,
      accountNeeded: true,
      hasSubmitForm: false,
      reason: "KYC/identity verification required",
    };
  }
  if (/license (number|verification)|licensed professional|bar number/.test(h)) {
    return {
      policy: "HARD_BLOCKED",
      hardBlocker: "licensed_professional",
      ...empty,
      accountNeeded: true,
      hasSubmitForm: false,
      reason: "licensed-professional verification required",
    };
  }
  if (/sms (code|verification)|verify your phone|phone number required/.test(h) && /verification/.test(h)) {
    return {
      policy: "HARD_BLOCKED",
      hardBlocker: "phone_verification",
      ...empty,
      accountNeeded: true,
      hasSubmitForm: false,
      reason: "phone verification cannot be completed autonomously",
    };
  }
  if (/no automated|bots? not allowed|prohibits automation/.test(h)) {
    return {
      policy: "HARD_BLOCKED",
      hardBlocker: "automation_prohibited",
      ...empty,
      hasSubmitForm: false,
      reason: "page prohibits automation",
    };
  }
  if (/paid (listing|submission)|submit.*\$\d|upgrade to submit/.test(h)) {
    return {
      policy: "HARD_BLOCKED",
      hardBlocker: "payment_required",
      ...empty,
      reason: "paid listing — financial authorization not assumed",
    };
  }

  if (/mailerlite|mailchimp|convertkit|newsletter|\/subscribe|list-manage\.com/.test(url)) {
    return {
      policy: "UNKNOWN",
      hardBlocker: null,
      ...empty,
      hasSubmitForm: false,
      reason: "newsletter_or_email_capture_not_a_directory_listing",
    };
  }

  const listing = extractListingForm(html, url);
  if (listing) {
    return {
      policy: "PERMITTED_PUBLISH",
      hardBlocker: null,
      accountNeeded: false,
      hasSubmitForm: true,
      formAction: listing.action,
      formMethod: listing.method,
      fieldNames: listing.fields,
      reason: "listing form with product/url fields, no captcha, no account wall detected",
    };
  }

  const formAction = extractFormAction(html, url);
  if (formAction && /login\.php|\/signin|\/login\/?$/i.test(formAction)) {
    return {
      policy: "CONDITIONAL",
      hardBlocker: null,
      accountNeeded: true,
      hasSubmitForm: true,
      formAction,
      formMethod: "post",
      fieldNames: [],
      reason: "login_form_not_a_public_listing_submit",
    };
  }
  const fields = fieldNamesFromForm(html);
  if (isSearchFields(fields, formAction ?? url)) {
    return {
      policy: "UNKNOWN",
      hardBlocker: null,
      accountNeeded: false,
      hasSubmitForm: false,
      formAction: null,
      formMethod: "get",
      fieldNames: fields,
      reason: "search_form_not_a_directory_listing",
    };
  }
  const accountNeeded = /create\s*account|sign\s*up|log\s*in to submit|account required/.test(h);
  if (accountNeeded && /submit(\s+your)?\s+(listing|product|tool|startup)/.test(h)) {
    return {
      policy: "CONDITIONAL",
      hardBlocker: null,
      accountNeeded: true,
      hasSubmitForm: Boolean(formAction),
      formAction,
      formMethod: "post",
      fieldNames: fields,
      reason: "account required — not an owner blocker; signup not attempted because captcha/KYC unknown on signup",
    };
  }
  if (/<form/i.test(html)) {
    return {
      policy: "CONDITIONAL",
      hardBlocker: null,
      accountNeeded: false,
      hasSubmitForm: true,
      formAction,
      formMethod: "get",
      fieldNames: fields,
      reason: "submit affordance present but not a product listing form",
    };
  }
  return {
    policy: "UNKNOWN",
    hardBlocker: null,
    accountNeeded: false,
    hasSubmitForm: false,
    formAction: null,
    formMethod: "get",
    fieldNames: [],
    reason: "no listing form found",
  };
}

export function extractFormAction(html: string, pageUrl: string): string | null {
  const m = html.match(/<form[^>]+action=["']([^"']+)["'][^>]*>/i);
  if (!m?.[1]) {
    if (/<form/i.test(html)) {
      try {
        return new URL(pageUrl).toString();
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    return new URL(m[1], pageUrl).toString();
  } catch {
    return null;
  }
}

export type ListingPayload = {
  name: string;
  url: string;
  email: string;
  description: string;
  category: string;
  intentKeywords?: string[];
  priceUsd?: number;
};

export function listingFormBody(listing: ListingPayload, fieldNames?: string[]): string {
  const fields =
    fieldNames && fieldNames.length > 0
      ? fieldNames
      : ["name", "title", "url", "website", "email", "description", "message", "category", "company"];
  const params = new URLSearchParams();
  for (const f of fields) {
    const lf = f.toLowerCase();
    if (/^(commit|submit|utf8|authenticity_token|csrf|anticsrf|ml-submit)$/i.test(f)) continue;
    if (/email/.test(lf)) params.set(f, listing.email);
    else if (/url|website|homepage/.test(lf)) params.set(f, listing.url);
    else if (/desc|message|about|bio|tagline/.test(lf)) params.set(f, listing.description.slice(0, 500));
    else if (/categor/.test(lf)) params.set(f, listing.category);
    else if (/name|title|company|tool|product|startup|listing/.test(lf)) params.set(f, listing.name);
    else params.set(f, listing.description.slice(0, 200));
  }
  return params.toString();
}

export function listingLooksAccepted(
  status: number,
  body: string,
  finalUrl?: string,
): {
  executed: boolean;
  verified: boolean;
  result: string;
} {
  const b = body.toLowerCase();
  if (status >= 400) {
    return { executed: true, verified: false, result: `http_${status}` };
  }
  if (/captcha|blocked|forbidden|bot detected/.test(b)) {
    return { executed: true, verified: false, result: "rejected_challenge" };
  }
  if (/thank you|thanks for|submitted|pending review|received your|listing.*queued/.test(b)) {
    return { executed: true, verified: true, result: "submitted_or_pending_review" };
  }
  if (finalUrl && /\/submit|\/services\/submit|\/add-/i.test(finalUrl) && !/thank|pending/i.test(b)) {
    return { executed: true, verified: false, result: "bounced_to_submit_form" };
  }
  if (status >= 200 && status < 400) {
    return { executed: true, verified: false, result: `http_${status}_unconfirmed` };
  }
  return { executed: true, verified: false, result: `http_${status}` };
}
