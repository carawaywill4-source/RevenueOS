import { BRAND } from "@/lib/brand";
export default function PrivacyPage() {
  return (
    <main className="wrap">
      <h1>Privacy</h1>
      <p>
        {BRAND.displayName} collects email and payment metadata via Stripe to
        deliver your purchase. We do not sell personal data.
      </p>
    </main>
  );
}
