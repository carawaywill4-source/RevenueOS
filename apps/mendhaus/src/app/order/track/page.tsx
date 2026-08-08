import type { Metadata } from "next";
import { TrackForm } from "@/components/TrackForm";

export const metadata: Metadata = {
  title: "Track an order",
  robots: { index: false, follow: false },
};

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-4xl text-ink">Track an order</h1>
      <p className="mt-3 text-sm text-ink/70">
        Enter the email used at checkout. We show status and tracking when the warehouse has scanned
        the package.
      </p>
      <TrackForm />
    </div>
  );
}
