"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { InstagramIcon } from "@/components/ui/Icons";

export type GalleryItem = { src: string; alt: string; link?: string | null };

/** Instagram-style square grid; clicking a tile opens a lightbox preview. */
export default function GalleryGrid({ items, instagramUrl }: { items: GalleryItem[]; instagramUrl?: string | null }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + items.length) % items.length)), [items.length]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, step]);

  const current = open != null ? items[open] : null;
  const link = current?.link || instagramUrl;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
        {items.map((it, i) => (
          <button key={i} type="button" onClick={() => setOpen(i)} aria-label={`Open image: ${it.alt}`}
            className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-cream">
            {it.src.startsWith("/") ? (
              <Image src={it.src} alt={it.alt} fill sizes="(min-width:1024px) 16vw, (min-width:640px) 25vw, 50vw" className="object-cover transition duration-500 group-hover:scale-110" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- admin-provided external URLs (any host)
              <img src={it.src} alt={it.alt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-brown/0 text-white opacity-0 transition duration-300 group-hover:bg-brown/45 group-hover:opacity-100">
              <InstagramIcon className="h-7 w-7" />
            </span>
          </button>
        ))}
      </div>

      {current && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Image preview">
          <div className="absolute inset-0 bg-ink/85" onClick={close} />
          <div className="relative w-full max-w-2xl">
            {current.src.startsWith("/") ? (
              <div className="relative h-[80vh] w-full"><Image src={current.src} alt={current.alt} fill sizes="(min-width:768px) 672px, 92vw" className="rounded-2xl object-contain" /></div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- admin-provided external URLs (any host)
              <img src={current.src} alt={current.alt} className="max-h-[80vh] w-full rounded-2xl object-contain" />
            )}
            <div className="mt-3 flex items-center justify-between text-sm text-ivory/85">
              <span>{open! + 1} / {items.length}</span>
              {link && (link.startsWith("/") ? (
                <a href={link} className="hover:text-white">View product →</a>
              ) : (
                <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white">
                  <InstagramIcon className="h-4 w-4" /> View on Instagram
                </a>
              ))}
            </div>
          </div>
          <button onClick={close} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close preview"><X className="h-5 w-5" /></button>
          {items.length > 1 && (
            <>
              <button onClick={() => step(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-6" aria-label="Previous image"><ChevronLeft className="h-6 w-6" /></button>
              <button onClick={() => step(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-6" aria-label="Next image"><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
        </div>
      )}
    </>
  );
}
