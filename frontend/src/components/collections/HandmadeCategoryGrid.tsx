import Image from "next/image";
import Link from "next/link";
import { countDesigns, getHandmadeCategories } from "@/lib/collections.server";

/** Arch-framed cards, one per folder in public/images/handmade_jewellerycollections. */
export default function HandmadeCategoryGrid() {
  const categories = getHandmadeCategories();

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:gap-x-10">
      {categories.map((c, i) => (
        <Link
          key={c.slug}
          href={c.href}
          data-reveal
          style={{ "--reveal-delay": `${(i % 3) * 110}ms` } as React.CSSProperties}
          className="group block text-center"
        >
          <div className="relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-t-full rounded-b-3xl bg-cream ring-1 ring-line transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_26px_50px_-30px_rgba(74,46,31,0.55)] lg:max-w-[19rem]">
            <Image src={c.cover.src} alt={c.cover.alt} fill sizes="(min-width:1024px) 304px, (min-width:640px) 31vw, 46vw" className="object-cover transition duration-[1.2s] ease-out group-hover:scale-[1.07]" />
            <span className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium tracking-wide text-brown opacity-0 shadow-sm transition duration-300 group-hover:opacity-100">
              Explore →
            </span>
          </div>
          <h3 className="mt-4 font-display text-xl leading-tight text-brown transition group-hover:text-gold-dark sm:text-2xl">{c.name}</h3>
          <p className="mt-1 text-xs text-muted sm:text-[13px]">{c.tagline}</p>
          <p className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-gold-dark">{countDesigns(c)} designs</p>
        </Link>
      ))}
    </div>
  );
}
