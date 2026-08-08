"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { trackCta } from "@/lib/track";

type Props = ComponentProps<typeof Link> & {
  label: string;
  productId?: string;
};

export function TrackLink({ label, productId, href, onClick, ...rest }: Props) {
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        trackCta(label, typeof href === "string" ? href : undefined, productId);
        onClick?.(e);
      }}
    />
  );
}
