"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

export type CarouselSlide = {
  key: string;
  eyebrow: string;
  headline: string;
  accent: string;
  text: string;
  image: { src: string; alt: string };
  productName: string;
  productHref: string;
  collectionName: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
};

const INTERVAL = 6000;

/**
 * Homepage hero carousel: product photo in an arch frame (the visual focus), copy and CTAs
 * beside it. Auto-advances every 6s; pauses on hover, keyboard focus, hidden tab, or the
 * pause button, and never auto-plays for prefers-reduced-motion. Slides share one grid
 * cell, so the hero keeps the height of its tallest slide and never jumps.
 */
export default function HomeCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hidden, setHidden] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    const vis = () => setHidden(document.hidden);
    sync();
    mq.addEventListener("change", sync);
    document.addEventListener("visibilitychange", vis);
    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const playing = count > 1 && !paused && !hovered && !focused && !reducedMotion && !hidden;

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL);
    return () => clearTimeout(t);
  }, [playing, index, count]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
  };

  return (
    <section
      className="container-x pt-4 sm:pt-6"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
      onKeyDown={onKeyDown}
    >
      <div
        className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-ivory via-cream to-ivory ring-1 ring-line"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        {/* soft decorative glows */}
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blush/80 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-sand/35 blur-3xl" />

        <div className="relative grid">
          {slides.map((s, i) => {
            const active = i === index;
            const Heading = i === 0 ? "h1" : "h2";
            return (
              <div
                key={s.key}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}: ${s.productName}`}
                aria-hidden={!active}
                inert={!active}
                className={cn(
                  "col-start-1 row-start-1 grid items-center gap-8 px-6 pb-24 pt-8 transition-opacity duration-[900ms] ease-out sm:px-12 sm:pt-10 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:py-16 lg:pb-20 xl:px-16",
                  active ? "z-10 opacity-100" : "z-0 opacity-0",
                )}
              >
                {/* Visual – first on mobile so the product leads */}
                <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-sm lg:order-2 lg:mr-0 lg:max-w-md">
                  <div aria-hidden className="absolute -inset-3 rounded-t-full rounded-b-[2.5rem] border border-gold/45 sm:-inset-4" />
                  <div className="relative aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[2rem] bg-cream shadow-[0_40px_80px_-40px_rgba(74,46,31,0.55)]">
                    <Image
                      src={s.image.src}
                      alt={s.image.alt}
                      fill
                      preload={i === 0}
                      sizes="(min-width:1024px) 448px, (min-width:640px) 384px, 80vw"
                      className={cn("object-cover transition-transform duration-[6s] ease-out", active ? "scale-100" : "scale-[1.07]")}
                    />
                  </div>
                  <Link
                    href={s.productHref}
                    tabIndex={active ? undefined : -1}
                    className="group absolute -bottom-5 left-1/2 flex w-max max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-left shadow-[0_18px_40px_-18px_rgba(74,46,31,0.45)] ring-1 ring-line backdrop-blur sm:max-w-[85%]"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                    <span className="truncate text-[13px] text-brown group-hover:text-gold-dark">{s.productName}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gold transition group-hover:translate-x-0.5" />
                  </Link>
                </div>

                {/* Copy */}
                <div className={cn("max-w-xl transition duration-[900ms] ease-out lg:order-1", active ? "translate-y-0" : "translate-y-4")}>
                  <p className="eyebrow flex items-center gap-3">
                    <span className="h-px w-8 bg-gold" aria-hidden /> {s.eyebrow}
                  </p>
                  <Heading className="heading-display mt-4 text-[2.4rem] leading-[1.04] text-brown sm:text-5xl xl:text-6xl">
                    {s.headline} <em className="font-normal text-rosegold">{s.accent}</em>
                  </Heading>
                  <p className="mt-5 max-w-md text-base leading-relaxed text-ink/70 sm:text-lg">{s.text}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href={s.primary.href} tabIndex={active ? undefined : -1} className="btn-primary group px-7 py-3.5">
                      {s.primary.label} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </Link>
                    <Link href={s.secondary.href} tabIndex={active ? undefined : -1} className="btn-outline px-7 py-3.5">
                      {s.secondary.label}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {count > 1 && (
          <div className="absolute inset-x-0 bottom-5 z-20 flex items-center justify-center gap-3 px-6 sm:bottom-6 lg:justify-start lg:px-12 xl:px-16">
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className="flex h-10 w-10 items-center justify-center rounded-full border border-brown/15 bg-white/80 text-brown shadow-sm transition hover:border-gold hover:text-gold-dark">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2" role="group" aria-label="Choose slide">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show slide ${i + 1}: ${s.collectionName}`}
                  aria-current={i === index ? "true" : undefined}
                  className={cn("relative h-1.5 overflow-hidden rounded-full transition-all duration-500", i === index ? "w-10 bg-brown/15" : "w-2.5 bg-brown/25 hover:bg-brown/45")}
                >
                  {i === index && (
                    <span
                      key={`${index}-${playing}`}
                      className={cn("absolute inset-0 origin-left rounded-full bg-gold", playing ? "animate-carousel-progress" : "")}
                      style={{ "--carousel-interval": `${INTERVAL}ms` } as React.CSSProperties}
                    />
                  )}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className="flex h-10 w-10 items-center justify-center rounded-full border border-brown/15 bg-white/80 text-brown shadow-sm transition hover:border-gold hover:text-gold-dark">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play slideshow" : "Pause slideshow"} className="ml-1 hidden h-8 w-8 items-center justify-center rounded-full text-brown/60 transition hover:text-gold-dark sm:flex">
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          </div>
        )}
        <p className="sr-only" aria-live="polite">{`Slide ${index + 1} of ${count}: ${slides[index]?.productName ?? ""}`}</p>
      </div>
    </section>
  );
}
