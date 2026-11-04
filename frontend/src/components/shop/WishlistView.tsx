"use client";

import Link from "next/link";
import { Heart, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchProductsByIds } from "@/lib/client-api";
import { useCatalogWishlist, useWishlist } from "@/lib/store";
import type { Product } from "@/lib/types";
import Price from "./Price";
import ProductImage from "./ProductImage";

/** Slim catalogue entry for saved photographed products. */
export type WishlistCatalogItem = { id: string; name: string; href: string; image: string; collectionName: string };

export default function WishlistView({ catalog }: { catalog: WishlistCatalogItem[] }) {
  const { ids, remove } = useWishlist();
  const catalogWishlist = useCatalogWishlist();
  const savedCatalog = catalogWishlist.ids.map((id) => catalog.find((c) => c.id === id)).filter((c): c is WishlistCatalogItem => !!c);
  const [loaded, setLoaded] = useState<{ key: string; list: Product[] } | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    let alive = true;
    if (!key) return;
    const done = (list: Product[]) => alive && setLoaded({ key, list });
    fetchProductsByIds(key.split(",").map(Number)).then(done).catch(() => done([]));
    return () => {
      alive = false;
    };
  }, [key]);

  // While a newer id list is loading keep showing the previous result (filtered to current ids).
  const products = !key ? [] : loaded ? loaded.list : null;
  const shown = (products ?? []).filter((p) => ids.includes(p.id));

  return (
    <div className="container-x py-8 sm:py-12">
      <h1 className="heading-display text-4xl sm:text-5xl">Wishlist</h1>
      <p className="mt-1 text-sm text-muted">Saved on this device – no login needed.</p>

      {products === null && savedCatalog.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
      ) : shown.length === 0 && savedCatalog.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Heart className="h-12 w-12 text-sand" strokeWidth={1.2} />
          <p className="heading-display mt-4 text-3xl">Nothing saved yet</p>
          <p className="mt-1 text-muted">Tap the heart on any product to save it here.</p>
          <Link href="/shop" className="btn-primary mt-6">Browse products</Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
          {savedCatalog.map((p) => (
            <div key={p.id}>
              <Link href={p.href} className="relative block aspect-square overflow-hidden rounded-2xl bg-cream">
                <ProductImage src={p.image} alt={`${p.name} – ${p.collectionName}`} sizes="(min-width:768px) 25vw, 50vw" />
              </Link>
              <p className="mt-3 text-[11px] uppercase tracking-wider text-muted">{p.collectionName}</p>
              <Link href={p.href} className="mt-0.5 line-clamp-2 block text-[15px] hover:text-gold-dark">{p.name}</Link>
              <p className="mt-1 text-xs text-muted">Price on request</p>
              <div className="mt-3 flex gap-2">
                <Link href={p.href} className="btn-primary flex-1 px-3 py-2 text-xs">View Details</Link>
                <button onClick={() => catalogWishlist.remove(p.id)} className="btn-outline px-3 py-2" aria-label={`Remove ${p.name}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {shown.map((p) => (
            <div key={p.id}>
              <Link href={`/products/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-cream">
                <ProductImage src={p.image_url} alt={p.name} sizes="(min-width:768px) 25vw, 50vw" />
                {!p.in_stock && <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-semibold uppercase text-white">Sold out</span>}
              </Link>
              <Link href={`/products/${p.slug}`} className="mt-3 line-clamp-2 block text-[15px] hover:text-gold-dark">{p.name}</Link>
              <Price price={p.price} original={p.original_price} discount={p.discount_percentage} size="sm" />
              <div className="mt-3 flex gap-2">
                <Link href={`/products/${p.slug}`} className="btn-primary flex-1 px-3 py-2 text-xs">{p.in_stock ? "Select options" : "View"}</Link>
                <button onClick={() => remove(p.id)} className="btn-outline px-3 py-2" aria-label={`Remove ${p.name}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
