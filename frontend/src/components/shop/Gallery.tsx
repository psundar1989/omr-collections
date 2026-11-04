"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage as Img } from "@/lib/types";
import { cn } from "@/lib/format";
import ProductImage from "./ProductImage";

export default function Gallery({ images, name }: { images: Img[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto lg:w-20 lg:flex-col">
          {images.map((img, i) => (
            <button key={img.id} onClick={() => setActive(i)} aria-label={`Show image ${i + 1}`}
              className={cn("relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-cream lg:w-full", i === active ? "border-gold" : "border-transparent opacity-70 hover:opacity-100")}>
              <Image src={img.url} alt={img.alt_text ?? name} fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-square flex-1 overflow-hidden rounded-3xl bg-cream"
        onTouchStart={(e) => ((e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX))}
        onTouchEnd={(e) => {
          const start = Number((e.currentTarget as HTMLElement).dataset.x);
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 40 && images.length > 1) setActive((a) => (a + (dx < 0 ? 1 : -1) + images.length) % images.length);
        }}>
        <ProductImage src={current?.url} alt={current?.alt_text ?? name} sizes="(min-width:1024px) 50vw, 100vw" priority />
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 lg:hidden">
            {images.map((img, i) => <span key={img.id} className={cn("h-1.5 rounded-full", i === active ? "w-5 bg-ink" : "w-1.5 bg-ink/30")} />)}
          </div>
        )}
      </div>
    </div>
  );
}
