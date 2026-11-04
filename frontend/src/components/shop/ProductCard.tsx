import Link from "next/link";
import type { Product } from "@/lib/types";
import Price from "./Price";
import ProductImage from "./ProductImage";
import WishlistButton from "./WishlistButton";
import QuickViewButton from "./QuickViewButton";

export default function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const href = `/products/${product.slug}`;
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream">
        <Link href={href} aria-label={product.name} className="absolute inset-0">
          <ProductImage src={product.image_url} alt={product.name} priority={priority}
            sizes="(min-width:1280px) 280px, (min-width:768px) 30vw, 48vw"
            className="transition duration-500 group-hover:scale-[1.04]" />
        </Link>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {!product.in_stock && <Tag className="bg-ink/80 text-white">Sold out</Tag>}
          {product.in_stock && product.discount_percentage ? <Tag className="bg-rose text-white">-{product.discount_percentage}%</Tag> : null}
          {product.is_new_arrival && <Tag className="bg-white text-ink">New</Tag>}
          {product.is_best_seller && <Tag className="bg-gold text-white">Best Seller</Tag>}
        </div>

        <WishlistButton productId={product.id} className="absolute right-2.5 top-2.5" />

        <div className="absolute inset-x-2.5 bottom-2.5 hidden translate-y-2 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 md:block">
          <QuickViewButton slug={product.slug} />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        {product.category && <p className="text-[11px] uppercase tracking-wider text-muted">{product.category.name}</p>}
        <h3 className="mt-0.5 line-clamp-2 text-[15px] leading-snug text-ink">
          <Link href={href} className="hover:text-gold-dark">{product.name}</Link>
        </h3>
        <div className="mt-1.5">
          <Price price={product.price} original={product.original_price} discount={product.discount_percentage} currency={product.currency} size="sm" />
        </div>
        <div className="mt-3 flex gap-2">
          <Link href={href} className="btn-outline flex-1 px-3 py-2 text-xs">View Details</Link>
          <div className="md:hidden">
            <QuickViewButton slug={product.slug} compact />
          </div>
        </div>
      </div>
    </article>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-sm ${className}`}>{children}</span>;
}
