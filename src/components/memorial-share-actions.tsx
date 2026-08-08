"use client";

import { Check, Copy, QrCode, Share2 } from "lucide-react";
import { useState } from "react";
import { trackGrowthEvent } from "@/lib/growth-client";

export function MemorialShareActions({
  memorialPath,
  qrPath,
}: {
  memorialPath: string;
  qrPath: string;
}) {
  const [copied, setCopied] = useState(false);

  function fullUrl() {
    return new URL(memorialPath, window.location.origin).toString();
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({
        title: "A private memorial",
        text: "I am sharing this private memorial with you.",
        url: fullUrl(),
      });
      void trackGrowthEvent({
        name: "memorial_shared",
        metadata: { method: "native" },
      });
      return;
    }
    await copy();
  }

  async function copy() {
    await navigator.clipboard.writeText(fullUrl());
    void trackGrowthEvent({
      name: "memorial_shared",
      metadata: { method: "copy" },
    });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-white px-4 py-2.5 text-[11px] font-bold text-forest"
      >
        <Share2 size={13} />
        Share privately
      </button>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-white px-4 py-2.5 text-[11px] font-bold text-forest"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        href={qrPath}
        onClick={() =>
          void trackGrowthEvent({
            name: "memorial_shared",
            metadata: { method: "qr" },
          })
        }
        className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-white px-4 py-2.5 text-[11px] font-bold text-forest"
      >
        <QrCode size={13} />
        Download QR
      </a>
    </div>
  );
}
