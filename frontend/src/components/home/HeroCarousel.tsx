"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/types";
import { cn } from "@/lib/format";

/**
 * Admin-managed banner carousel. `compact` renders it as a secondary promo strip
 * (smaller, <h2>) when the page already has its own hero.
 */
export default function HeroCarousel({ banners, fallback, compact = false }: { banners: Banner[]; fallback: { title: string; subtitle: string }; compact?: boolean }) {
  const Heading = compact ? "h2" : "h1";
  const slides = banners.length ? banners : [{ id: 0, title: fallback.title, subtitle: fallback.subtitle, image_url: null, button_text: "Shop Now", button_link: "/shop", sort_order: 0, is_active: true }];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <section className={compact ? "container-x mt-16 sm:mt-20" : "container-x pt-4 sm:pt-6"} data-reveal={compact ? "" : undefined}>
      <div className="relative overflow-hidden rounded-3xl bg-cream">
        {slides.map((b, idx) => (
          <div key={b.id} className={cn("transition-opacity duration-700", idx === i ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0")} aria-hidden={idx !== i}>
            <div className={cn("relative grid items-center lg:grid-cols-2", compact ? "min-h-[300px] sm:min-h-[340px]" : "min-h-[420px] sm:min-h-[480px] lg:min-h-[540px]")}>
              {b.image_url && (
                <div className="absolute inset-0 lg:left-[45%]">
                  <Image src={b.image_url} alt="" fill preload={idx === 0} sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ivory via-ivory/70 to-transparent lg:bg-gradient-to-r lg:from-cream lg:via-cream/90 lg:via-45% lg:to-transparent" />
              <div className={cn("relative z-10 px-6 sm:px-12", compact ? "py-10" : "py-14 lg:py-20")}>
                <p className="eyebrow">{compact ? "Highlights" : "Handcrafted in India"}</p>
                <Heading className={cn("heading-display mt-3 leading-[1.05]", compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl lg:text-7xl")}>{b.title}</Heading>
                {b.subtitle && <p className="mt-5 max-w-md text-base leading-relaxed text-ink/75 sm:text-lg">{b.subtitle}</p>}
                <div className="mt-8 flex flex-wrap gap-3">
                  {b.button_text && <Link href={b.button_link || "/shop"} className="btn-primary px-7 py-3">{b.button_text}</Link>}
                  <Link href="/custom-order" className="btn-outline px-7 py-3">Custom Order</Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {slides.length > 1 && (
          <>
            <button onClick={() => setI((i - 1 + slides.length) % slides.length)} className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 shadow sm:block" aria-label="Previous slide"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => setI((i + 1) % slides.length)} className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 shadow sm:block" aria-label="Next slide"><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
              {slides.map((b, idx) => (
                <button key={b.id} onClick={() => setI(idx)} aria-label={`Slide ${idx + 1}`} className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-6 bg-ink" : "w-1.5 bg-ink/30")} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
