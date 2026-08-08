"use client";

import { Check, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type OrderState = {
  status: "processing" | "fulfilled";
  memorialUrl?: string;
};

export function FulfillmentStatus({ sessionId }: { sessionId: string }) {
  const [order, setOrder] = useState<OrderState>({ status: "processing" });

  useEffect(() => {
    window.localStorage.removeItem("tributeready:draft:v1");
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function check() {
      try {
        const response = await fetch(
          `/api/order-status?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const result = (await response.json()) as OrderState;
        if (!active) return;
        setOrder(result);
        if (result.status !== "fulfilled" && attempts < 20) {
          attempts += 1;
          timer = setTimeout(check, 3000);
        }
      } catch {
        if (active && attempts < 20) {
          attempts += 1;
          timer = setTimeout(check, 3000);
        }
      }
    }

    void check();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  if (order.status === "fulfilled") {
    return (
      <div className="mt-7 rounded-2xl bg-mist/70 px-5 py-5">
        <p className="flex items-center justify-center gap-2 text-sm font-bold text-forest">
          <Check size={17} />
          Your collection has been delivered.
        </p>
        <p className="mt-2 text-xs leading-6 text-forest/55">
          Check your email for the attached PDF and keep the private link safe.
        </p>
        {order.memorialUrl ? (
          <Link
            href={order.memorialUrl}
            className="mt-4 inline-flex rounded-full bg-forest px-5 py-3 text-xs font-bold text-white"
          >
            Open private memorial
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-7 flex items-center justify-center gap-2 rounded-2xl bg-mist/60 px-4 py-4 text-xs font-semibold text-forest/65">
      <Loader2 size={15} className="animate-spin" />
      Preparing the PDF and delivery email now.
      <Mail size={15} />
    </div>
  );
}
