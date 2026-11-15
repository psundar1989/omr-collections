"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage as Img } from "@/lib/types";
import { cn } from "@/lib/format";
import ProductImage from "./ProductImage";
import { colourImageIndex, useProductSelection } from "./ProductSelection";

export default function Gallery({ images, name }: { images: Img[]; name: string }) {
  const selection = useProductSelection();
  const colour = selection?.colour ?? null;
  const [active, setActive] = useState(() => Math.max(0, colourImageIndex(images, colour)));
  // When the chosen colour changes, show its photo (adjusting state during render, not in an effect).
  const [shownColour, setShownColour] = useState(colour);
  if (colour !== shownColour) {
    setShownColour(colour);
    const i = colourImageIndex(images, colour);
    if (i >= 0) setActive(i);
  }
  const current = images[active] ?? images[0];

  const show = (i: number) => {
    setActive(i);
    // A colour photo also chooses that colour in the purchase panel.
    const c = images[i]?.colour;
    if (c && selection && c !== selection.colour) {
      setShownColour(c);
      selection.setColour(c);
    }
  };

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto lg:max-h-[min(80vh,640px)] lg:w-20 lg:flex-col lg:overflow-y-auto">
          {images.map((img, i) => (
            <button key={img.id} onClick={() => show(i)} aria-label={img.colour ? `Show ${img.colour}` : `Show image ${i + 1}`} title={img.colour ?? undefined}
              className={cn("relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-cream lg:w-full", i === active ? "border-gold" : "border-transparent opacity-70 hover:opacity-100")}>
              <Image src={img.url} alt={img.alt_text ?? name} fill sizes="80px" className="object-contain object-center p-1" />
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-square w-full flex-1 overflow-hidden rounded-3xl bg-cream"
        onTouchStart={(e) => ((e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX))}
        onTouchEnd={(e) => {
          const start = Number((e.currentTarget as HTMLElement).dataset.x);
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 40 && images.length > 1) show((active + (dx < 0 ? 1 : -1) + images.length) % images.length);
        }}>
        <ProductImage src={current?.url} alt={current?.alt_text ?? name} sizes="(min-width:1024px) 50vw, 100vw" priority fit="contain" />
        {current?.colour && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ink shadow-sm">{current.colour}</span>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 lg:hidden">
            {images.map((img, i) => <span key={img.id} className={cn("h-1.5 rounded-full", i === active ? "w-5 bg-ink" : "w-1.5 bg-ink/30")} />)}
          </div>
        )}
      </div>
    </div>
  );
}
