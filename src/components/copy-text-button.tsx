"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyTextButton({
  text,
  label = "Copy template",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2200);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-paper px-4 py-2.5 text-xs font-bold text-forest transition hover:border-sage"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : label}
    </button>
  );
}
