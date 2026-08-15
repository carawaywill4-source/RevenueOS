import { BRAND } from "@/lib/brand";
export default function TermsPage() {
  return (
    <main className="wrap">
      <h1>Terms</h1>
      <p>
        Purchasing grants a personal license to use {BRAND.product.name}.
        Redistribution or resale of the files is not permitted.
      </p>
    </main>
  );
}
