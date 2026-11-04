import Link from "next/link";
import type { CatalogItem } from "@/lib/catalog";
import { imageAlt } from "@/lib/catalog";
import ProductImage from "./ProductImage";
import WishlistButton from "./WishlistButton";

/**
 * Card for a photographed catalogue product (src/data/products.json). Same look as
 * ProductCard; these products have no stored price, so the card leads to the product
 * page where the customer enquires on WhatsApp.
 */
export default function CatalogProductCard({ product, priority = false }: { product: CatalogItem; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream">
        <Link href={product.href} aria-label={product.name} className="absolute inset-0">
          <ProductImage src={product.image} alt={imageAlt(product)} priority={priority}
            sizes="(min-width:1280px) 280px, (min-width:768px) 30vw, 48vw"
            className="transition duration-500 group-hover:scale-[1.04]" />
        </Link>
        {product.isNewArrival && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink shadow-sm">New</span>
        )}
        <WishlistButton catalogId={product.id} className="absolute right-2.5 top-2.5" />
      </div>
      <div className="flex flex-1 flex-col px-0.5 pt-3">
        <p className="text-[11px] uppercase tracking-wider text-muted">
          <Link href={product.collectionHref} className="hover:text-gold-dark">{product.collectionName}</Link>
        </p>
        <h3 className="mt-0.5 line-clamp-2 text-[15px] leading-snug text-ink">
          <Link href={product.href} className="hover:text-gold-dark">{product.name}</Link>
        </h3>
        <p className="mt-1 text-xs text-muted">Price on request</p>
        <div className="mt-3 flex">
          <Link href={product.href} className="btn-outline flex-1 px-3 py-2 text-xs">View Details</Link>
        </div>
      </div>
    </article>
  );
}

export function CatalogProductGrid({ products, priorityCount = 0 }: { products: CatalogItem[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <CatalogProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
