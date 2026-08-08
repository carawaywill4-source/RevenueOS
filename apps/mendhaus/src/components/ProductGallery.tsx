"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductMedia as ProductMediaData } from "@/catalog/media";

export function ProductGallery({
  media,
  priority = false,
}: {
  media: ProductMediaData;
  priority?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const image = media.gallery[selected] ?? media.hero;
  const supplierPhotos = media.source === "supplier";

  return (
    <section aria-label={`${media.alt} image gallery`}>
      <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-sand lg:min-h-[520px]">
        <Image
          src={image}
          alt={selected === 0 ? media.alt : `${media.alt}, view ${selected + 1}`}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/20 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-ink/75 backdrop-blur">
          {supplierPhotos ? "Supplier product photo" : "Room context — product image pending"}
        </span>
      </div>
      {media.gallery.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {media.gallery.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Show image ${index + 1}`}
              aria-pressed={selected === index}
              className={`relative aspect-square overflow-hidden rounded-xl border transition ${
                selected === index
                  ? "border-spruce ring-2 ring-spruce/25"
                  : "border-line hover:border-ink/35"
              }`}
            >
              <Image src={src} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
