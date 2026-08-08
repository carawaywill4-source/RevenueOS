import { Resend } from "resend";
import { BRAND } from "@/lib/brand";

export function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/** Prefer verified sending domain; reply-to stays on mendhaus.shop care inbox. */
export function mendhausFromAddress() {
  return process.env.RESEND_FROM_EMAIL || `Mendhaus <delivery@tributeready.org>`;
}

export function mendhausReplyTo() {
  return process.env.RESEND_REPLY_TO || BRAND.supportEmail;
}

export async function sendMendhausEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
}) {
  if (!resendConfigured()) {
    return { ok: false as const, error: "resend_not_configured" };
  }
  const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: mendhausFromAddress(),
    to: input.to,
    replyTo: mendhausReplyTo(),
    subject: input.subject,
    text: input.text,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, id: data?.id };
}
