"use client";

import { useEffect, useState } from "react";
import { fetchProductBySku } from "@/lib/client-api";
import type { Product } from "@/lib/types";
import Price from "./Price";

/**
 * Live price for a photographed catalogue card, from the Laravel product with the same
 * product code. Falls back to "Price on request" when the product is not in the API yet.
 */
export default function CatalogCardPrice({ code }: { code: string }) {
  const [state, setState] = useState<{ code: string; product: Product | null } | null>(null);

  useEffect(() => {
    let live = true;
    fetchProductBySku(code).then((product) => live && setState({ code, product }));
    return () => {
      live = false;
    };
  }, [code]);

  if (!state || state.code !== code) return <span className="mt-1 block h-4 w-16 animate-pulse rounded bg-cream" aria-hidden />;
  const p = state.product;
  if (!p) return <p className="mt-1 text-xs text-muted">Price on request</p>;
  return (
    <div className="mt-1">
      <Price price={p.price} original={p.original_price} discount={p.discount_percentage} currency={p.currency} size="sm" />
    </div>
  );
}
