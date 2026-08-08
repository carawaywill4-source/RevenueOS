import { createClient } from "@supabase/supabase-js";

export type MemorialDraft = {
  heading: string;
  obituary: string;
  remembrance: string;
  closing: string;
};

export type MemorialDetails = {
  name: string;
  birthYear: string;
  passingYear: string;
  relationship: string;
  qualities: string;
  memories: string;
  saying: string;
  serviceDetails: string;
  programFormat?: "bifold" | "keepsake";
  serviceTitle?: string;
  serviceDate?: string;
  serviceLocation?: string;
  orderOfService?: string;
  readingOrPoem?: string;
  acknowledgments?: string;
  theme: "garden" | "classic" | "sky";
};

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase fulfillment is not configured");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function fulfillmentIsConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.RESEND_API_KEY &&
      process.env.RESEND_FROM_EMAIL,
  );
}
