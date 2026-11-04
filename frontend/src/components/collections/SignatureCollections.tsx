import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { HANDMADE_SLUG, collectionHref } from "@/lib/collections";
import { HOME_IMAGES } from "@/lib/home-content";
import { countDesigns, getHandmadeCategories, getSignatureCollections } from "@/lib/collections.server";

type Card = { href: string; name: string; tagline: string; count: number; image: { src: string; alt: string } };

/** Large portrait cards: each top-level image collection + the handmade jewellery group. */
export default function SignatureCollections() {
  const handmade = getHandmadeCategories();
  const cards: Card[] = [
    ...getSignatureCollections().map((c) => ({ href: c.href, name: c.name, tagline: c.tagline, count: countDesigns(c), image: c.cover })),
    {
      href: collectionHref(HANDMADE_SLUG),
      name: "Handmade Accessories",
      tagline: `${handmade.length} categories · hair, gifting & more`,
      count: handmade.reduce((n, c) => n + countDesigns(c), 0),
      image: { src: HOME_IMAGES.signatureHandmadeCover.src, alt: HOME_IMAGES.signatureHandmadeCover.alt },
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {cards.map((c, i) => (
        <Link
          key={c.href}
          href={c.href}
          data-reveal
          style={{ "--reveal-delay": `${i * 120}ms` } as React.CSSProperties}
          className="group relative block overflow-hidden rounded-[1.75rem] bg-cream shadow-[0_24px_50px_-35px_rgba(74,46,31,0.6)] transition duration-500 hover:-translate-y-1 last:sm:col-span-2 last:lg:col-span-1"
        >
          <div className="relative aspect-[4/5] sm:group-last:aspect-[16/9] lg:group-last:aspect-[4/5]">
            <Image src={c.image.src} alt={c.image.alt} fill sizes="(min-width:1024px) 410px, (min-width:640px) 50vw, 92vw" className="object-cover transition duration-[1.2s] ease-out group-hover:scale-[1.06]" />
          </div>
          <div className="absolute inset-0 bg-linear-to-t from-brown/95 via-brown/45 via-45% to-transparent to-75%" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-6 text-ivory">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-ivory/75">{c.count} designs</p>
              <h3 className="mt-1 font-display text-3xl leading-tight">{c.name}</h3>
              <p className="mt-1 text-sm text-ivory/80">{c.tagline}</p>
              <span className="mt-4 inline-block border-b border-ivory/50 pb-0.5 text-xs uppercase tracking-[0.2em] transition group-hover:border-ivory">View Collection</span>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ivory/15 ring-1 ring-ivory/40 backdrop-blur transition group-hover:bg-ivory group-hover:text-brown">
              <ArrowUpRight className="h-5 w-5" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
