import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { SERVER_API_URL } from "./config";
import { fromApiProduct, getCatalog, type CatalogItem } from "./catalog";
import type { Product } from "./types";

export type LiveCatalog = {
  items: CatalogItem[];
  /** false = the API could not be reached and `items` is the static products.json fallback. */
  live: boolean;
};

/**
 * Every product customers may see, from Laravel (GET /api/catalog): only enabled products in
 * visible categories, with live prices and availability. Uncached, so admin changes (enable,
 * disable, sold out, prices) show on the next page view; React `cache` dedupes per render.
 *
 * If the API is down the shop keeps browsing on the static photo catalogue – ordering still
 * goes through the API (cart quote), so nothing can be ordered from the fallback.
 */
export const getLiveCatalog = cache(async (): Promise<LiveCatalog> => {
  try {
    return { items: (await getLiveProducts()).map(fromApiProduct), live: true };
  } catch (e) {
    unstable_rethrow(e); // let Next.js' internal interrupts through
    console.error("[catalog] API unavailable, using static products.json", e);
    return { items: getCatalog(), live: false };
  }
});

/** The raw API products behind getLiveCatalog (same single request per render). Throws if the API is down. */
export const getLiveProducts = cache(async (): Promise<Product[]> => {
  // Request-time data: prerendering stops here, the listing streams in per request.
  await connection();
  const res = await fetch(`${SERVER_API_URL}/catalog`, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status} on /catalog`);
  return ((await res.json()) as { data: Product[] }).data;
});
