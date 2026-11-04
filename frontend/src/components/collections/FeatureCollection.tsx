import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { CollectionImage } from "@/lib/collections";
import { cn } from "@/lib/format";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  href: string;
  count: number;
  /** Photos link to `href` (their product page) when set, otherwise to the collection. */
  main: CollectionImage & { href?: string };
  thumbs: readonly (CollectionImage & { href?: string })[];
  /** Image composition on the right instead of the left (desktop). */
  reverse?: boolean;
  tone?: "blush" | "cream";
};

/** Editorial split section for a dedicated collection: photo mosaic + story + CTA. */
export default function FeatureCollection({ eyebrow, title, description, highlights, href, count, main, thumbs, reverse = false, tone = "blush" }: Props) {
  const rows = Math.ceil(thumbs.length / 2);

  return (
    <section className="container-x mt-16 sm:mt-24">
      <div className={cn("relative overflow-hidden rounded-[2rem] px-5 py-10 sm:px-10 sm:py-14 lg:px-14", tone === "blush" ? "bg-blush/70" : "bg-cream")}>
        <div className={cn("grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14", reverse && "lg:grid-cols-[1fr_1.15fr]")}>
          {/* Mosaic */}
          <div className={cn("grid grid-cols-[3fr_2fr] gap-3 sm:gap-4", reverse && "lg:order-2")} data-reveal="zoom">
            <Link href={main.href ?? href} className="group relative aspect-[3/4] overflow-hidden rounded-t-full rounded-b-3xl bg-ivory">
              <Image src={main.src} alt={main.alt} fill sizes="(min-width:1024px) 360px, 55vw" className="object-cover transition duration-[1.2s] ease-out group-hover:scale-105" />
            </Link>
            <div className="grid grid-cols-2 gap-3 sm:gap-4" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
              {thumbs.map((t) => (
                <Link key={t.src} href={t.href ?? href} className="group relative overflow-hidden rounded-2xl bg-ivory">
                  <Image src={t.src} alt={t.alt} fill sizes="(min-width:1024px) 120px, 20vw" className="object-cover transition duration-700 group-hover:scale-110" />
                </Link>
              ))}
            </div>
          </div>

          {/* Story */}
          <div className={cn(reverse && "lg:order-1")}>
            <p className="eyebrow" data-reveal>{eyebrow}</p>
            <h2 className="heading-display mt-3 text-4xl leading-[1.08] text-brown sm:text-5xl" data-reveal style={{ "--reveal-delay": "100ms" } as React.CSSProperties}>
              {title}
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-ink/70" data-reveal style={{ "--reveal-delay": "200ms" } as React.CSSProperties}>
              {description}
            </p>
            <ul className="mt-6 space-y-2.5" data-reveal style={{ "--reveal-delay": "300ms" } as React.CSSProperties}>
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-3 text-sm text-ink/80">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ivory text-gold ring-1 ring-gold/40"><Check className="h-3 w-3" /></span>
                  {h}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap items-center gap-5" data-reveal style={{ "--reveal-delay": "400ms" } as React.CSSProperties}>
              <Link href={href} className="btn-primary group px-7 py-3.5">
                View Collection <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <span className="text-sm text-muted">{count} handmade designs</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
