"use client";

import { Heart } from "lucide-react";
import { useCatalogWishlist, useWishlist } from "@/lib/store";
import { cn } from "@/lib/format";

/** Pass `productId` for an API product or `catalogId` for a photographed catalogue product. */
export default function WishlistButton({ productId, catalogId, className, withLabel = false }: { productId?: number; catalogId?: string; className?: string; withLabel?: boolean }) {
  const api = useWishlist();
  const catalog = useCatalogWishlist();
  const active = catalogId ? catalog.has(catalogId) : productId != null && api.has(productId);
  const toggle = () => (catalogId ? catalog.toggle(catalogId) : productId != null && api.toggle(productId));
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(withLabel ? "btn-outline" : "flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:scale-105", className)}
    >
      <Heart className={cn("h-[18px] w-[18px] transition", active ? "fill-rose text-rose" : "text-ink/70")} />
      {withLabel && (active ? "Saved" : "Wishlist")}
    </button>
  );
}
