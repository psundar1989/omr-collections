"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveInfo } from "@/lib/catalog";
import type { CollectionImage } from "@/lib/collections";

/** A gallery tile: a catalogue product (name, product page, live price) or an uncatalogued photo. */
export type GalleryTile = CollectionImage & { name?: string | null; href?: string | null; live?: LiveInfo };
import { formatPrice, whatsappLink } from "@/lib/format";
import { AVAILABILITY_LABELS } from "@/lib/types";
import Price from "@/components/shop/Price";
import { WhatsAppIcon } from "@/components/ui/Icons";

type Props = {
  images: GalleryTile[];
  collectionName: string;
  itemLabel: string;
  /** Optional – when present, designs without a price get an "Enquire on WhatsApp" button. */
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
  const availability = (i: number) => images[i].live?.availability;
  const unavailable = (i: number) => !!availability(i) && availability(i) !== "available";
  const priceOf = (i: number) => {
    const live = images[i].live;
    return live && !live.priceOnRequest ? live.price : null;
  };
  // Priced designs are bought from their product page; only unpriced, available designs need a WhatsApp enquiry.
  const enquire = (i: number) =>
    whatsappNumber && !unavailable(i) && priceOf(i) == null
      ? whatsappLink(
          whatsappNumber,
          images[i].name
            ? `Hello! I'm interested in ${images[i].name} from your ${collectionName} collection.\n${siteUrl}${images[i].href ?? images[i].src}`
            : `Hello! I'm interested in this ${itemLabel} from your ${collectionName} collection (design #${i + 1}).\n${siteUrl}${images[i].src}`,
        )
      : null;

  const current = open != null ? images[open] : null;
  const currentLink = open != null ? enquire(open) : null;
  const currentPrice = open != null ? priceOf(open) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {images.map((im, i) => (
          <figure key={im.src} className="group relative overflow-hidden rounded-2xl bg-cream ring-1 ring-line" data-reveal="fade" style={{ "--reveal-delay": `${(i % 4) * 70}ms` } as React.CSSProperties}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`View larger: ${im.alt}`} className="relative block aspect-[4/5] w-full">
              <Image src={im.src} alt={im.alt} fill sizes="(min-width:1024px) 300px, (min-width:640px) 32vw, 48vw" className="object-cover transition duration-700 group-hover:scale-105" />
              <span className="absolute right-2.5 top-2.5 rounded-full bg-white/85 p-1.5 text-brown opacity-0 shadow-sm transition group-hover:opacity-100"><Expand className="h-3.5 w-3.5" /></span>
            </button>
            <figcaption className="flex flex-col gap-1.5 px-3 py-2.5 text-xs text-muted">
              {im.href ? (
                <Link href={im.href} className="line-clamp-2 text-[13px] leading-snug text-ink hover:text-gold-dark">{label(i)}</Link>
              ) : (
                <span>{label(i)}</span>
              )}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                {(priceOf(i) != null || !unavailable(i)) && (
                  <Price price={priceOf(i)} original={im.live?.originalPrice} discount={im.live?.discount} currency={im.live?.currency} size="sm" />
                )}
                {unavailable(i) ? (
                  <span className="shrink-0 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">{AVAILABILITY_LABELS[availability(i)!]}</span>
                ) : enquire(i) ? (
                  <a href={enquire(i)!} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 font-medium text-whatsapp hover:underline" aria-label={`Enquire about ${label(i)} on WhatsApp`}>
                    <WhatsAppIcon className="h-3.5 w-3.5" /> Enquire
                  </a>
                ) : im.href ? (
                  <Link href={im.href} className="flex shrink-0 items-center gap-0.5 font-medium text-gold-dark hover:underline" aria-label={`View ${label(i)}`}>
                    View <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
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
                {currentPrice != null && (
                  <span className="block font-semibold text-ivory">
                    {formatPrice(currentPrice, current.live?.currency)}
                    {current.live?.originalPrice != null && current.live.originalPrice > currentPrice && (
                      <span className="ml-2 text-xs font-normal text-ivory/60 line-through">{formatPrice(current.live.originalPrice, current.live.currency)}</span>
                    )}
                  </span>
                )}
                {unavailable(open!) && <span className="block text-xs font-medium text-ivory">{AVAILABILITY_LABELS[availability(open!)!]}</span>}
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
