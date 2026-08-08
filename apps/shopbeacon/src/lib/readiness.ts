import { existsSync } from "node:fs";
import path from "node:path";
import {
  digitalCheckoutAllowed,
  digitalOwnerGates,
} from "@revenueos/storefront-kit";

function assetsExist() {
  const dir = path.join(process.cwd(), "content/product");
  return existsSync(path.join(dir, "readme.md"));
}

export function ownerGates() {
  return digitalOwnerGates({
    stripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    assetsExist: assetsExist(),
    resend: Boolean(process.env.RESEND_API_KEY),
    supabase: Boolean(process.env.SUPABASE_URL),
  });
}

export function checkoutAllowed() {
  if (process.env.NEXT_PUBLIC_CHECKOUT_ENABLED !== "1") return false;
  return digitalCheckoutAllowed(ownerGates());
}
