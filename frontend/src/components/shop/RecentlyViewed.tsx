"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchProductsByIds } from "@/lib/client-api";
import { useRecentlyViewed } from "@/lib/store";
import type { Product } from "@/lib/types";
import Price from "./Price";
import ProductImage from "./ProductImage";

export default function RecentlyViewed({ excludeId, title = "Recently Viewed" }: { excludeId?: number; title?: string }) {
  const { ids } = useRecentlyViewed();
  const [products, setProducts] = useState<Product[]>([]);
  const wanted = ids.filter((id) => id !== excludeId).slice(0, 8);
  const key = wanted.join(",");

  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetchProductsByIds(key.split(",").map(Number)).then((p) => alive && setProducts(p)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key]);

  const shown = key ? products.filter((p) => wanted.includes(p.id)) : [];
  if (!shown.length) return null;

  return (
    <section className="container-x mt-16">
      <h2 className="heading-display mb-5 text-2xl sm:text-3xl">{title}</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
        {shown.map((p) => (
          <Link key={p.id} href={`/products/${p.slug}`} className="w-36 shrink-0 snap-start sm:w-44">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-cream">
              <ProductImage src={p.image_url} alt={p.name} sizes="176px" />
            </div>
            <p className="mt-2 line-clamp-1 text-sm">{p.name}</p>
            <Price price={p.price} original={p.original_price} size="sm" />
          </Link>
        ))}
      </div>
    </section>
  );
}
