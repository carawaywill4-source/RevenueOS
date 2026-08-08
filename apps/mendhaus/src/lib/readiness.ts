import { PRODUCTS } from "@/catalog/products";
import { supabaseConfigured } from "./supabase";

export type OwnerGate = {
  id: string;
  title: string;
  why: string;
  done: boolean;
  href?: string;
};

export function ownerGates(): OwnerGate[] {
  const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const webhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const resend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  const supabase = supabaseConfigured();
  const supplier = process.env.MENDHAUS_SUPPLIER_READY === "1";
  const domain = Boolean(process.env.NEXT_PUBLIC_APP_URL?.includes("mendhaus.shop"));
  const tax = process.env.MENDHAUS_STRIPE_TAX === "1";

  return [
    {
      id: "domain",
      title: "Point mendhaus.shop DNS at the Vercel project",
      why: "Customers need the live brand URL: mendhaus.shop",
      done: domain,
      href: "https://vercel.com/docs/projects/domains/add-a-domain",
    },
    {
      id: "stripe",
      title: "Create a Stripe account and add restricted keys",
      why: "Required to accept real card payments and pay you out.",
      done: stripe,
      href: "https://dashboard.stripe.com/register",
    },
    {
      id: "stripe-webhook",
      title: "Stripe webhook → /api/stripe/webhook",
      why: "checkout.session.completed, checkout.session.expired, charge.refunded",
      done: webhook,
      href: "https://dashboard.stripe.com/webhooks",
    },
    {
      id: "supabase",
      title: "Create a Mendhaus Supabase project and run schema.sql + RevenueOS schema.sql",
      why: "Orders, events, journal, and RevenueOS memory.",
      done: supabase,
      href: "https://supabase.com/dashboard",
    },
    {
      id: "resend",
      title: "Verify a sending domain in Resend",
      why: "Order confirmation emails.",
      done: resend,
      href: "https://resend.com/domains",
    },
    {
      id: "supplier",
      title: "Open CJ Dropshipping (US warehouse) and/or Spocket; confirm live SKUs",
      why: `${PRODUCTS.length} catalog items are priced from public supplier economics. You must create the supplier account, map each SKU, and set MENDHAUS_SUPPLIER_READY=1 before paid orders.`,
      done: supplier,
      href: "https://cjdropshipping.com/register.html",
    },
    {
      id: "tax",
      title: "Register for Stripe Tax where you have nexus",
      why: "Do not collect tax until registrations exist. Set MENDHAUS_STRIPE_TAX=1 after.",
      done: tax,
      href: "https://dashboard.stripe.com/settings/tax",
    },
  ];
}

export function checkoutAllowed() {
  const gates = ownerGates();
  return gates
    .filter((g) => ["stripe", "stripe-webhook", "supabase", "supplier"].includes(g.id))
    .every((g) => g.done);
}
