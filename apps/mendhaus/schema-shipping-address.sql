-- Add shipping address capture from Stripe Checkout (run if mh_orders already exists).
alter table public.mh_orders
  add column if not exists shipping_address jsonb;
