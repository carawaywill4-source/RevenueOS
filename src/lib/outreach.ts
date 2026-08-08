import { isSuppressed, unsubscribeUrl } from "@/lib/outreach-suppression";

export type OutreachMessage = {
  to: string;
  subject: string;
  /** Plain paragraphs. The footer is appended here, never by the caller. */
  paragraphs: string[];
};

export type OutreachResult =
  | { sent: true; id: string }
  | { sent: false; reason: "suppressed" | "not_configured" | "failed"; detail?: string };

// CAN-SPAM requires a working opt-out AND a physical postal address on any
// message promoting the product. Both are enforced here rather than trusted to
// whoever is composing, so a batch cannot go out non-compliant by accident.
export function outreachIsConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.RESEND_FROM_EMAIL &&
      process.env.OUTREACH_POSTAL_ADDRESS &&
      process.env.RESEND_SUPPRESSION_AUDIENCE_ID &&
      process.env.OUTREACH_UNSUBSCRIBE_SECRET,
  );
}

export function buildFooter(recipient: string) {
  const postal = process.env.OUTREACH_POSTAL_ADDRESS;
  const url = unsubscribeUrl(recipient);
  return {
    text: `\n\n—\nWill, TributeReady\n${postal}\n\nIf you would rather not hear from me again, unsubscribe here and you will not: ${url}`,
    html: `<p style="margin-top:28px;font-size:12px;line-height:1.6;color:#82908c">Will, TributeReady<br>${escapeHtml(postal!)}<br><br><a href="${url}" style="color:#526762">Unsubscribe</a> and you will not hear from me again.</p>`,
    url,
  };
}

export async function sendOutreach(
  message: OutreachMessage,
): Promise<OutreachResult> {
  if (!outreachIsConfigured()) {
    return { sent: false, reason: "not_configured" };
  }
  if (await isSuppressed(message.to)) {
    return { sent: false, reason: "suppressed" };
  }

  const footer = buildFooter(message.to);
  const body = message.paragraphs
    .map(
      (paragraph) =>
        `<p style="font-size:14px;line-height:1.7;color:#173e35">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "TributeReady/1.0",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: message.to,
      reply_to: "care@tributeready.org",
      subject: message.subject,
      text: message.paragraphs.join("\n\n") + footer.text,
      html: body + footer.html,
      headers: {
        // RFC 8058: lets a mail client offer one-click unsubscribe, which both
        // respects the recipient and protects sender reputation.
        "List-Unsubscribe": `<${footer.url}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });

  const payload = (await response.json()) as { id?: string; message?: string };
  if (!response.ok || !payload.id) {
    return { sent: false, reason: "failed", detail: payload.message };
  }
  return { sent: true, id: payload.id };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] || character,
  );
}
