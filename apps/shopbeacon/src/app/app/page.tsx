import { BRAND } from "@/lib/brand";
export default function AppHome() {
  return (
    <main className="wrap">
      <h1>{BRAND.displayName} app</h1>
      <p>
        Entitlement activates after Stripe checkout webhook. This shell is the
        real product surface RevenueOS will optimize.
      </p>
      <p>Create a QR landing page with UTM parameters for your shop.</p>
    </main>
  );
}
