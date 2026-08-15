import { BRAND } from "@/lib/brand";
export default function RefundsPage() {
  return (
    <main className="wrap">
      <h1>Refunds</h1>
      <p>
        Digital products from {BRAND.displayName} include a 14-day refund if you
        have not substantially used the files. Email {BRAND.supportEmail}.
      </p>
    </main>
  );
}
