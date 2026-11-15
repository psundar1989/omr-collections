import Link from "next/link";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/format";
import CategoryCircleImage from "./CategoryCircleImage";

/**
 * Horizontal row of circular category tiles linking to /categories/[slug].
 * - "double": cream ring + dark-brown outer border (Trendset Beads look)
 * - "gold":   brown/gold gradient ring (Signature Charms look)
 */
export default function CategoryCircles({ categories, variant = "double" }: { categories: Category[]; variant?: "double" | "gold" }) {
  const cols = categories.length > 6 ? "sm:grid-cols-4 lg:grid-cols-8" : "sm:grid-cols-3 lg:grid-cols-6";
  // Up to three tiles fit side by side on a phone, so lay them out as an even grid;
  // longer lists scroll horizontally (scroll-px keeps the snapped first tile on the page gutter).
  const fitsOnPhone = categories.length <= 3;

  return (
    <div
      className={cn(
        "sm:mx-0 sm:grid sm:gap-6 sm:overflow-visible sm:px-0",
        fitsOnPhone ? "grid grid-cols-3 gap-3 pb-3" : "no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-5 overflow-x-auto px-4 pb-3 sm:scroll-px-0",
        cols,
      )}
    >
      {categories.map((c) => (
        <Link key={c.id} href={`/categories/${c.slug}`} className={cn("group min-w-0 text-center sm:w-auto", !fitsOnPhone && "w-28 shrink-0 snap-start")}>
          <div
            className={cn(
              "mx-auto aspect-square w-full max-w-[150px] rounded-full transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_12px_28px_-12px_rgba(74,46,31,0.45)]",
              variant === "double"
                ? "border-2 border-brown p-1.5 group-hover:border-gold-dark"
                : "bg-linear-to-br from-[#d9b56a] via-[#8c6c3d] to-brown p-[3px]",
            )}
          >
            <div className={cn("relative h-full w-full overflow-hidden rounded-full bg-cream", variant === "double" ? "border border-gold/60" : "border-[3px] border-ivory")}>
              <CategoryCircleImage src={c.image_url} slug={c.slug} alt={c.name} sizes="(min-width:1024px) 150px, (min-width:640px) 25vw, 112px" className="object-cover transition duration-500 group-hover:scale-110" />
            </div>
          </div>
          <p className="mt-3 font-display text-[14px] leading-tight min-[375px]:text-[15px] text-brown transition group-hover:text-gold-dark sm:text-base">{c.name}</p>
        </Link>
      ))}
    </div>
  );
}
