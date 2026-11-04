"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectionImage } from "@/lib/collections";

/** A gallery tile: a catalogue product (name + product page) or an uncatalogued photo. */
export type GalleryTile = CollectionImage & { name?: string | null; href?: string | null };
import { whatsappLink } from "@/lib/format";
import { WhatsAppIcon } from "@/components/ui/Icons";

type Props = {
  images: GalleryTile[];
  collectionName: string;
  itemLabel: string;
  /** Optional – when present each design gets an "Enquire on WhatsApp" button. */
  whatsappNumber?: string | null;
  siteUrl?: string;
};

/** Photo grid with a keyboard/swipe-friendly lightbox. */
export default function CollectionGallery({ images, collectionName, itemLabel, whatsappNumber, siteUrl = "" }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + images.length) % images.length)), [images.length]);

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

  const label = (i: number) => images[i].name ?? `Design #${i + 1}`;
  const enquire = (i: number) =>
    whatsappNumber
      ? whatsappLink(
          whatsappNumber,
          images[i].name
            ? `Hello! I'm interested in ${images[i].name} from your ${collectionName} collection.\n${siteUrl}${images[i].href ?? images[i].src}`
            : `Hello! I'm interested in this ${itemLabel} from your ${collectionName} collection (design #${i + 1}).\n${siteUrl}${images[i].src}`,
        )
      : null;

  const current = open != null ? images[open] : null;
  const currentLink = open != null ? enquire(open) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {images.map((im, i) => (
          <figure key={im.src} className="group relative overflow-hidden rounded-2xl bg-cream ring-1 ring-line" data-reveal="fade" style={{ "--reveal-delay": `${(i % 4) * 70}ms` } as React.CSSProperties}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`View larger: ${im.alt}`} className="relative block aspect-[4/5] w-full">
              <Image src={im.src} alt={im.alt} fill sizes="(min-width:1024px) 300px, (min-width:640px) 32vw, 48vw" className="object-cover transition duration-700 group-hover:scale-105" />
              <span className="absolute right-2.5 top-2.5 rounded-full bg-white/85 p-1.5 text-brown opacity-0 shadow-sm transition group-hover:opacity-100"><Expand className="h-3.5 w-3.5" /></span>
            </button>
            <figcaption className="flex items-start justify-between gap-2 px-3 py-2.5 text-xs text-muted">
              {im.href ? (
                <Link href={im.href} className="line-clamp-2 text-[13px] leading-snug text-ink hover:text-gold-dark">{label(i)}</Link>
              ) : (
                <span>{label(i)}</span>
              )}
              {whatsappNumber && (
                <a href={enquire(i)!} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 font-medium text-whatsapp hover:underline" aria-label={`Enquire about ${label(i)} on WhatsApp`}>
                  <WhatsAppIcon className="h-3.5 w-3.5" /> Enquire
                </a>
              )}
            </figcaption>
          </figure>
        ))}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${collectionName} image preview`}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="absolute inset-0 bg-ink/90 backdrop-blur-sm" onClick={close} />
          <div className="relative flex w-full max-w-3xl flex-col items-center">
            <div className="relative h-[72vh] w-full">
              <Image key={current.src} src={current.src} alt={current.alt} fill sizes="(min-width:768px) 768px, 92vw" className="object-contain" />
            </div>
            <div className="mt-4 flex w-full items-center justify-between gap-3 text-sm text-ivory/85">
              <span className="min-w-0">
                <span className="block truncate text-ivory">{label(open!)}</span>
                <span className="text-xs text-ivory/60">{collectionName} · {open! + 1} / {images.length}</span>
              </span>
              {current.href && (
                <Link href={current.href} className="btn-outline shrink-0 border-ivory/30 bg-transparent px-4 py-2 text-xs text-ivory hover:text-ivory">View details</Link>
              )}
              {currentLink && (
                <a href={currentLink} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-4 py-2 text-xs">
                  <WhatsAppIcon className="h-4 w-4" /> Enquire on WhatsApp
                </a>
              )}
            </div>
          </div>
          <button onClick={close} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close preview"><X className="h-5 w-5" /></button>
          {images.length > 1 && (
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
